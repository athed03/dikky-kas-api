const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Central Balance Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    // ─── GET /central/accounts ────────────────────────────────
    describe('GET /api/v1/central/accounts', () => {
        it('should return existing accounts', async () => {
            mockPrisma.centralAccount.findMany.mockResolvedValue([
                { id: 1, name: 'cash', label: 'Cash', amount: 500000 },
                { id: 2, name: 'bank', label: 'Bank', amount: 1000000 },
            ]);

            const res = await request(app)
                .get('/api/v1/central/accounts')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].name).toBe('cash');
        });

        it('should auto-initialize defaults when no accounts exist', async () => {
            // First call returns empty, second call returns seeded accounts
            mockPrisma.centralAccount.findMany
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    { id: 1, name: 'cash', label: 'Cash', amount: 0 },
                    { id: 2, name: 'bank', label: 'Bank', amount: 0 },
                ]);
            mockPrisma.centralAccount.upsert.mockResolvedValue({ id: 'mock-id' });

            const res = await request(app)
                .get('/api/v1/central/accounts')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(mockPrisma.centralAccount.upsert).toHaveBeenCalledTimes(2);
            expect(res.body).toHaveLength(2);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app)
                .get('/api/v1/central/accounts');

            expect(res.status).toBe(401);
        });
    });

    // ─── POST /central/movements ──────────────────────────────
    describe('POST /api/v1/central/movements', () => {
        it('should record EXPENSE and decrement account', async () => {
            mockPrisma.centralMovement.create.mockResolvedValue({ id: 1 });
            mockPrisma.centralAccount.update.mockResolvedValue({ id: 1, amount: 400000 });

            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'EXPENSE',
                    account: 'cash',
                    amount: 100000,
                    description: 'Modal outlet',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe(1);
            expect(res.body.message).toBe('Movement recorded');
            expect(mockPrisma.centralAccount.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { name: 'cash' },
                    data: { amount: { decrement: 100000 } },
                })
            );
        });

        it('should record INCOME and increment account', async () => {
            mockPrisma.centralMovement.create.mockResolvedValue({ id: 2 });
            mockPrisma.centralAccount.update.mockResolvedValue({ id: 1, amount: 600000 });

            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'INCOME',
                    account: 'cash',
                    amount: 200000,
                    description: 'Pengembalian modal',
                });

            expect(res.status).toBe(201);
            expect(mockPrisma.centralAccount.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { name: 'cash' },
                    data: { amount: { increment: 200000 } },
                })
            );
        });

        it('should record TRANSFER and update both accounts', async () => {
            mockPrisma.centralMovement.create.mockResolvedValue({ id: 3 });
            mockPrisma.centralAccount.update.mockResolvedValue({ id: 'mock-id' });

            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'TRANSFER',
                    fromAccount: 'bank',
                    toAccount: 'cash',
                    amount: 500000,
                    description: 'Top up kas',
                });

            expect(res.status).toBe(201);
            // Should decrement fromAccount
            expect(mockPrisma.centralAccount.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { name: 'bank' },
                    data: { amount: { decrement: 500000 } },
                })
            );
            // Should increment toAccount
            expect(mockPrisma.centralAccount.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { name: 'cash' },
                    data: { amount: { increment: 500000 } },
                })
            );
        });

        it('should return 400 for EXPENSE without account', async () => {
            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'EXPENSE',
                    amount: 100000,
                });

            expect(res.status).toBe(400);
        });

        it('should return 400 for TRANSFER without fromAccount/toAccount', async () => {
            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'TRANSFER',
                    amount: 100000,
                });

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid type', async () => {
            const res = await request(app)
                .post('/api/v1/central/movements')
                .set('Authorization', authHeader())
                .send({
                    type: 'REFUND',
                    account: 'cash',
                    amount: 100000,
                });

            expect(res.status).toBe(400);
        });
    });

    // ─── GET /central/movements ───────────────────────────────
    describe('GET /api/v1/central/movements', () => {
        it('should return movements for date range', async () => {
            mockPrisma.centralMovement.findMany.mockResolvedValue([
                { id: 1, type: 'EXPENSE', account: 'cash', amount: 100000, description: 'Modal' },
                { id: 2, type: 'INCOME', account: 'cash', amount: 200000, description: 'Setoran' },
            ]);

            const res = await request(app)
                .get('/api/v1/central/movements?startDate=2026-03-01&endDate=2026-03-27')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(mockPrisma.centralMovement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        date: {
                            gte: expect.any(Date),
                            lte: expect.any(Date),
                        },
                    },
                })
            );
        });

        it('should default to today when no dates provided', async () => {
            mockPrisma.centralMovement.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/v1/central/movements')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
});
