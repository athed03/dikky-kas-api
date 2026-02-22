/**
 * Shared Prisma mock factory.
 * Each model gets jest.fn() stubs for common operations.
 */
function createModelMock() {
    return {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        update: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        delete: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    };
}

const mockPrisma = {
    user: createModelMock(),
    dailySession: createModelMock(),
    order: createModelMock(),
    mobilTransaction: createModelMock(),
    motorRental: createModelMock(),
    edcTransaction: createModelMock(),
    moneyChangerTransaction: createModelMock(),
    cashTransaction: createModelMock(),
    balance: { ...createModelMock(), upsert: jest.fn().mockResolvedValue({ id: 'mock-id' }) },
    product: createModelMock(),
    vehicle: createModelMock(),
};

/**
 * Reset all mocks to their default state
 */
function resetAllMocks() {
    for (const model of Object.values(mockPrisma)) {
        for (const fn of Object.values(model)) {
            if (typeof fn.mockReset === 'function') {
                fn.mockReset();
                fn.mockResolvedValue(null);
            }
        }
    }
    // Restore default findMany to return []
    for (const model of Object.values(mockPrisma)) {
        model.findMany.mockResolvedValue([]);
    }
}

module.exports = { mockPrisma, resetAllMocks };
