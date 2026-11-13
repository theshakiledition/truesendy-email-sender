/**
 * src/utils/password.util.js
 * Secure cryptographic password hashing using Node.js scrypt.
 */

const crypto = require('crypto');

/**
 * Hashes a plaintext password with a random salt.
 * Format: <salt-hex>:<hash-hex>
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored <salt-hex>:<hash-hex>.
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
