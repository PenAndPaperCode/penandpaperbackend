'use strict';

/**
 * GET /users/me
 *
 * Returns the authenticated user's profile.
 * Auth: Bearer JWT required.
 */

const { verifyToken } = require('../middleware/auth');
const { ok, serverError, preflight } = require('../utils/response');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const { user, error } = await verifyToken(event);
    if (error) return error;

    return ok({
      user: {
        userId:      user.userId,
        email:       user.email,
        name:        user.name,
        picture:     user.picture,
        createdAt:   user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (err) {
    return serverError(err);
  }
};
