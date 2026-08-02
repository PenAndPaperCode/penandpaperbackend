'use strict';

/**
 * POST /auth/register
 *
 * Body: { username, name, email, mobile, password, confirmPassword }
 *
 * Flow:
 *   1. Validate all fields (required, password length, email format, passwords match, username format)
 *   2. Check if email already exists via GSI
 *   3. Check if username already exists via GSI
 *   4. Hash password with bcryptjs
 *   5. Create user record with email auth provider
 *   6. Return JWT + user (without passwordHash)
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

const validateUsername = (username) => {
  // 3-20 chars, lowercase letters, numbers, underscores, dots only
  const usernameRegex = /^[a-z0-9_.]{3,20}$/;
  return usernameRegex.test(username);
};

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const body = JSON.parse(event.body || '{}');
    const { username, name, email, mobile, password, confirmPassword } = body;

    // ── 1. Validate input ─────────────────────────────────────────────────
    if (!username || !name || !email || !mobile || !password || !confirmPassword) {
      return badRequest('All fields are required (username, name, email, mobile, password, confirmPassword)');
    }

    if (!validateUsername(username)) {
      return badRequest('Username must be 3-20 characters, lowercase letters, numbers, underscores, or dots only');
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
    const existingEmail = await queryItems(
      TABLES.USERS,
      'email-index',
      'email = :email',
      { ':email': email }
    );

    if (existingEmail.length > 0) {
      return badRequest('Email already registered');
    }

    // ── 3. Check if username already exists ───────────────────────────────
    const existingUsername = await queryItems(
      TABLES.USERS,
      'username-index',
      'username = :username',
      { ':username': username }
    );

    if (existingUsername.length > 0) {
      return badRequest('Username already taken');
    }

    // ── 4. Hash password ──────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);

    // ── 5. Create user record ─────────────────────────────────────────────
    const now = new Date().toISOString();
    const userId = uuidv4();

    const user = {
      userId,
      username,
      name,
      email,
      mobile,
      passwordHash,
      authProvider: 'email',
      createdAt: now,
      lastLoginAt: now,
    };

    await putItem(TABLES.USERS, user);

    // ── 6. Issue JWT ──────────────────────────────────────────────────────
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
