const prisma = require('./prisma');

/**
 * Upsert balance for a given category.
 *
 * @param {string} category  - "resto", "mobil", "motor", "edc", "moneychanger", "lainnya"
 * @param {number} amount    - transaction amount
 * @param {string} type      - "IN" or "OUT"
 * @param {object} [extra]   - optional { vehicleId, fee }
 */
async function updateBalance(category, amount, type, extra = {}) {
    const delta = type === 'IN' ? amount : -amount;
    const vehicleId = extra.vehicleId || '';
    const feeIncrement = extra.fee || 0;

    await prisma.balance.upsert({
        where: { category_vehicleId: { category, vehicleId } },
        update: {
            amount: { increment: delta },
            totalFee: { increment: feeIncrement },
        },
        create: {
            category,
            vehicleId,
            amount: delta,
            totalFee: feeIncrement,
        },
    });
}

module.exports = { updateBalance };
