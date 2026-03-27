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
    centralAccount: { ...createModelMock(), upsert: jest.fn().mockResolvedValue({ id: 'mock-id' }) },
    centralMovement: createModelMock(),
    $transaction: jest.fn(async (fn) => fn(mockPrisma)),
};

/**
 * Reset all mocks to their default state
 */
function resetAllMocks() {
    for (const [key, model] of Object.entries(mockPrisma)) {
        if (key === '$transaction') continue; // skip $transaction
        for (const fn of Object.values(model)) {
            if (typeof fn.mockReset === 'function') {
                fn.mockReset();
                fn.mockResolvedValue(null);
            }
        }
    }
    // Restore default findMany to return []
    for (const [key, model] of Object.entries(mockPrisma)) {
        if (key === '$transaction') continue;
        model.findMany.mockResolvedValue([]);
    }
    // Restore upsert defaults
    mockPrisma.balance.upsert.mockResolvedValue({ id: 'mock-id' });
    mockPrisma.centralAccount.upsert.mockResolvedValue({ id: 'mock-id' });
    // Restore $transaction as passthrough
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
}

module.exports = { mockPrisma, resetAllMocks };
