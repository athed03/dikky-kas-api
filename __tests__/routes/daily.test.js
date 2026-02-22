const request = require('supertest');
const bcrypt = require('bcryptjs');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Daily Operations Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    // ─── GET /daily/opening-balance ─────────────────────────────
    describe('GET /api/v1/daily/opening-balance', () => {
        it('should return 401 without auth header', async () => {
            const res = await request(app).get('/api/v1/daily/opening-balance');
            expect(res.status).toBe(401);
        });

        it('should return hasOpening: false when no session', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/v1/daily/opening-balance')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body.hasOpening).toBe(false);
        });

        it('should return opening balance data when session exists', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue({
                openingAmount: 500000,
                openedAt: '2026-02-19T08:00:00.000Z',
                user: { username: 'kasir1' },
            });

            const res = await request(app)
                .get('/api/v1/daily/opening-balance?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body.hasOpening).toBe(true);
            expect(res.body.amount).toBe(500000);
            expect(res.body.openedBy).toBe('kasir1');
        });
    });

    // ─── POST /daily/opening-balance ────────────────────────────
    describe('POST /api/v1/daily/opening-balance', () => {
        it('should return 201 when opening balance set successfully', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue(null);
            mockPrisma.dailySession.create.mockResolvedValue({ id: 1 });

            const res = await request(app)
                .post('/api/v1/daily/opening-balance')
                .set('Authorization', authHeader())
                .send({ amount: 500000, notes: 'Modal awal' });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Opening balance set successfully');
        });

        it('should return 409 when opening already set', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue({ id: 1 });

            const res = await request(app)
                .post('/api/v1/daily/opening-balance')
                .set('Authorization', authHeader())
                .send({ amount: 500000 });

            expect(res.status).toBe(409);
            expect(res.body.error).toContain('already set');
        });

        it('should return 400 for invalid amount', async () => {
            const res = await request(app)
                .post('/api/v1/daily/opening-balance')
                .set('Authorization', authHeader())
                .send({ amount: -100 });

            expect(res.status).toBe(400);
        });
    });

    // ─── GET /daily/closing/preview ─────────────────────────────
    describe('GET /api/v1/daily/closing/preview', () => {
        it('should return 404 when no opening balance', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/v1/daily/closing/preview?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('No opening balance');
        });

        it('should return 200 with aggregated transactions and expected cash', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue({
                openingAmount: 500000,
            });

            // Resto: 1 settled cash order of 55000
            mockPrisma.order.findMany.mockResolvedValue([
                { id: 'ord1', customer: 'Meja 5', total: 55000, createdAt: '2026-02-19T10:00:00Z' },
            ]);

            // EDC: 1 withdrawal of 995000
            mockPrisma.edcTransaction.findMany.mockResolvedValue([
                { type: 'WITHDRAWAL', cashOutAmount: 995000, provider: 'BCA', refNumber: 'REF1', createdAt: '2026-02-19T14:00:00Z' },
            ]);

            // Money Changer: SELL 1500000 IDR (Cash In)
            mockPrisma.moneyChangerTransaction.findMany.mockResolvedValue([
                { type: 'SELL', currency: 'USD', amountIdr: 1500000, notaNumber: 'MC-001', createdAt: '2026-02-19T11:00:00Z' },
            ]);

            // Log Kas: OUT 50000
            mockPrisma.cashTransaction.findMany.mockResolvedValue([
                { type: 'OUT', amount: 50000, description: 'Beli ATK', createdAt: '2026-02-19T15:00:00Z' },
            ]);

            // Mobil + Motor: empty
            mockPrisma.mobilTransaction.findMany.mockResolvedValue([]);
            mockPrisma.motorRental.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/v1/daily/closing/preview?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body.openingBalance).toBe(500000);
            expect(res.body.transactions).toHaveLength(4);
            // Expected: 500000 + 55000 - 995000 + 1500000 - 50000 = 1010000
            expect(res.body.expectedCash).toBe(1010000);
        });
    });

    // ─── POST /daily/closing ────────────────────────────────────
    describe('POST /api/v1/daily/closing', () => {
        it('should close successfully when no difference', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue({
                id: 1,
                status: 'OPEN',
            });
            mockPrisma.dailySession.update.mockResolvedValue({ id: 1 });

            const res = await request(app)
                .post('/api/v1/daily/closing')
                .set('Authorization', authHeader())
                .send({ actualCash: 1250000, expectedCash: 1250000 });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('CLOSED');
            expect(res.body.difference).toBe(0);
        });

        it('should return 400 when difference without supervisor code', async () => {
            const res = await request(app)
                .post('/api/v1/daily/closing')
                .set('Authorization', authHeader())
                .send({ actualCash: 1200000, expectedCash: 1250000 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Supervisor code required');
        });

        it('should return 403 when supervisor code is invalid', async () => {
            const hashedPassword = await bcrypt.hash('super123', 10);
            mockPrisma.user.findMany.mockResolvedValue([
                { id: 3, role: 'supervisor', password: hashedPassword },
            ]);

            const res = await request(app)
                .post('/api/v1/daily/closing')
                .set('Authorization', authHeader())
                .send({
                    actualCash: 1200000,
                    expectedCash: 1250000,
                    supervisorCode: 'wrong-code',
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('Invalid supervisor code');
        });

        it('should return 404 when no open session found', async () => {
            mockPrisma.dailySession.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/v1/daily/closing')
                .set('Authorization', authHeader())
                .send({ actualCash: 1250000, expectedCash: 1250000 });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('No open session');
        });
    });
});
