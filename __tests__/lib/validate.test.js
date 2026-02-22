const { z } = require('zod');
const { validate } = require('../../lib/validate');

describe('lib/validate', () => {
    const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
    });

    const middleware = validate(testSchema);

    it('should call next() with valid body and set parsed data', () => {
        const req = { body: { name: 'Budi', age: 25 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body).toEqual({ name: 'Budi', age: 25 });
    });

    it('should return 400 with validation errors for invalid body', () => {
        const req = { body: { name: '', age: -1 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Validation failed',
                details: expect.any(Array),
            })
        );
    });

    it('should return 400 for missing required fields', () => {
        const req = { body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for wrong field types', () => {
        const req = { body: { name: 123, age: 'not-a-number' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
