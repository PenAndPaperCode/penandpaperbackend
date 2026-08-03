'use strict';

/**
 * GET /admin/users
 *
 * Requires: Bearer JWT (admin role)
 *
 * Flow:
 *   1. Verify JWT token
 *   2. Check if user has admin role
 *   3. Scan users table
 *   4. Return all users without passwordHash
 */

const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ddb, TABLES } = require('../utils/dynamo');
const { ok, forbidden, preflight } = require('../utils/response');
const { verifyToken } = require('../middleware/auth');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    // ── 1. Verify token ───────────────────────────────────────────────────
    const { user, error } = await verifyToken(event);
    if (error) return error;

    // ── 2. Check admin role ───────────────────────────────────────────────
    if (user.role !== 'admin') {
      return forbidden('Access denied: admin role required');
    }

    // ── 3. Scan users table ───────────────────────────────────────────────
    const result = await ddb.send(new ScanCommand({
      TableName: TABLES.USERS
    }));

    // ── 4. Remove passwordHash from all users ────────────────────────────
    const users = (result.Items || []).map(u => {
      const { passwordHash, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });

    return ok({
      users,
      total: users.length,
    });

  } catch (err) {
    console.error('Error in getUsers:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
      }),
    };
  }
};
