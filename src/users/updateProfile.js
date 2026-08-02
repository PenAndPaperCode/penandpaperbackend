'use strict';

/**
 * PUT /users/me
 *
 * Body: { name?, mobile? }
 *
 * Flow:
 *   1. Verify JWT from Authorization header
 *   2. Validate input (at least one field)
 *   3. Update user record
 *   4. Return updated user
 */

const { verifyToken } = require('../middleware/auth');
const { updateItem, TABLES } = require('../utils/dynamo');
const { ok, badRequest, serverError, preflight } = require('../utils/response');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    // ── 1. Verify JWT ─────────────────────────────────────────────────────
    const { user, error } = await verifyToken(event);
    if (error) return error;

    // ── 2. Validate input ─────────────────────────────────────────────────
    const body = JSON.parse(event.body || '{}');
    const { name, mobile } = body;

    // Build updates object only with provided fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (mobile !== undefined) updates.mobile = mobile;

    if (Object.keys(updates).length === 0) {
      return badRequest('At least one field (name or mobile) is required');
    }

    // ── 3. Update user record ─────────────────────────────────────────────
    const updatedUser = await updateItem(
      TABLES.USERS,
      { userId: user.userId },
      updates
    );

    // ── 4. Return updated user ────────────────────────────────────────────
    // Remove passwordHash if present
    const { passwordHash: _, ...userResponse } = updatedUser;

    return ok({
      user: userResponse,
    });

  } catch (err) {
    return serverError(err);
  }
};
