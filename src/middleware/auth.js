'use strict';

const jwt = require('jsonwebtoken');
const { getItem, TABLES } = require('../utils/dynamo');
const { unauthorized } = require('../utils/response');

/**
 * Verifies Bearer JWT from Authorization header.
 * Returns { user } on success, or a 401 response object on failure.
 */
const verifyToken = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: unauthorized('Missing or malformed Authorization header') };
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch live user record to ensure account still exists
    const user = await getItem(TABLES.USERS, { userId: decoded.userId });
    if (!user) {
      return { error: unauthorized('User no longer exists') };
    }

    return { user };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: unauthorized('Token expired') };
    }
    return { error: unauthorized('Invalid token') };
  }
};

module.exports = { verifyToken };
