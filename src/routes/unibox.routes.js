/**
 * src/routes/unibox.routes.js
 * Express routes for Unified Inbox (Unibox)
 */

const express = require('express');
const {
  getRepliedConversations,
  sendManualReply,
} = require('../controllers/unibox.controller');

const router = express.Router();

// GET /api/unibox - Fetch conversations grouped by campaign
router.get('/', getRepliedConversations);

// POST /api/unibox/reply - Send a direct reply back to a lead
router.post('/reply', sendManualReply);

module.exports = router;
