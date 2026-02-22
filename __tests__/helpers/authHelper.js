/**
 * Helper to generate a valid JWT token for test requests.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const testUser = {
    id: 1,
    username: 'kasir1',
    role: 'cashier',
    name: 'Test Cashier',
};

function getAuthToken(user = testUser) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

function authHeader(user) {
    return `Bearer ${getAuthToken(user)}`;
}

module.exports = { getAuthToken, authHeader, testUser };
