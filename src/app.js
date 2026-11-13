/**
 * src/app.js
 * Express application bootstrap.
 */

const express = require('express');
const emailRoutes = require('./routes/connectedEmail.routes');
const uniboxRoutes = require('./routes/unibox.routes');
const trackingRoutes = require('./routes/tracking.routes');
const adminProxyRoutes = require('./routes/adminProxy.routes');
const bullBoardRoutes = require('./routes/bullBoard.routes');
const impersonationRoutes = require('./routes/impersonation.routes');
const { preventImpersonatorDestruction } = require('./middleware/impersonationGuard');

const app = express();

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// Cookie Parser Middleware with native fallback
let cookieParser;
try {
  cookieParser = require('cookie-parser');
  app.use(cookieParser());
} catch {
  app.use((req, res, next) => {
    if (!req.cookies) {
      const rawCookies = req.headers.cookie;
      req.cookies = {};
      if (rawCookies) {
        rawCookies.split(';').forEach((cookie) => {
          const [key, ...val] = cookie.trim().split('=');
          if (key) req.cookies[key] = decodeURIComponent(val.join('='));
        });
      }
    }
    next();
  });
}

// Security Guard: Prevent destructive or sensitive actions during impersonation sessions
app.use(preventImpersonatorDestruction);

// Routes
app.use('/api/emails', emailRoutes);
app.use('/api/unibox', uniboxRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin/proxies', adminProxyRoutes);
app.use('/api/admin/queues', bullBoardRoutes);
app.use('/api/admin/impersonate', impersonationRoutes);
app.use('/track', trackingRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
