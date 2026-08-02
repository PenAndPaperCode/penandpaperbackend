'use strict';

/**
 * POST /progress/mark
 *
 * Mark a problem as done or undone for the authenticated user.
 *
 * Body:
 * {
 *   problemKey:  "DSA_Binary Search_basics_Search Insert Position",
 *   category:    "DSA",
 *   topic:       "Binary Search",
 *   subtopic:    "basics",
 *   problemName: "Search Insert Position",
 *   isDone:      true | false
 * }
 *
 * DynamoDB schema (pen-and-paper-progress):
 *   PK: userId      (String)
 *   SK: problemKey  (String)
 */

const { verifyToken } = require('../middleware/auth');
const { putItem, deleteItem, TABLES } = require('../utils/dynamo');
const { ok, badRequest, serverError, preflight } = require('../utils/response');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const { user, error } = await verifyToken(event);
    if (error) return error;

    const body = JSON.parse(event.body || '{}');
    const { problemKey, category, topic, subtopic, problemName, isDone } = body;

    if (!problemKey || typeof isDone !== 'boolean') {
      return badRequest('problemKey (string) and isDone (boolean) are required');
    }
    if (!category || !problemName) {
      return badRequest('category and problemName are required');
    }

    const now = new Date().toISOString();

    if (isDone) {
      await putItem(TABLES.PROGRESS, {
        userId:      user.userId,
        problemKey,
        category,
        topic:       topic   || '',
        subtopic:    subtopic || '',
        problemName,
        isDone:      true,
        updatedAt:   now,
      });
    } else {
      // isDone = false → remove the record
      await deleteItem(TABLES.PROGRESS, { userId: user.userId, problemKey });
    }

    return ok({ problemKey, isDone, updatedAt: now });

  } catch (err) {
    return serverError(err);
  }
};
