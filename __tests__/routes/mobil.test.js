const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Mobil Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    describe('POST /api/v1/mobil/transactions', () => {
        it('should create mobil transaction and return 201', async () => {
            mockPrisma.mobilTransaction.create.mockResolvedValue({
                id: 'mob-1',
                status: 'COMPLETED',
            });

            const res = await request(app)
                .post('/api/v1/mobil/transactions')
                .set('Authorization', authHeader())
                .send({
                    customerName: 'Pak Ahmad',
                    serviceType: 'wash',
                    vehicleId: 'B 1234 XYZ',
                    amount: 150000,
                    paymentMethod: 'Cash',
                    notes: 'Cuci mobil + interior',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('mob-1');
            expect(res.body.status).toBe('COMPLETED');
        });

        it('should return 400 for missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/mobil/transactions')
                .set('Authorization', authHeader())
                .send({ amount: 150000 });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/mobil/transactions', () => {
        it('should return list of mobil transactions', async () => {
            mockPrisma.mobilTransaction.findMany.mockResolvedValue([
                { id: 'mob-1', customerName: 'Pak Ahmad', amount: 150000 },
            ]);

            const res = await request(app)
                .get('/api/v1/mobil/transactions?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].customerName).toBe('Pak Ahmad');
        });
    });
});
