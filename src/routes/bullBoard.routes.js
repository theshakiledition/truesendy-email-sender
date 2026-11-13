/**
 * src/routes/bullBoard.routes.js
 * Express routing layer mounting Bull-Board UI with Superadmin security guards.
 */

const express = require('express');
const { serverAdapter } = require('../lib/bullBoard');

const router = express.Router();

/**
 * Superadmin Security Middleware
 * Verifies that the requester possesses SUPERADMIN privileges.
 * Returns a 404 (instead of 401) to completely mask the existence of internal queues from scanners.
 */
function superadminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const superadminSecret = process.env.SUPERADMIN_SECRET_KEY;

  // 1. Secret Key authentication
  if (superadminSecret && authHeader === `Bearer ${superadminSecret}`) {
    return next();
  }

  // 2. Session user authentication
  if (req.user && req.user.systemRole === 'SUPERADMIN') {
    return next();
  }

  // 3. Local development override
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // 4. Return 404 to obscure the admin endpoint
  return res.status(404).send('Not Found');
}

// Mount Bull-Board router
router.use('/', superadminAuthMiddleware, serverAdapter.getRouter());

module.exports = router;
