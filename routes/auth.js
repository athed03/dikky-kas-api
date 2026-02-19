const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { generateToken } = require('../lib/auth');
const { validate } = require('../lib/validate');
const { success, error } = require('../lib/response');

const router = express.Router();

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: kasir1
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return error(res, 'Invalid username or password', 401);
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return error(res, 'Invalid username or password', 401);
        }

        const token = generateToken(user);

        return success(res, {
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
