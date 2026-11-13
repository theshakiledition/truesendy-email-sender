/**
 * src/utils/crypto.js
 * Cryptographic utility for securing sensitive credentials (SMTP/IMAP passwords, tokens)
 * Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes (96 bits) is the recommended standard for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes (128 bits) authentication tag

/**
 * Derives a consistent 32-byte key from the environment variable.
 * Supports 64-character hex strings or hashes arbitrary secret strings to 256 bits.
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined.');
  }

  // If a 64-char hex string is provided (32 bytes), parse it directly
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Otherwise, hash the secret with SHA-256 to ensure an exact 32-byte key
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` (all encoded as hex).
 *
 * @param {string} plaintext - The plain password or secret to encrypt.
 * @returns {string} The serialized encrypted string.
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Cannot encrypt empty or non-string value.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV, AuthTag, and Ciphertext separated by colons
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a serialized AES-256-GCM string (`iv:authTag:ciphertext`).
 * Verifies ciphertext authenticity before releasing plaintext.
 *
 * @param {string} encryptedPayload - The serialized encrypted string.
 * @returns {string} The decrypted plaintext.
 */
function decrypt(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Cannot decrypt empty or non-string payload.');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Corrupted or invalid IV length.');
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Corrupted or invalid Auth Tag length.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
};
