'use strict';

/**
 * GET /progress
 *
 * Returns all solved problems for the authenticated user as a flat map:
 * { "DSA_Binary Search_basics_Search Insert Position": true, ... }
 *
 * This matches exactly the doneStatus shape the frontend reads from localStorage,
 * so the UI can hydrate from the backend with zero changes to the frontend logic.
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
      null, // no GSI — query on PK directly
      'userId = :uid',
      { ':uid': user.userId }
    );

    // Build the doneStatus map the frontend expects
    const doneStatus = items.reduce((acc, item) => {
      acc[item.problemKey] = true;
      return acc;
    }, {});

    return ok({ doneStatus, total: items.length });

  } catch (err) {
    return serverError(err);
  }
};
