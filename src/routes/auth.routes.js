/**
 * src/routes/auth.routes.js
 * Express routes for /api/auth
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/login', authController.login);
router.get('/session', authController.getSession);
router.post('/logout', authController.logout);

module.exports = router;
