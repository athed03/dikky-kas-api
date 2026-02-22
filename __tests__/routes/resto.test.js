const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Resto Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    // ─── GET /resto/orders ──────────────────────────────────────
    describe('GET /api/v1/resto/orders', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/v1/resto/orders');
            expect(res.status).toBe(401);
        });

        it('should return list of orders', async () => {
            mockPrisma.order.findMany.mockResolvedValue([
                { id: 'ord1', customer: 'Meja 5', total: 55000, status: 'OPEN' },
                { id: 'ord2', customer: 'Meja 3', total: 30000, status: 'SETTLED' },
            ]);

            const res = await request(app)
                .get('/api/v1/resto/orders?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].customer).toBe('Meja 5');
        });
    });

    // ─── POST /resto/orders ─────────────────────────────────────
    describe('POST /api/v1/resto/orders', () => {
        it('should create order and return 201', async () => {
            mockPrisma.order.create.mockResolvedValue({
                id: 'ord-new',
                status: 'OPEN',
            });

            const res = await request(app)
                .post('/api/v1/resto/orders')
                .set('Authorization', authHeader())
                .send({
                    customer: 'Meja 5',
                    items: [{ productId: 1, qty: 2, price: 25000 }],
                    subtotal: 50000,
                    tax: 5000,
                    total: 55000,
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('ord-new');
            expect(res.body.status).toBe('OPEN');
        });

        it('should return 400 for missing items', async () => {
            const res = await request(app)
                .post('/api/v1/resto/orders')
                .set('Authorization', authHeader())
                .send({ customer: 'Meja 5', subtotal: 50000, total: 55000 });

            expect(res.status).toBe(400);
        });
    });

    // ─── POST /resto/orders/:id/settle ──────────────────────────
    describe('POST /api/v1/resto/orders/:id/settle', () => {
        it('should settle an OPEN order', async () => {
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'ord1',
                status: 'OPEN',
            });
            mockPrisma.order.update.mockResolvedValue({
                id: 'ord1',
                status: 'SETTLED',
            });

            const res = await request(app)
                .post('/api/v1/resto/orders/ord1/settle')
                .set('Authorization', authHeader())
                .send({ paymentMethod: 'Cash', amountPaid: 60000 });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('SETTLED');
        });

        it('should return 404 if order not found', async () => {
            mockPrisma.order.findUnique.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/v1/resto/orders/non-existent/settle')
                .set('Authorization', authHeader())
                .send({ paymentMethod: 'Cash', amountPaid: 60000 });

            expect(res.status).toBe(404);
        });

        it('should return 400 if order already SETTLED', async () => {
            mockPrisma.order.findUnique.mockResolvedValue({
                id: 'ord1',
                status: 'SETTLED',
            });

            const res = await request(app)
                .post('/api/v1/resto/orders/ord1/settle')
                .set('Authorization', authHeader())
                .send({ paymentMethod: 'Cash', amountPaid: 60000 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already SETTLED');
        });
    });
});
