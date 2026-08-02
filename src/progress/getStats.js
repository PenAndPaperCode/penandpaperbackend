'use strict';

/**
 * GET /progress/stats
 *
 * Returns summary stats for the authenticated user:
 * {
 *   total: 42,
 *   byCategory: {
 *     "DSA": 28,
 *     "HLD": 5,
 *     "LLD": 4,
 *     "Machine Coding": 3,
 *     "MultiThreading": 2
 *   },
 *   lastActivity: "2026-08-01T12:00:00.000Z"
 * }
 */

const { verifyToken } = require('../middleware/auth');
const { queryItems, TABLES } = require('../utils/dynamo');
const { ok, serverError, preflight } = require('../utils/response');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const { user, error } = await verifyToken(event);
    if (error) return error;

    const items = await queryItems(
      TABLES.PROGRESS,
      null,
      'userId = :uid',
      { ':uid': user.userId }
    );

    // Aggregate by category
    const byCategory = {};
    let lastActivity = null;

    for (const item of items) {
      const cat = item.category || 'Unknown';
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      if (!lastActivity || item.updatedAt > lastActivity) {
        lastActivity = item.updatedAt;
      }
    }

    return ok({
      total: items.length,
      byCategory,
      lastActivity,
    });

  } catch (err) {
    return serverError(err);
  }
};
