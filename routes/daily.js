const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../lib/auth');
const { validate } = require('../lib/validate');
const { success, error, getTodayDate, parseDate } = require('../lib/response');

const router = express.Router();
router.use(authenticateToken);

// ─── Schemas ───────────────────────────────────────────────
const openingBalanceSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    notes: z.string().optional(),
});

const closingSchema = z.object({
    actualCash: z.number().min(0),
    expectedCash: z.number().min(0),
    supervisorCode: z.string().optional(),
    notes: z.string().optional(),
});

/**
 * @swagger
 * /daily/opening-balance:
 *   get:
 *     tags: [Daily Operations]
 *     summary: Check opening balance
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: Opening balance info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasOpening:
 *                   type: boolean
 *                 amount:
 *                   type: number
 *                 openedAt:
 *                   type: string
 *                   format: date-time
 *                 openedBy:
 *                   type: string
 */
router.get('/opening-balance', async (req, res) => {
    try {
        const dateStr = req.query.date || getTodayDate();
        const date = parseDate(dateStr);

        const session = await prisma.dailySession.findFirst({
            where: { date },
            include: { user: { select: { username: true } } },
        });

        if (!session) {
            return success(res, { hasOpening: false });
        }

        return success(res, {
            hasOpening: true,
            amount: session.openingAmount,
            openedAt: session.openedAt,
            openedBy: session.user.username,
        });
    } catch (err) {
        console.error('Get opening balance error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /daily/opening-balance:
 *   post:
 *     tags: [Daily Operations]
 *     summary: Set opening balance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500000
 *               notes:
 *                 type: string
 *                 example: Modal awal kasir 1
 *     responses:
 *       201:
 *         description: Opening balance set
 *       409:
 *         description: Already set for today
 */
router.post('/opening-balance', validate(openingBalanceSchema), async (req, res) => {
    try {
        const { amount, notes } = req.body;
        const date = parseDate(getTodayDate());

        const existing = await prisma.dailySession.findFirst({
            where: { date },
        });

        if (existing) {
            return error(res, 'Opening balance already set for today', 409);
        }

        await prisma.dailySession.create({
            data: {
                date,
                openingAmount: amount,
                openingNotes: notes,
                openedBy: req.user.id,
            },
        });

        return success(res, { message: 'Opening balance set successfully' }, 201);
    } catch (err) {
        console.error('Set opening balance error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /daily/closing/preview:
 *   get:
 *     tags: [Daily Operations]
 *     summary: Get closing preview with all cash-affecting transactions
 *     description: Aggregates ALL cash transactions from all modules (Resto, Mobil, Motor, EDC, Money Changer, Log Kas) and calculates expected cash.
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format (defaults to today)
 *     responses:
 *       200:
 *         description: Closing preview data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 openingBalance:
 *                   type: number
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source:
 *                         type: string
 *                         enum: [resto, mobil, motor, edc, money_changer, log_kas]
 *                       type:
 *                         type: string
 *                         enum: [IN, OUT]
 *                       description:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 expectedCash:
 *                   type: number
 *       404:
 *         description: No opening balance found
 */
router.get('/closing/preview', async (req, res) => {
    try {
        // Find session by id, or fallback to latest OPEN session
        let session;
        if (req.query.sessionId) {
            session = await prisma.dailySession.findUnique({
                where: { id: req.query.sessionId },
            });
        } else {
            session = await prisma.dailySession.findFirst({
                where: { status: 'OPEN' },
                orderBy: { createdAt: 'desc' },
            });
        }

        if (!session) {
            return error(res, 'No opening balance found', 404);
        }

        const openingBalance = session.openingAmount;
        const sinceDate = session.createdAt; // all txns since session opened
        const transactions = [];
        let expectedCash = openingBalance;

        // Resto orders (SETTLED + Cash only)
        const restoOrders = await prisma.order.findMany({
            where: { status: 'SETTLED', paymentMethod: 'Cash', createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const o of restoOrders) {
            transactions.push({
                source: 'resto',
                type: 'IN',
                description: `Order ${o.id} - ${o.customer}`,
                amount: o.total,
                createdAt: o.createdAt,
            });
            expectedCash += o.total;
        }

        // Mobil transactions (Cash only)
        const mobilTxs = await prisma.mobilTransaction.findMany({
            where: { paymentMethod: 'Cash', createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const m of mobilTxs) {
            transactions.push({
                source: 'mobil',
                type: 'IN',
                description: `Mobil - ${m.customerName} (${m.serviceType})`,
                amount: m.amount,
                createdAt: m.createdAt,
            });
            expectedCash += m.amount;
        }

        // Motor rentals (Cash only)
        const motorTxs = await prisma.motorRental.findMany({
            where: { paymentMethod: 'Cash', createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const r of motorTxs) {
            transactions.push({
                source: 'motor',
                type: 'IN',
                description: `Motor Rental - ${r.customerName} (${r.vehicleId})`,
                amount: r.amount,
                createdAt: r.createdAt,
            });
            expectedCash += r.amount;
        }

        // EDC transactions (WITHDRAWAL = cash out)
        const edcTxs = await prisma.edcTransaction.findMany({
            where: { createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const e of edcTxs) {
            if (e.type === 'WITHDRAWAL' && e.cashOutAmount > 0) {
                transactions.push({
                    source: 'edc',
                    type: 'OUT',
                    description: `EDC Tarik Tunai - ${e.provider} (Ref: ${e.refNumber || '-'})`,
                    amount: e.cashOutAmount,
                    createdAt: e.createdAt,
                });
                expectedCash -= e.cashOutAmount;
            }
        }

        // Money Changer (SELL = Cash In, BUY = Cash Out)
        const mcTxs = await prisma.moneyChangerTransaction.findMany({
            where: { createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const mc of mcTxs) {
            const isSell = mc.type === 'SELL';
            transactions.push({
                source: 'money_changer',
                type: isSell ? 'IN' : 'OUT',
                description: `Money Changer - ${isSell ? 'Jual' : 'Beli'} ${mc.currency} (Nota: ${mc.notaNumber || '-'})`,
                amount: mc.amountIdr,
                createdAt: mc.createdAt,
            });
            expectedCash += isSell ? mc.amountIdr : -mc.amountIdr;
        }

        // Cash transactions (Log Kas)
        const cashTxs = await prisma.cashTransaction.findMany({
            where: { createdAt: { gte: sinceDate } },
            orderBy: { createdAt: 'asc' },
        });
        for (const c of cashTxs) {
            transactions.push({
                source: 'log_kas',
                type: c.type,
                description: c.description || `Log Kas ${c.type === 'IN' ? 'Masuk' : 'Keluar'}`,
                amount: c.amount,
                createdAt: c.createdAt,
            });
            expectedCash += c.type === 'IN' ? c.amount : -c.amount;
        }

        transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return success(res, {
            sessionId: session.id,
            openingBalance,
            transactions,
            expectedCash,
        });
    } catch (err) {
        console.error('Closing preview error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /daily/closing:
 *   post:
 *     tags: [Daily Operations]
 *     summary: Perform daily closing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [actualCash, expectedCash]
 *             properties:
 *               actualCash:
 *                 type: number
 *                 example: 1250000
 *               expectedCash:
 *                 type: number
 *                 example: 1250000
 *               supervisorCode:
 *                 type: string
 *                 description: Required if difference != 0
 *               notes:
 *                 type: string
 *                 example: Closing aman
 *     responses:
 *       200:
 *         description: Closing successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 status:
 *                   type: string
 *                 difference:
 *                   type: number
 *       400:
 *         description: Supervisor code required
 *       403:
 *         description: Invalid supervisor code
 *       404:
 *         description: No open session
 */
router.post('/closing', validate(closingSchema), async (req, res) => {
    try {
        const { actualCash, expectedCash, supervisorCode, notes } = req.body;
        const difference = actualCash - expectedCash;

        if (difference !== 0 && !supervisorCode) {
            return error(res, 'Supervisor code required when difference is not zero', 400);
        }

        if (difference !== 0 && supervisorCode) {
            const supervisors = await prisma.user.findMany({
                where: { role: 'supervisor' },
            });

            let validCode = false;
            for (const sup of supervisors) {
                const match = await bcrypt.compare(supervisorCode, sup.password);
                if (match) {
                    validCode = true;
                    break;
                }
            }

            if (!validCode) {
                return error(res, 'Invalid supervisor code', 403);
            }
        }

        // Find latest OPEN session (could be from any day)
        const session = await prisma.dailySession.findFirst({
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
        });

        if (!session) {
            return error(res, 'No open session found', 404);
        }

        const updated = await prisma.dailySession.update({
            where: { id: session.id },
            data: {
                actualCash,
                expectedCash,
                difference,
                closingNotes: notes,
                closedAt: new Date(),
                status: 'CLOSED',
            },
        });

        const closingId = `CLS-${getTodayDate().replace(/-/g, '')}-${String(updated.id).padStart(2, '0')}`;

        return success(res, {
            id: closingId,
            status: 'CLOSED',
            difference,
        });
    } catch (err) {
        console.error('Daily closing error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
