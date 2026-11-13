/**
 * src/workers/worker-system.js
 * BullMQ maintenance worker for recurring system tasks (e.g. daily Webshare proxy sync).
 */

const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const { syncWebshareProxies } = require('../utils/proxySync.util');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);
const systemQueue = new Queue('system-tasks', { connection: redisConnection });

/**
 * Initializes BullMQ v6 Job Schedulers.
 * Runs once upon worker startup to ensure cron definitions are upserted into Redis.
 */
async function initSchedulers() {
  try {
    console.log('[SystemWorker] Registering automated maintenance job schedulers in BullMQ...');

    // BullMQ v6 exact syntax to run every 24 hours at midnight (0 0 * * *)
    await systemQueue.upsertJobScheduler(
      'daily-proxy-sync',
      { pattern: '0 0 * * *' },
      'sync-proxies',
      {},
      {}
    );

    console.log("[SystemWorker] Successfully configured 'daily-proxy-sync' (pattern: '0 0 * * *').");
  } catch (err) {
    console.error('[SystemWorker] Failed to configure job scheduler:', err.message);
  }
}

/**
 * System Tasks Worker Process
 */
const systemWorker = new Worker(
  'system-tasks',
  async (job) => {
    console.log(`[SystemWorker] Received job '${job.name}' (ID: ${job.id})`);

    switch (job.name) {
      case 'sync-proxies': {
        const result = await syncWebshareProxies();
        if (!result.success) {
          throw new Error(`Webshare proxy sync failed: ${result.error}`);
        }
        return result;
      }

      default:
        console.warn(`[SystemWorker] Unhandled job name: '${job.name}'`);
        return { status: 'IGNORED', jobName: job.name };
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // System maintenance tasks run sequentially
  }
);

systemWorker.on('completed', (job, result) => {
  console.log(`[SystemWorker] Job '${job.name}' completed successfully.`);
  if (result?.stats) {
    console.log('[SystemWorker] Result stats:', JSON.stringify(result.stats));
  }
});

systemWorker.on('failed', (job, err) => {
  console.error(`[SystemWorker] Job '${job?.name}' failed with error:`, err.message);
});

// Boot up scheduler and listener
async function startWorker() {
  await initSchedulers();
  console.log('[SystemWorker] System tasks worker is active and listening on queue: system-tasks');
}

startWorker();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[SystemWorker] Received ${signal}. Shutting down worker...`);
  await systemWorker.close();
  await systemQueue.close();
  await redisConnection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = {
  systemWorker,
  systemQueue,
  initSchedulers,
};
