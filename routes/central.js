const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../lib/auth');
const { validate } = require('../lib/validate');
const { success, error, getTodayDate, parseDate } = require('../lib/response');

const router = express.Router();
router.use(authenticateToken);

// ─── Schemas ───────────────────────────────────────────────

const movementSchema = z.object({
    type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
    account: z.string().optional(),       // for EXPENSE / INCOME
    fromAccount: z.string().optional(),   // for TRANSFER
    toAccount: z.string().optional(),     // for TRANSFER
    amount: z.number().positive(),
    description: z.string().optional(),
}).refine(
    (data) => {
        if (data.type === 'TRANSFER') return data.fromAccount && data.toAccount;
        return !!data.account;
    },
    { message: 'TRANSFER requires fromAccount & toAccount; EXPENSE/INCOME requires account' }
);

// ─── GET /central/accounts ─────────────────────────────────

/**
 * @swagger
 * /central/accounts:
 *   get:
 *     tags: [Central Balance]
 *     summary: List all central accounts with balances
 *     responses:
 *       200:
 *         description: List of accounts
 */
router.get('/accounts', async (req, res) => {
    try {
        let accounts = await prisma.centralAccount.findMany({
            orderBy: { id: 'asc' },
        });

        // Auto-initialize default accounts if none exist
        if (accounts.length === 0) {
            const defaults = [
                { name: 'cash', label: 'Cash' },
                { name: 'bank', label: 'Bank' },
            ];
            for (const acc of defaults) {
                await prisma.centralAccount.upsert({
                    where: { name: acc.name },
                    update: {},
                    create: acc,
                });
            }
            accounts = await prisma.centralAccount.findMany({
                orderBy: { id: 'asc' },
            });
        }

        return success(res, accounts);
    } catch (err) {
        console.error('Get central accounts error:', err);
        return error(res, 'Internal server error');
    }
});

// ─── POST /central/movements ───────────────────────────────

/**
 * @swagger
 * /central/movements:
 *   post:
 *     tags: [Central Balance]
 *     summary: Create a balance movement
 *     description: |
 *       EXPENSE: decrease account balance
 *       INCOME: increase account balance
 *       TRANSFER: move amount from one account to another
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
 *                 enum: [EXPENSE, INCOME, TRANSFER]
 *               account:
 *                 type: string
 *                 description: Account name (for EXPENSE/INCOME)
 *               fromAccount:
 *                 type: string
 *                 description: Source account (for TRANSFER)
 *               toAccount:
 *                 type: string
 *                 description: Destination account (for TRANSFER)
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Movement recorded
 */
router.post('/movements', validate(movementSchema), async (req, res) => {
    try {
        const { type, account, fromAccount, toAccount, amount, description } = req.body;
        const date = parseDate(getTodayDate());

        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Create the movement record
            const movement = await tx.centralMovement.create({
                data: {
                    type,
                    account: type !== 'TRANSFER' ? account : null,
                    fromAccount: type === 'TRANSFER' ? fromAccount : null,
                    toAccount: type === 'TRANSFER' ? toAccount : null,
                    amount,
                    description,
                    createdBy: req.user.username,
                    date,
                },
            });

            // Update account balances
            if (type === 'EXPENSE') {
                await tx.centralAccount.update({
                    where: { name: account },
                    data: { amount: { decrement: amount } },
                });
            } else if (type === 'INCOME') {
                await tx.centralAccount.update({
                    where: { name: account },
                    data: { amount: { increment: amount } },
                });
            } else if (type === 'TRANSFER') {
                await tx.centralAccount.update({
                    where: { name: fromAccount },
                    data: { amount: { decrement: amount } },
                });
                await tx.centralAccount.update({
                    where: { name: toAccount },
                    data: { amount: { increment: amount } },
                });
            }

            return movement;
        });

        return success(res, { id: result.id, message: 'Movement recorded' }, 201);
    } catch (err) {
        console.error('Central movement error:', err);
        if (err.code === 'P2025') {
            return error(res, 'Account not found', 400);
        }
        return error(res, 'Internal server error');
    }
});

// ─── GET /central/movements ────────────────────────────────

/**
 * @swagger
 * /central/movements:
 *   get:
 *     tags: [Central Balance]
 *     summary: Get movements by date range
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date YYYY-MM-DD (defaults to today)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date YYYY-MM-DD (defaults to startDate)
 *     responses:
 *       200:
 *         description: List of movements
 */
router.get('/movements', async (req, res) => {
    try {
        const startStr = req.query.startDate || getTodayDate();
        const endStr = req.query.endDate || startStr;
        const startDate = parseDate(startStr);
        const endDate = parseDate(endStr);

        const movements = await prisma.centralMovement.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return success(res, movements);
    } catch (err) {
        console.error('Get central movements error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
