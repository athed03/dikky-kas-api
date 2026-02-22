const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock prisma before requiring app
const { mockPrisma, resetAllMocks } = require('../helpers/mockPrisma');
jest.mock('../../lib/prisma', () => mockPrisma);

const app = require('../../api/index');

describe('POST /api/v1/auth/login', () => {
    beforeEach(() => {
        resetAllMocks();
    });

    it('should return 200 with token and user on valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            username: 'kasir1',
            password: hashedPassword,
            role: 'cashier',
            name: 'Budi Santoso',
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ username: 'kasir1', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user).toEqual({
            id: 1,
            username: 'kasir1',
            role: 'cashier',
            name: 'Budi Santoso',
        });
    });

    it('should return 401 when user not found', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ username: 'nonexistent', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid username or password');
    });

    it('should return 401 when password is wrong', async () => {
        const hashedPassword = await bcrypt.hash('correct-pass', 10);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            username: 'kasir1',
            password: hashedPassword,
            role: 'cashier',
            name: 'Budi Santoso',
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ username: 'kasir1', password: 'wrong-pass' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid username or password');
    });

    it('should return 400 on empty body', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
    });
});
