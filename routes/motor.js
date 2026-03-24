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
const createRentalSchema = z.object({
    customerName: z.string().min(1),
    vehicleId: z.string().min(1),
    duration: z.number().positive(), // Days
    amount: z.number().positive(),
    paymentMethod: z.string().default('Cash'),
    notes: z.string().optional(),
});

/**
 * @swagger
 * /motor/rentals:
 *   post:
 *     tags: [Motor (Bike Rental)]
 *     summary: Create bike rental record
 *     description: Records a bike rental. If paymentMethod is Cash, also updates the 'motor' balance per vehicleId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, vehicleId, duration, amount]
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: Pak Budi
 *               vehicleId:
 *                 type: string
 *                 example: MTR-001
 *               duration:
 *                 type: integer
 *                 example: 2
 *                 description: Duration in days
 *               amount:
 *                 type: number
 *                 example: 200000
 *               paymentMethod:
 *                 type: string
 *                 default: Cash
 *               notes:
 *                 type: string
 *                 example: Deposit KTP
 *     responses:
 *       201:
 *         description: Rental created
 */
router.post('/rentals', validate(createRentalSchema), async (req, res) => {
    try {
        const { customerName, vehicleId, duration, amount, paymentMethod, notes } = req.body;

        const rental = await prisma.motorRental.create({
            data: {
                customerName,
                vehicleId,
                duration,
                amount,
                paymentMethod,
                notes,
                createdBy: req.user.username,
                date: parseDate(getTodayDate()),
            },
        });

        // Update balance for motor (Cash only, with vehicleId)
        if (paymentMethod === 'Cash') {
            await updateBalance('motor', amount, 'IN', { vehicleId });
        }

        return success(res, { id: rental.id, status: rental.status }, 201);
    } catch (err) {
        console.error('Create motor rental error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /motor/rentals:
 *   get:
 *     tags: [Motor (Bike Rental)]
 *     summary: Get bike rentals by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of motor rentals
 */
router.get('/rentals', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const rentals = await prisma.motorRental.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, rentals);
    } catch (err) {
        console.error('Get motor rentals error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /motor/vehicles:
 *   get:
 *     tags: [Motor (Bike Rental)]
 *     summary: Get available bike vehicles
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   plate:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [AVAILABLE, RENTED]
 */
router.get('/vehicles', async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { type: 'bike' },
            orderBy: { name: 'asc' },
        });

        return success(res, vehicles);
    } catch (err) {
        console.error('Get motor vehicles error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
