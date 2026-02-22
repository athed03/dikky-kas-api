// Shared test setup
// Note: This file runs via setupFiles (before jest globals are available)
// so we cannot use beforeAll/afterAll here.
// The prisma mock is handled per-test via jest.mock() in each test file.
// Console suppression is done inline.
