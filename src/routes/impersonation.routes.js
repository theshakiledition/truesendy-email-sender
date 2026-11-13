/**
 * src/routes/impersonation.routes.js
 * Express routing for Superadmin User Impersonation & Reversion.
 */

const express = require('express');
const { startImpersonation, revertImpersonation } = require('../controllers/impersonation.controller');

const router = express.Router();

// POST /api/admin/impersonate
router.post('/', startImpersonation);

// POST /api/admin/impersonate/revert
router.post('/revert', revertImpersonation);

module.exports = router;
