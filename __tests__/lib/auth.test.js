const jwt = require('jsonwebtoken');
const { generateToken, authenticateToken } = require('../../lib/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

describe('lib/auth', () => {
    describe('generateToken()', () => {
        it('should return a valid JWT containing user info', () => {
            const user = { id: 1, username: 'kasir1', role: 'cashier' };
            const token = generateToken(user);

            expect(typeof token).toBe('string');
            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.id).toBe(1);
            expect(decoded.username).toBe('kasir1');
            expect(decoded.role).toBe('cashier');
        });
    });

    describe('authenticateToken()', () => {
        const mockNext = jest.fn();
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should call next() and set req.user with valid token', () => {
            const user = { id: 1, username: 'kasir1', role: 'cashier' };
            const token = generateToken(user);
            const req = { headers: { authorization: `Bearer ${token}` } };

            authenticateToken(req, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(1);
            expect(req.user.username).toBe('kasir1');
        });

        it('should return 401 if no authorization header', () => {
            const req = { headers: {} };

            authenticateToken(req, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 if token is invalid', () => {
            const req = { headers: { authorization: 'Bearer invalid-token' } };

            authenticateToken(req, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 if token is expired', () => {
            const expiredToken = jwt.sign(
                { id: 1, username: 'kasir1', role: 'cashier' },
                JWT_SECRET,
                { expiresIn: '0s' }
            );
            const req = { headers: { authorization: `Bearer ${expiredToken}` } };

            // Wait a tick to ensure token expires
            authenticateToken(req, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
