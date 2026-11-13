/**
 * src/lib/bullBoard.js
 * Bull-Board server adapter & queue registration module.
 * Exposes live Redis queues securely for the Superadmin dashboard.
 */

const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const sharedRedisConnection = new Redis(redisConfig);

// Initialize application queues to monitor
const sendEmailQueue = new Queue('send-email', { connection: sharedRedisConnection });
const systemTasksQueue = new Queue('system-tasks', { connection: sharedRedisConnection });

// Create Express Adapter with basePath
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

// Register queues with Bull-Board
createBullBoard({
  queues: [
    new BullMQAdapter(sendEmailQueue),
    new BullMQAdapter(systemTasksQueue),
  ],
  serverAdapter,
});

module.exports = {
  serverAdapter,
  sendEmailQueue,
  systemTasksQueue,
  sharedRedisConnection,
};
