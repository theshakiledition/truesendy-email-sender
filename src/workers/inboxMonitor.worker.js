/**
 * src/workers/inboxMonitor.worker.js
 * Continuous background daemon running the IMAP inbox monitor loop.
 */

const { checkAllConnectedInboxes } = require('../services/inboxMonitor.service');

const POLL_INTERVAL_MS = parseInt(process.env.INBOX_MONITOR_INTERVAL_MS || '60000', 10); // Default 60s
let isRunning = true;

/**
 * Pauses execution for a specified duration with interrupt capability.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main polling loop.
 */
async function startMonitorLoop() {
  console.log(`[InboxMonitor Worker] Started. Polling inboxes every ${POLL_INTERVAL_MS / 1000} seconds.`);

  while (isRunning) {
    const startTime = Date.now();

    try {
      await checkAllConnectedInboxes();
    } catch (loopError) {
      console.error('[InboxMonitor Worker] Unexpected loop error:', loopError);
    }

    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(POLL_INTERVAL_MS - elapsed, 5000);

    if (isRunning) {
      await sleep(waitTime);
    }
  }

  console.log('[InboxMonitor Worker] Stopped cleanly.');
}

// Handle graceful shutdown signals
function shutdown(signal) {
  console.log(`\n[InboxMonitor Worker] Received ${signal}. Shutting down gracefully...`);
  isRunning = false;
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startMonitorLoop();
}

module.exports = {
  startMonitorLoop,
};
