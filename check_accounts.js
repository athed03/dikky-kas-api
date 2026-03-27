require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
    const accounts = await prisma.centralAccount.findMany();
    console.log('Central accounts:', JSON.stringify(accounts, null, 2));
    await prisma.$disconnect();
})();
