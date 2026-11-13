/**
 * src/routes/tracking.routes.js
 * Express routes for open pixel and click tracking endpoints.
 */

const express = require('express');
const {
  trackOpen,
  trackClick,
  verifyTrackingDomain,
  checkDomainForCaddy,
} = require('../controllers/tracking.controller');

const router = express.Router();

// Open pixel tracking: GET /track/o/:trackingId.gif (also matches without .gif)
router.get('/o/:trackingId', trackOpen);

// Click tracking & redirect: GET /track/c/:trackingId?url=https://...
router.get('/c/:trackingId', trackClick);

// Custom Tracking Domain verification: POST /api/tracking/verify
router.post('/verify', verifyTrackingDomain);

// Caddy On-Demand TLS "ask" check: GET /api/tracking/check-domain?domain=...
router.get('/check-domain', checkDomainForCaddy);

module.exports = router;
