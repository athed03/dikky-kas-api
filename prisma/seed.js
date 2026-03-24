require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Users ───────────────────────────────────────────────
    const adminPassword = await bcrypt.hash('admin123', 10);
    const cashierPassword = await bcrypt.hash('password123', 10);
    const supervisorPassword = await bcrypt.hash('super123', 10);

    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: adminPassword,
            role: 'admin',
            name: 'Administrator',
        },
    });

    await prisma.user.upsert({
        where: { username: 'kasir1' },
        update: {},
        create: {
            username: 'kasir1',
            password: cashierPassword,
            role: 'cashier',
            name: 'Budi Santoso',
        },
    });

    await prisma.user.upsert({
        where: { username: 'supervisor1' },
        update: {},
        create: {
            username: 'supervisor1',
            password: supervisorPassword,
            role: 'supervisor',
            name: 'Pak Dikky',
        },
    });

    console.log('✅ Users seeded');

    // ─── Products (Resto Menu) ───────────────────────────────
    const products = [
        { name: 'Nasi Goreng', price: 25000, category: 'Main' },
        { name: 'Mie Goreng', price: 22000, category: 'Main' },
        { name: 'Ayam Bakar', price: 35000, category: 'Main' },
        { name: 'Es Teh Manis', price: 8000, category: 'Drink' },
        { name: 'Es Jeruk', price: 10000, category: 'Drink' },
        { name: 'Kopi Hitam', price: 7000, category: 'Drink' },
        { name: 'Air Mineral', price: 5000, category: 'Drink' },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { id: products.indexOf(product) + 1 },
            update: {},
            create: product,
        });
    }

    console.log('✅ Products seeded');

    // ─── Vehicles (Motor/Bike + Mobil/Car) ─────────────────────
    const vehicles = [
        { plate: 'B 1234 AB', name: 'Honda Beat', type: 'bike' },
        { plate: 'B 5678 CD', name: 'Yamaha NMAX', type: 'bike' },
        { plate: 'B 9012 EF', name: 'Honda Vario', type: 'bike' },
        { plate: 'B 3456 GH', name: 'Yamaha Mio', type: 'bike' },
        { plate: 'DK 1234 AB', name: 'Toyota Avanza', type: 'car' },
        { plate: 'DK 5678 CD', name: 'Daihatsu Xenia', type: 'car' },
    ];

    for (const vehicle of vehicles) {
        await prisma.vehicle.upsert({
            where: { plate: vehicle.plate },
            update: {},
            create: vehicle,
        });
    }

    console.log('✅ Vehicles seeded');
    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
