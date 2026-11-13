/**
 * src/routes/adminProxy.routes.js
 */

const express = require('express');
const {
  bulkUploadProxies,
  listProxies,
  toggleProxyStatus,
  syncWebshareProxies,
} = require('../controllers/adminProxy.controller');

const router = express.Router();

router.get('/', listProxies);
router.get('/sync', syncWebshareProxies);
router.post('/sync', syncWebshareProxies);
router.post('/bulk', express.json(), bulkUploadProxies);
router.patch('/:id/toggle', toggleProxyStatus);

module.exports = router;
