const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../lib/auth');
const { validate } = require('../lib/validate');
const { success, error, getTodayDate, parseDate } = require('../lib/response');
const { updateBalance } = require('../lib/balance');


const router = express.Router();
router.use(authenticateToken);

// ─── Schema ────────────────────────────────────────────────
const createMobilSchema = z.object({
    customerName: z.string().min(1),
    serviceType: z.string().min(1), // "wash", "parking", "other"
    vehicleId: z.string().optional(),
    amount: z.number().positive(),
    paymentMethod: z.string().default('Cash'),
    notes: z.string().optional(),
});

/**
 * @swagger
 * /mobil/transactions:
 *   post:
 *     tags: [Mobil (Car Services)]
 *     summary: Record car service transaction
 *     description: Records a car service transaction. If paymentMethod is Cash, also updates the 'mobil' balance per vehicleId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, serviceType, amount]
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: Pak Ahmad
 *               serviceType:
 *                 type: string
 *                 enum: [wash, parking, other]
 *                 example: wash
 *               vehicleId:
 *                 type: string
 *                 example: B 1234 XYZ
 *               amount:
 *                 type: number
 *                 example: 150000
 *               paymentMethod:
 *                 type: string
 *                 default: Cash
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction recorded
 */
router.post('/transactions', validate(createMobilSchema), async (req, res) => {
    try {
        const { customerName, serviceType, vehicleId, amount, paymentMethod, notes } = req.body;

        const tx = await prisma.mobilTransaction.create({
            data: {
                customerName,
                serviceType,
                vehicleId,
                amount,
                paymentMethod,
                notes,
                date: parseDate(getTodayDate()),
            },
        });

        // Update balance for mobil (Cash only, with vehicleId)
        if (paymentMethod === 'Cash') {
            await updateBalance('mobil', amount, 'IN', { vehicleId: vehicleId || '' });
        }

        return success(res, { id: tx.id, status: tx.status }, 201);
    } catch (err) {
        console.error('Create mobil transaction error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /mobil/transactions:
 *   get:
 *     tags: [Mobil (Car Services)]
 *     summary: Get car service transactions by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of mobil transactions
 */
router.get('/transactions', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const transactions = await prisma.mobilTransaction.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, transactions);
    } catch (err) {
        console.error('Get mobil transactions error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
