const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../lib/auth');
const { validate } = require('../lib/validate');
const { success, error, getTodayDate, parseDate } = require('../lib/response');
const { updateBalance } = require('../lib/balance');


const router = express.Router();
router.use(authenticateToken);

// ─── Schemas ───────────────────────────────────────────────
const createOrderSchema = z.object({
    customer: z.string().min(1),
    items: z.array(z.object({
        productId: z.number().optional(),
        name: z.string().optional(),
        qty: z.number().positive(),
        price: z.number().min(0),
    })).min(1, 'At least one item required'),
    subtotal: z.number().min(0),
    tax: z.number().min(0).default(0),
    total: z.number().min(0),
});

const settleOrderSchema = z.object({
    paymentMethod: z.string().min(1),
    amountPaid: z.number().positive(),
});

/**
 * @swagger
 * /resto/orders:
 *   get:
 *     tags: [Resto]
 *     summary: Get orders by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   customer:
 *                     type: string
 *                   total:
 *                     type: number
 *                   status:
 *                     type: string
 *                     enum: [OPEN, SETTLED, VOID]
 *                   paymentMethod:
 *                     type: string
 *                   items:
 *                     type: array
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/orders', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const orders = await prisma.order.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, orders);
    } catch (err) {
        console.error('Get orders error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /resto/orders:
 *   post:
 *     tags: [Resto]
 *     summary: Create a new order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer, items, subtotal, total]
 *             properties:
 *               customer:
 *                 type: string
 *                 example: Meja 5
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     qty:
 *                       type: integer
 *                       example: 2
 *                     price:
 *                       type: number
 *                       example: 25000
 *               subtotal:
 *                 type: number
 *                 example: 50000
 *               tax:
 *                 type: number
 *                 example: 5000
 *               total:
 *                 type: number
 *                 example: 55000
 *     responses:
 *       201:
 *         description: Order created
 */
router.post('/orders', validate(createOrderSchema), async (req, res) => {
    try {
        const { customer, items, subtotal, tax, total } = req.body;

        const order = await prisma.order.create({
            data: {
                customer,
                items,
                subtotal,
                tax,
                total,
                date: parseDate(getTodayDate()),
            },
        });

        return success(res, { id: order.id, status: order.status }, 201);
    } catch (err) {
        console.error('Create order error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /resto/orders/{id}/settle:
 *   post:
 *     tags: [Resto]
 *     summary: Settle an order
 *     description: Settles an open order. If paymentMethod is Cash, also updates the 'resto' balance.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod, amountPaid]
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 example: Cash
 *                 enum: [Cash, QRIS, Debit, Credit]
 *               amountPaid:
 *                 type: number
 *                 example: 60000
 *     responses:
 *       200:
 *         description: Order settled
 *       400:
 *         description: Order already settled/void
 *       404:
 *         description: Order not found
 */
router.post('/orders/:id/settle', validate(settleOrderSchema), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { paymentMethod, amountPaid } = req.body;

        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) {
            return error(res, 'Order not found', 404);
        }
        if (order.status !== 'OPEN') {
            return error(res, `Order is already ${order.status}`, 400);
        }

        const updated = await prisma.order.update({
            where: { id },
            data: {
                paymentMethod,
                amountPaid,
                status: 'SETTLED',
            },
        });

        // Update balance for resto (Cash only)
        if (paymentMethod === 'Cash') {
            await updateBalance('resto', order.total, 'IN');
        }

        return success(res, { id: updated.id, status: updated.status });
    } catch (err) {
        console.error('Settle order error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
