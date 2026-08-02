'use strict';

/**
 * POST /auth/login
 *
 * Body: { identifier, password }
 *   - identifier can be email OR username
 *
 * Flow:
 *   1. Validate input
 *   2. Look up user by email or username via GSI
 *   3. Compare password with bcrypt
 *   4. Update lastLoginAt
 *   5. Return JWT + user (without passwordHash)
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryItems, updateItem, TABLES } = require('../utils/dynamo');
const { ok, badRequest, unauthorized, serverError, preflight } = require('../utils/response');

const issueJwt = (userId, email) =>
  jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password, identifier } = body;

    // Support both 'identifier' (new) and 'email' (backward compat)
    const loginId = identifier || email;

    // ── 1. Validate input ─────────────────────────────────────────────────
    if (!loginId || !password) {
      return badRequest('Email/username and password are required');
    }

    // ── 2. Determine if identifier is email or username ───────────────────
    const isEmail = loginId.includes('@');
    let users;

    if (isEmail) {
      users = await queryItems(
        TABLES.USERS,
        'email-index',
        'email = :val',
        { ':val': loginId }
      );
    } else {
      users = await queryItems(
        TABLES.USERS,
        'username-index',
        'username = :val',
        { ':val': loginId.toLowerCase() }
      );
    }

    if (users.length === 0) {
      return unauthorized('Invalid credentials');
    }

    const user = users[0];

    // Check if this is an email/password user
    if (user.authProvider !== 'email' || !user.passwordHash) {
      return unauthorized('This account uses Google sign-in. Please use "Continue with Google".');
    }

    // ── 3. Compare password ───────────────────────────────────────────────
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return unauthorized('Invalid credentials');
    }

    // ── 4. Update lastLoginAt ─────────────────────────────────────────────
    const now = new Date().toISOString();
    const updatedUser = await updateItem(
      TABLES.USERS,
      { userId: user.userId },
      { lastLoginAt: now }
    );

    // ── 5. Issue JWT ──────────────────────────────────────────────────────
    const token = issueJwt(user.userId, user.email);

    // Remove passwordHash before sending response
    const { passwordHash: _, ...userResponse } = updatedUser;

    return ok({
      token,
      user: userResponse,
    });

  } catch (err) {
    return serverError(err);
  }
};
