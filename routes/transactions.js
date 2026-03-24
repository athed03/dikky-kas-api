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
const edcSchema = z.object({
    type: z.enum(['WITHDRAWAL', 'PAYMENT']),
    cardType: z.enum(['VISA', 'MASTER']),
    provider: z.string().min(0).default(""),
    amount: z.number().positive(),
    cashOutAmount: z.number().min(0).default(0),
    fee: z.number().min(0).default(0),
    refNumber: z.string().optional(),
});

const moneyChangerSchema = z.object({
    type: z.enum(['BUY', 'SELL']),
    currency: z.string().min(1),
    amountForeign: z.number().positive(),
    rate: z.number().positive(),
    amountIdr: z.number().positive(),
    notaNumber: z.string().optional(),
});

const cashSchema = z.object({
    type: z.enum(['IN', 'OUT']),
    category: z.enum(['resto', 'mobil', 'motor', 'edc', 'moneychanger', 'lainnya']).default('lainnya'),
    amount: z.number().positive(),
    description: z.string().optional(),
});

/**
 * @swagger
 * /transactions/edc:
 *   post:
 *     tags: [EDC Transactions]
 *     summary: Record EDC transaction
 *     description: Records an EDC transaction. If cashOutAmount > 0, also updates the 'edc' balance (cash out + fee).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, cardType, provider, amount]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [WITHDRAWAL, PAYMENT]
 *               cardType:
 *                 type: string
 *                 enum: [VISA, MASTER]
 *               provider:
 *                 type: string
 *                 example: BCA
 *               amount:
 *                 type: number
 *                 example: 1000000
 *                 description: Total swipe amount
 *               cashOutAmount:
 *                 type: number
 *                 example: 995000
 *                 description: Amount given to customer (if withdrawal)
 *               fee:
 *                 type: number
 *                 example: 5000
 *               refNumber:
 *                 type: string
 *                 example: REF123456
 *     responses:
 *       201:
 *         description: Transaction recorded. Updates 'edc' balance if cashOutAmount > 0.
 */
router.post('/edc', validate(edcSchema), async (req, res) => {
    try {
        const tx = await prisma.edcTransaction.create({
            data: {
                ...req.body,
                createdBy: req.user.username,
                date: parseDate(getTodayDate()),
            },
        });

        // Update balance: EDC withdrawal = cash out
        if (tx.cashOutAmount > 0) {
            await updateBalance('edc', tx.cashOutAmount, 'OUT', { fee: tx.fee });
        }

        return success(res, { id: tx.id, message: 'Transaction recorded' }, 201);
    } catch (err) {
        console.error('EDC transaction error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/edc:
 *   get:
 *     tags: [EDC Transactions]
 *     summary: Get EDC transactions by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of EDC transactions
 */
router.get('/edc', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const transactions = await prisma.edcTransaction.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, transactions);
    } catch (err) {
        console.error('Get EDC transactions error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/money-changer:
 *   post:
 *     tags: [Money Changer]
 *     summary: Record currency exchange
 *     description: "BUY = We buy foreign currency (Cash Out). SELL = We sell foreign currency (Cash In). Automatically updates the 'moneychanger' balance."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, currency, amountForeign, rate, amountIdr]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [BUY, SELL]
 *                 description: "BUY = Cash Out, SELL = Cash In"
 *               currency:
 *                 type: string
 *                 example: USD
 *               amountForeign:
 *                 type: number
 *                 example: 100
 *               rate:
 *                 type: number
 *                 example: 15000
 *               amountIdr:
 *                 type: number
 *                 example: 1500000
 *               notaNumber:
 *                 type: string
 *                 example: MC-2024-001
 *     responses:
 *       201:
 *         description: Exchange recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 cashFlowType:
 *                   type: string
 *                   enum: [IN, OUT]
 */
router.post('/money-changer', validate(moneyChangerSchema), async (req, res) => {
    try {
        const tx = await prisma.moneyChangerTransaction.create({
            data: {
                ...req.body,
                createdBy: req.user.username,
                date: parseDate(getTodayDate()),
            },
        });

        const cashFlowType = req.body.type === 'BUY' ? 'OUT' : 'IN';

        // Update balance for money changer
        await updateBalance('moneychanger', tx.amountIdr, cashFlowType);

        return success(res, { id: tx.id, cashFlowType }, 201);
    } catch (err) {
        console.error('Money changer transaction error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/money-changer:
 *   get:
 *     tags: [Money Changer]
 *     summary: Get money changer transactions by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of money changer transactions
 */
router.get('/money-changer', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const transactions = await prisma.moneyChangerTransaction.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, transactions);
    } catch (err) {
        console.error('Get money changer transactions error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/cash:
 *   post:
 *     tags: [Log Kas (Cash Flow)]
 *     summary: Record cash transaction
 *     description: Records a cash IN/OUT transaction and updates the balance for the given category.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, amount]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [IN, OUT]
 *               category:
 *                 type: string
 *                 default: lainnya
 *                 enum: [resto, mobil, motor, edc, moneychanger, lainnya]
 *                 description: Balance category to update
 *               amount:
 *                 type: number
 *                 example: 50000
 *               description:
 *                 type: string
 *                 example: Beli Alat Tulis Kantor
 *     responses:
 *       201:
 *         description: Transaction recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 balanceAfter:
 *                   type: number
 *                   nullable: true
 */
router.post('/cash', validate(cashSchema), async (req, res) => {
    try {
        const { type, category, amount, description } = req.body;
        const date = parseDate(getTodayDate());

        const tx = await prisma.cashTransaction.create({
            data: { type, category, amount, description, createdBy: req.user.username, date },
        });

        // Update balance for the chosen category
        await updateBalance(category, amount, type);

        const session = await prisma.dailySession.findFirst({
            where: { date },
        });

        let balanceAfter = null;
        if (session) {
            const cashTxs = await prisma.cashTransaction.findMany({ where: { date } });
            const cashNet = cashTxs.reduce((sum, t) => {
                return sum + (t.type === 'IN' ? t.amount : -t.amount);
            }, 0);
            balanceAfter = session.openingAmount + cashNet;
        }

        return success(res, { id: tx.id, balanceAfter }, 201);
    } catch (err) {
        console.error('Cash transaction error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/cash:
 *   get:
 *     tags: [Log Kas (Cash Flow)]
 *     summary: Get cash transactions by date
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: List of cash transactions
 */
router.get('/cash', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const transactions = await prisma.cashTransaction.findMany({
            where: { date },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, transactions);
    } catch (err) {
        console.error('Get cash transactions error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /transactions/balance:
 *   get:
 *     tags: [Balance]
 *     summary: Get balance records per category
 *     description: Returns all balance records. For motor/mobil categories, each vehicleId has its own balance entry.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [resto, mobil, motor, edc, moneychanger, lainnya]
 *         description: Filter by category (optional, returns all if omitted)
 *     responses:
 *       200:
 *         description: List of balance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   category:
 *                     type: string
 *                     enum: [resto, mobil, motor, edc, moneychanger, lainnya]
 *                   amount:
 *                     type: number
 *                     description: Running balance amount for this category
 *                   vehicleId:
 *                     type: string
 *                     description: License plate (only for motor/mobil, empty string for others)
 *                   totalFee:
 *                     type: number
 *                     description: Accumulated fee (only for EDC, 0 for others)
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *             example:
 *               - { id: 1, category: "resto", amount: 550000, vehicleId: "", totalFee: 0, updatedAt: "2026-02-22T08:00:00Z" }
 *               - { id: 2, category: "motor", amount: 200000, vehicleId: "B 1234 XYZ", totalFee: 0, updatedAt: "2026-02-22T09:00:00Z" }
 *               - { id: 3, category: "edc", amount: -995000, vehicleId: "", totalFee: 5000, updatedAt: "2026-02-22T10:00:00Z" }
 */
router.get('/balance', async (req, res) => {
    try {
        const where = {};
        if (req.query.category) {
            where.category = req.query.category;
        }

        const balances = await prisma.balance.findMany({
            where,
            orderBy: [{ category: 'asc' }, { vehicleId: 'asc' }],
        });

        return success(res, balances);
    } catch (err) {
        console.error('Get balances error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;

