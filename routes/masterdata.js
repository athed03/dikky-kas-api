const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../lib/auth');
const { success, error } = require('../lib/response');

const router = express.Router();
router.use(authenticateToken);

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Master Data]
 *     summary: Get products (menu items)
 *     responses:
 *       200:
 *         description: List of active products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   price:
 *                     type: number
 *                   category:
 *                     type: string
 */
router.get('/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });

        return success(res, products);
    } catch (err) {
        console.error('Get products error:', err);
        return error(res, 'Internal server error');
    }
});

/**
 * @swagger
 * /vehicles:
 *   get:
 *     tags: [Master Data]
 *     summary: Get vehicles (bikes and cars)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [bike, car]
 *         description: Filter by vehicle type
 *     responses:
 *       200:
 *         description: List of vehicles
 */
router.get('/vehicles', async (req, res) => {
    try {
        const where = {};
        if (req.query.type) {
            where.type = req.query.type;
        }

        const vehicles = await prisma.vehicle.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        return success(res, vehicles);
    } catch (err) {
        console.error('Get vehicles error:', err);
        return error(res, 'Internal server error');
    }
});

module.exports = router;
