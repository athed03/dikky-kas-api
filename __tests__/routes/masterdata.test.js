const request = require('supertest');

const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');
const { authHeader } = require('../helpers/authHelper');

describe('Master Data Routes', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    describe('GET /api/v1/products', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/v1/products');
            expect(res.status).toBe(401);
        });

        it('should return list of active products', async () => {
            mockPrisma.product.findMany.mockResolvedValue([
                { id: 1, name: 'Nasi Goreng', price: 25000, category: 'food', isActive: true },
                { id: 2, name: 'Es Teh', price: 5000, category: 'drink', isActive: true },
            ]);

            const res = await request(app)
                .get('/api/v1/products')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].name).toBe('Nasi Goreng');
            expect(res.body[1].name).toBe('Es Teh');
        });

        it('should return empty array when no products', async () => {
            mockPrisma.product.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/v1/products')
                .set('Authorization', authHeader());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(0);
        });
    });
});
