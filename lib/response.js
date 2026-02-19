/**
 * Standardized API response helpers
 */

function success(res, data, statusCode = 200) {
    return res.status(statusCode).json(data);
}

function error(res, message, statusCode = 500) {
    return res.status(statusCode).json({ error: message });
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Parse date string to Date object (start of day UTC)
 */
function parseDate(dateStr) {
    return new Date(dateStr + 'T00:00:00.000Z');
}

module.exports = { success, error, getTodayDate, parseDate };
