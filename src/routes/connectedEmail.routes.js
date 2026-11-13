/**
 * src/routes/connectedEmail.routes.js
 * Express routing layer for ConnectedEmail endpoints.
 */

const express = require('express');
const { connectEmailAccount } = require('../controllers/connectedEmail.controller');

const router = express.Router();

// POST /api/emails/connect
router.post('/connect', connectEmailAccount);

module.exports = router;
