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

const registerSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.string().optional()
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

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, name]
 *             properties:
 *               username:
 *                 type: string
 *                 example: kasirbaru
 *               password:
 *                 type: string
 *                 example: password123
 *               name:
 *                 type: string
 *                 example: John Doe
 *               role:
 *                 type: string
 *                 example: cashier
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Username already exists
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return error(res, 'Username already exists', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: role || 'cashier',
            },
        });

        return success(res, {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
        }, 201);
    } catch (err) {
        console.error('Register error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
