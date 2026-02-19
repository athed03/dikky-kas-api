const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

// Reuse Prisma Client across serverless function invocations (warm starts)
const globalForPrisma = globalThis;

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma;

module.exports = prisma;
