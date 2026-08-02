'use strict';

/**
 * POST /auth/register
 *
 * Body: { name, email, mobile, password, confirmPassword }
 *
 * Flow:
 *   1. Validate all fields (required, password length, email format, passwords match)
 *   2. Check if user with email already exists via GSI
 *   3. Hash password with bcryptjs
 *   4. Create user record with email auth provider
 *   5. Return JWT + user (without passwordHash)
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { putItem, queryItems, TABLES } = require('../utils/dynamo');
const { ok, badRequest, serverError, preflight } = require('../utils/response');

const issueJwt = (userId, email) =>
  jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, email, mobile, password, confirmPassword } = body;

    // ── 1. Validate input ─────────────────────────────────────────────────
    if (!name || !email || !mobile || !password || !confirmPassword) {
      return badRequest('All fields are required (name, email, mobile, password, confirmPassword)');
    }

    if (!validateEmail(email)) {
      return badRequest('Invalid email format');
    }

    if (password.length < 8) {
      return badRequest('Password must be at least 8 characters');
    }

    if (password !== confirmPassword) {
      return badRequest('Passwords do not match');
    }

    // ── 2. Check if email already exists ──────────────────────────────────
    const existingUsers = await queryItems(
      TABLES.USERS,
      'email-index',
      'email = :email',
      { ':email': email }
    );

    if (existingUsers.length > 0) {
      return badRequest('Email already registered');
    }

    // ── 3. Hash password ──────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);

    // ── 4. Create user record ─────────────────────────────────────────────
    const now = new Date().toISOString();
    const userId = uuidv4();

    const user = {
      userId,
      name,
      email,
      mobile,
      passwordHash,
      authProvider: 'email',
      createdAt: now,
      lastLoginAt: now,
    };

    await putItem(TABLES.USERS, user);

    // ── 5. Issue JWT ──────────────────────────────────────────────────────
    const token = issueJwt(userId, email);

    // Remove passwordHash before sending response
    const { passwordHash: _, ...userResponse } = user;

    return ok({
      token,
      user: userResponse,
    });

  } catch (err) {
    return serverError(err);
  }
};
