const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Transaction Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    // ─── EDC ────────────────────────────────────────────────────
    describe('POST /api/v1/transactions/edc', () => {
        it('should record EDC transaction and return 201', async () => {
            mockPrisma.edcTransaction.create.mockResolvedValue({
                id: 'edc-1',
                cashOutAmount: 995000,
                fee: 5000,
            });

            const res = await request(app)
                .post('/api/v1/transactions/edc')
                .set('Authorization', authHeader())
                .send({
                    type: 'WITHDRAWAL',
                    cardType: 'VISA',
                    provider: 'BCA',
                    amount: 1000000,
                    cashOutAmount: 995000,
                    fee: 5000,
                    refNumber: 'REF123456',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('edc-1');
            expect(res.body.message).toBe('Transaction recorded');
        });

        it('should return 400 for invalid type', async () => {
            const res = await request(app)
                .post('/api/v1/transactions/edc')
                .set('Authorization', authHeader())
                .send({
                    type: 'INVALID',
                    cardType: 'VISA',
                    provider: 'BCA',
                    amount: 1000000,
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/transactions/edc', () => {
        it('should return EDC transactions', async () => {
            mockPrisma.edcTransaction.findMany.mockResolvedValue([
                { id: 'edc-1', type: 'WITHDRAWAL', provider: 'BCA', amount: 1000000 },
            ]);

            const res = await request(app)
                .get('/api/v1/transactions/edc?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });

    // ─── Money Changer ─────────────────────────────────────────
    describe('POST /api/v1/transactions/money-changer', () => {
        it('should record BUY transaction with cashFlowType OUT', async () => {
            mockPrisma.moneyChangerTransaction.create.mockResolvedValue({
                id: 'mc-1',
                amountIdr: 1500000,
            });

            const res = await request(app)
                .post('/api/v1/transactions/money-changer')
                .set('Authorization', authHeader())
                .send({
                    type: 'BUY',
                    currency: 'USD',
                    amountForeign: 100,
                    rate: 15000,
                    amountIdr: 1500000,
                    notaNumber: 'MC-2024-001',
                });

            expect(res.status).toBe(201);
            expect(res.body.cashFlowType).toBe('OUT');
        });

        it('should record SELL transaction with cashFlowType IN', async () => {
            mockPrisma.moneyChangerTransaction.create.mockResolvedValue({
                id: 'mc-2',
                amountIdr: 1500000,
            });

            const res = await request(app)
                .post('/api/v1/transactions/money-changer')
                .set('Authorization', authHeader())
                .send({
                    type: 'SELL',
                    currency: 'USD',
                    amountForeign: 100,
                    rate: 15000,
                    amountIdr: 1500000,
                });

            expect(res.status).toBe(201);
            expect(res.body.cashFlowType).toBe('IN');
        });

        it('should return 400 for invalid type', async () => {
            const res = await request(app)
                .post('/api/v1/transactions/money-changer')
                .set('Authorization', authHeader())
                .send({
                    type: 'TRADE',
                    currency: 'USD',
                    amountForeign: 100,
                    rate: 15000,
                    amountIdr: 1500000,
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/transactions/money-changer', () => {
        it('should return money changer transactions', async () => {
            mockPrisma.moneyChangerTransaction.findMany.mockResolvedValue([
                { id: 'mc-1', type: 'BUY', currency: 'USD', amountIdr: 1500000 },
            ]);

            const res = await request(app)
                .get('/api/v1/transactions/money-changer?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });

    // ─── Cash (Log Kas) ────────────────────────────────────────
    describe('POST /api/v1/transactions/cash', () => {
        it('should record cash OUT transaction with balanceAfter', async () => {
            mockPrisma.cashTransaction.create.mockResolvedValue({
                id: 'cash-1',
            });
            // Session exists with opening amount
            mockPrisma.dailySession.findFirst.mockResolvedValue({
                openingAmount: 500000,
            });
            // All cash transactions after recording
            mockPrisma.cashTransaction.findMany.mockResolvedValue([
                { type: 'OUT', amount: 50000 },
            ]);

            const res = await request(app)
                .post('/api/v1/transactions/cash')
                .set('Authorization', authHeader())
                .send({
                    type: 'OUT',
                    category: 'lainnya',
                    amount: 50000,
                    description: 'Beli ATK',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('cash-1');
            // balanceAfter = 500000 + (-50000) = 450000
            expect(res.body.balanceAfter).toBe(450000);
        });

        it('should return balanceAfter as null when no opening', async () => {
            mockPrisma.cashTransaction.create.mockResolvedValue({
                id: 'cash-2',
            });
            mockPrisma.dailySession.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/v1/transactions/cash')
                .set('Authorization', authHeader())
                .send({
                    type: 'IN',
                    amount: 100000,
                    description: 'Setoran',
                });

            expect(res.status).toBe(201);
            expect(res.body.balanceAfter).toBeNull();
        });

        it('should return 400 for invalid type', async () => {
            const res = await request(app)
                .post('/api/v1/transactions/cash')
                .set('Authorization', authHeader())
                .send({
                    type: 'TRANSFER',
                    amount: 50000,
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/transactions/cash', () => {
        it('should return cash transactions', async () => {
            mockPrisma.cashTransaction.findMany.mockResolvedValue([
                { id: 'cash-1', type: 'OUT', amount: 50000, description: 'Beli ATK' },
            ]);

            const res = await request(app)
                .get('/api/v1/transactions/cash?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });
});
