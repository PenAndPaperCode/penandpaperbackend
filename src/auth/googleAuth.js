'use strict';

/**
 * POST /auth/google
 *
 * Body: { idToken: "<Google ID token from client>" }
 *
 * Flow:
 *   1. Verify the Google ID token with google-auth-library
 *   2. Upsert user record in DynamoDB (create on first login, update lastLoginAt on subsequent)
 *   3. Return a signed JWT the frontend stores and sends as Bearer on every request
 */

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getItem, putItem, updateItem, TABLES } = require('../utils/dynamo');
const { ok, badRequest, unauthorized, serverError, preflight } = require('../utils/response');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // { sub, email, name, picture, ... }
};

const issueJwt = (userId, email) =>
  jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const body = JSON.parse(event.body || '{}');
    const { idToken } = body;

    if (!idToken) return badRequest('idToken is required');

    // ── 1. Verify with Google ─────────────────────────────────────────────
    let payload;
    try {
      payload = await verifyGoogleToken(idToken);
    } catch (err) {
      console.error('Google token verification failed:', err.message);
      return unauthorized('Invalid Google ID token');
    }

    const { sub: googleId, email, name, picture } = payload;

    // ── 2. Upsert user in DDB ─────────────────────────────────────────────
    // Use googleId as a lookup key via GSI, userId (UUID) as the primary key
    const now = new Date().toISOString();

    // Try to find existing user by googleId (GSI: googleId-index)
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    const { ddb } = require('../utils/dynamo');

    const existing = await ddb.send(new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: 'googleId-index',
      KeyConditionExpression: 'googleId = :gid',
      ExpressionAttributeValues: { ':gid': googleId },
      Limit: 1,
    }));

    let user;

    if (existing.Items && existing.Items.length > 0) {
      // Existing user — update lastLoginAt, name, picture (in case they changed)
      user = await updateItem(TABLES.USERS, { userId: existing.Items[0].userId }, {
        lastLoginAt: now,
        name,
        picture,
      });
    } else {
      // New user — create record
      const userId = uuidv4();
      user = {
        userId,
        googleId,
        email,
        name,
        picture,
        mobile: '',
        role: 'customer',
        authProvider: 'google',
        createdAt: now,
        lastLoginAt: now,
      };
      await putItem(TABLES.USERS, user);
    }

    // ── 3. Issue JWT ──────────────────────────────────────────────────────
    const token = issueJwt(user.userId, user.email);

    return ok({
      token,
      user: {
        userId: user.userId,
        email:  user.email,
        name:   user.name,
        picture: user.picture,
      },
    });

  } catch (err) {
    return serverError(err);
  }
};
