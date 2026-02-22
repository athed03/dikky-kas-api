const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Motor Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    describe('POST /api/v1/motor/rentals', () => {
        it('should create motor rental and return 201', async () => {
            mockPrisma.motorRental.create.mockResolvedValue({
                id: 'mtr-1',
                status: 'ACTIVE',
            });

            const res = await request(app)
                .post('/api/v1/motor/rentals')
                .set('Authorization', authHeader())
                .send({
                    customerName: 'Pak Budi',
                    vehicleId: 'MTR-001',
                    duration: 2,
                    amount: 200000,
                    paymentMethod: 'Cash',
                    notes: 'Deposit KTP',
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('mtr-1');
            expect(res.body.status).toBe('ACTIVE');
        });

        it('should return 400 for missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/motor/rentals')
                .set('Authorization', authHeader())
                .send({ customerName: 'Pak Budi' });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/v1/motor/rentals', () => {
        it('should return list of motor rentals', async () => {
            mockPrisma.motorRental.findMany.mockResolvedValue([
                { id: 'mtr-1', customerName: 'Pak Budi', amount: 200000, status: 'ACTIVE' },
            ]);

            const res = await request(app)
                .get('/api/v1/motor/rentals?date=2026-02-19')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].status).toBe('ACTIVE');
        });
    });

    describe('GET /api/v1/motor/vehicles', () => {
        it('should return list of bike vehicles', async () => {
            mockPrisma.vehicle.findMany.mockResolvedValue([
                { id: 1, plate: 'B 1234 AB', name: 'Honda Beat', status: 'AVAILABLE' },
                { id: 2, plate: 'B 5678 CD', name: 'Yamaha NMAX', status: 'RENTED' },
            ]);

            const res = await request(app)
                .get('/api/v1/motor/vehicles')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].name).toBe('Honda Beat');
        });
    });
});
