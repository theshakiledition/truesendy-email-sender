/**
 * src/workers/throttler.js
 * Redis-based per-account cooldown, daily sending counters, and distributed lock manager.
 * Enforces humanized, randomized intervals (e.g., 3 to 9 minutes) independently per email inbox.
 */

const THROTTLE_PREFIX = 'email:cooldown:';
const LOCK_PREFIX = 'email:lock:';
const DAILY_SENT_PREFIX = 'email:daily_sent:';
const ROUND_ROBIN_PREFIX = 'campaign:round_robin:';

/**
 * Returns the Redis key for tracking daily sends for an account for the current UTC date.
 * Format: `email:daily_sent:<accountId>:YYYY-MM-DD`
 */
function getDailySentKey(accountId, date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${DAILY_SENT_PREFIX}${accountId}:${dateStr}`;
}

/**
 * Gets the current daily sent count for an inbox from Redis.
 *
 * @param {Object} redisClient - IORedis instance
 * @param {string} accountId - ConnectedEmail UUID
 * @returns {Promise<number>} Current count sent today
 */
async function getAccountDailySentCount(redisClient, accountId) {
  const key = getDailySentKey(accountId);
  const count = await redisClient.get(key);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Atomically increments the daily sent count for an inbox in Redis.
 * Automatically sets a 48-hour expiration on the key.
 *
 * @param {Object} redisClient
 * @param {string} accountId
 * @returns {Promise<number>} Updated count for today
 */
async function incrementAccountDailySentCount(redisClient, accountId) {
  const key = getDailySentKey(accountId);
  const newCount = await redisClient.incr(key);

  if (newCount === 1) {
    // 48 hours TTL ensures it cleans up automatically
    await redisClient.expire(key, 172800);
  }

  return newCount;
}

/**
 * Calculates a randomized jitter interval between minSeconds and maxSeconds.
 * Defaults to 3 to 9 minutes (180 to 540 seconds) to mimic human behavior.
 *
 * @param {number} minSeconds - Minimum wait in seconds (default 180)
 * @param {number} maxSeconds - Maximum wait in seconds (default 540)
 * @returns {number} Delay in milliseconds
 */
function getRandomJitterMs(minSeconds = 180, maxSeconds = 540) {
  const min = Math.min(minSeconds, maxSeconds);
  const max = Math.max(minSeconds, maxSeconds);
  const randomSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomSeconds * 1000;
}

/**
 * Checks how much cooldown time remains for a given connected email inbox.
 *
 * @param {Object} redisClient - IORedis instance
 * @param {string} emailAccountId - ConnectedEmail UUID
 * @returns {Promise<number>} Remaining milliseconds (0 if ready to send)
 */
async function getAccountCooldownRemaining(redisClient, emailAccountId) {
  const key = `${THROTTLE_PREFIX}${emailAccountId}`;
  const nextAvailableAt = await redisClient.get(key);

  if (!nextAvailableAt) {
    return 0;
  }

  const remainingMs = parseInt(nextAvailableAt, 10) - Date.now();
  return remainingMs > 0 ? remainingMs : 0;
}

/**
 * Sets a new randomized cooldown period in Redis for a specific inbox.
 *
 * @param {Object} redisClient - IORedis instance
 * @param {string} emailAccountId - ConnectedEmail UUID
 * @param {number} minSeconds - Minimum interval (e.g. 180s / 3 min)
 * @param {number} maxSeconds - Maximum interval (e.g. 540s / 9 min)
 * @returns {Promise<number>} Applied delay in milliseconds
 */
async function setAccountCooldown(redisClient, emailAccountId, minSeconds = 180, maxSeconds = 540) {
  const key = `${THROTTLE_PREFIX}${emailAccountId}`;
  const delayMs = getRandomJitterMs(minSeconds, maxSeconds);
  const nextAvailableAt = Date.now() + delayMs;

  // Store timestamp with a TTL slightly larger than delayMs to avoid key leaks
  await redisClient.set(key, nextAvailableAt, 'PX', delayMs + 120000);

  return delayMs;
}

/**
 * Gets the next index for campaign round-robin rotation.
 *
 * @param {Object} redisClient
 * @param {string} campaignId
 * @returns {Promise<number>} Incremented round-robin index
 */
async function getNextRoundRobinIndex(redisClient, campaignId) {
  const key = `${ROUND_ROBIN_PREFIX}${campaignId}`;
  return await redisClient.incr(key);
}

/**
 * Acquires a distributed lock for an inbox using Redis SET NX.
 * Prevents race conditions where two concurrent workers grab the same inbox at once.
 *
 * @param {Object} redisClient
 * @param {string} emailAccountId
 * @param {number} ttlMs - Lock TTL (e.g. 30 seconds)
 * @returns {Promise<boolean>} True if lock acquired
 */
async function acquireAccountLock(redisClient, emailAccountId, ttlMs = 30000) {
  const lockKey = `${LOCK_PREFIX}${emailAccountId}`;
  const result = await redisClient.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Releases the distributed lock.
 */
async function releaseAccountLock(redisClient, emailAccountId) {
  const lockKey = `${LOCK_PREFIX}${emailAccountId}`;
  await redisClient.del(lockKey);
}

module.exports = {
  getDailySentKey,
  getAccountDailySentCount,
  incrementAccountDailySentCount,
  getRandomJitterMs,
  getAccountCooldownRemaining,
  setAccountCooldown,
  getNextRoundRobinIndex,
  acquireAccountLock,
  releaseAccountLock,
};
