const { success, error, getTodayDate, parseDate } = require('../../lib/response');

describe('lib/response', () => {
    describe('success()', () => {
        it('should return 200 with data by default', () => {
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            success(res, { foo: 'bar' });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ foo: 'bar' });
        });

        it('should return custom status code', () => {
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            success(res, { id: '123' }, 201);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: '123' });
        });
    });

    describe('error()', () => {
        it('should return 500 with error message by default', () => {
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            error(res, 'Something went wrong');

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
        });

        it('should return custom status code', () => {
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            error(res, 'Not found', 404);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
        });
    });

    describe('getTodayDate()', () => {
        it('should return date in YYYY-MM-DD format', () => {
            const result = getTodayDate();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('parseDate()', () => {
        it('should parse date string to midnight UTC', () => {
            const result = parseDate('2026-02-19');
            expect(result).toEqual(new Date('2026-02-19T00:00:00.000Z'));
            expect(result.getUTCHours()).toBe(0);
            expect(result.getUTCMinutes()).toBe(0);
        });
    });
});
