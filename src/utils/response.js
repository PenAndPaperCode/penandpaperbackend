'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':      process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers':     'Content-Type,Authorization',
  'Access-Control-Allow-Methods':     'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type':                     'application/json',
};

const ok = (data) => ({
  statusCode: 200,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: true, ...data }),
});

const created = (data) => ({
  statusCode: 201,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: true, ...data }),
});

const badRequest = (message) => ({
  statusCode: 400,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: false, message }),
});

const unauthorized = (message = 'Unauthorized') => ({
  statusCode: 401,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: false, message }),
});

const forbidden = (message = 'Forbidden') => ({
  statusCode: 403,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: false, message }),
});

const notFound = (message = 'Not found') => ({
  statusCode: 404,
  headers: CORS_HEADERS,
  body: JSON.stringify({ success: false, message }),
});

const serverError = (error) => {
  console.error('Internal server error:', error);
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    }),
  };
};

const preflight = () => ({
  statusCode: 200,
  headers: CORS_HEADERS,
  body: '',
});

module.exports = { ok, created, badRequest, unauthorized, forbidden, notFound, serverError, preflight };
