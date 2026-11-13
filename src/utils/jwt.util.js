/**
 * src/utils/jwt.util.js
 * Cryptographic JWT signing, verification, and cookie security policies.
 * Uses jsonwebtoken with native crypto fallback for maximum portability.
 */

const crypto = require('crypto');

let jwtLib;
try {
  jwtLib = require('jsonwebtoken');
} catch {
  jwtLib = null;
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.ENCRYPTION_KEY ||
  'superadmin-impersonation-jwt-secret-key-32b';

/**
 * Standard security configuration for session & impersonation cookies.
 */
const SECURE_COOKIE_OPTIONS = {
  httpOnly: true, // Prevents XSS script access
  secure: process.env.NODE_ENV === 'production', // Transmit only over HTTPS in production
  sameSite: 'strict', // Mitigates CSRF across origins
  path: '/',
  maxAge: 2 * 60 * 60 * 1000, // 2-hour lifetime for active impersonation
};

/**
 * Base64URL encoding helper.
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL decoding helper.
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Native Node HMAC-SHA256 JWT signature generator (fallback).
 */
function nativeSignJwt(payload, secret, expiresInSeconds = 7200) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

/**
 * Native Node HMAC-SHA256 JWT verifier (fallback).
 */
function nativeVerifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signatureB64),
      Buffer.from(expectedSignature)
    )
  ) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('JWT token has expired');
  }

  return payload;
}

/**
 * Signs a JWT payload with an expiration time.
 *
 * @param {Object} payload - Token claims (userId, role, impersonatorId, etc.)
 * @param {number} [expiresInSeconds=7200] - Expiration duration (default 2h)
 * @returns {string} Signed JWT token
 */
function signToken(payload, expiresInSeconds = 7200) {
  if (jwtLib && typeof jwtLib.sign === 'function') {
    return jwtLib.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
  }
  return nativeSignJwt(payload, JWT_SECRET, expiresInSeconds);
}

/**
 * Verifies and decodes a signed JWT token.
 *
 * @param {string} token - Raw JWT string
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
  if (!token) throw new Error('No token provided');
  if (jwtLib && typeof jwtLib.verify === 'function') {
    return jwtLib.verify(token, JWT_SECRET);
  }
  return nativeVerifyJwt(token, JWT_SECRET);
}

module.exports = {
  signToken,
  verifyToken,
  SECURE_COOKIE_OPTIONS,
};
