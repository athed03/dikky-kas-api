require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../lib/swagger');

// Route modules
const authRoutes = require('../routes/auth');
const dailyRoutes = require('../routes/daily');
const restoRoutes = require('../routes/resto');
const mobilRoutes = require('../routes/mobil');
const motorRoutes = require('../routes/motor');
const transactionRoutes = require('../routes/transactions');
const masterdataRoutes = require('../routes/masterdata');

const app = express();

// ─── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Swagger Docs ──────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Dikky Kas API Docs',
}));

// ─── API Routes (v1) ───────────────────────────────────────
const v1 = express.Router();

v1.use('/auth', authRoutes);
v1.use('/daily', dailyRoutes);
v1.use('/resto', restoRoutes);
v1.use('/mobil', mobilRoutes);
v1.use('/motor', motorRoutes);
v1.use('/transactions', transactionRoutes);
v1.use('/', masterdataRoutes); // /products mounted at root of v1

app.use('/api/v1', v1);

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Root Route ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.redirect('/api/docs');
});

// ─── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server (local dev only, Vercel handles this in production) ──
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Dikky Kas API running at http://localhost:${PORT}`);
        console.log(`📋 Health: http://localhost:${PORT}/api/health`);
        console.log(`🔑 Login:  POST http://localhost:${PORT}/api/v1/auth/login`);
    });
}

// Export for Vercel serverless
module.exports = app;
