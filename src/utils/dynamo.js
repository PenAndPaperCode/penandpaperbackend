'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  USERS:    process.env.USERS_TABLE    || 'pen-and-paper-users',
  PROGRESS: process.env.PROGRESS_TABLE || 'pen-and-paper-progress',
};

// ── Put ──────────────────────────────────────────────────────────────────────
const putItem = async (tableName, item) => {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
};

// ── Get ──────────────────────────────────────────────────────────────────────
const getItem = async (tableName, key) => {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
  return result.Item || null;
};

// ── Update ───────────────────────────────────────────────────────────────────
const updateItem = async (tableName, key, updates) => {
  const fields = Object.keys(updates);
  if (fields.length === 0) return null;

  const expressionParts = fields.map((f) => `#${f} = :${f}`);
  const ExpressionAttributeNames = fields.reduce((acc, f) => ({ ...acc, [`#${f}`]: f }), {});
  const ExpressionAttributeValues = fields.reduce(
    (acc, f) => ({ ...acc, [`:${f}`]: updates[f] }),
    {}
  );

  const result = await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
};

// ── Query ────────────────────────────────────────────────────────────────────
const queryItems = async (tableName, indexName, keyCondition, expressionValues, expressionNames = {}) => {
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
  };
  if (indexName) params.IndexName = indexName;
  if (Object.keys(expressionNames).length > 0) params.ExpressionAttributeNames = expressionNames;

  const result = await ddb.send(new QueryCommand(params));
  return result.Items || [];
};

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteItem = async (tableName, key) => {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: key }));
};

module.exports = { ddb, TABLES, putItem, getItem, updateItem, queryItems, deleteItem };
