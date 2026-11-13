/**
 * src/middleware/impersonationGuard.js
 * Route guard to prevent destructive or sensitive actions during an impersonation session.
 */

const { verifyToken } = require('../utils/jwt.util');

// Sensitive route patterns blocked during impersonation
const RESTRICTED_ROUTES = [
  '/api/user/billing',
  '/api/user/password',
  '/api/workspaces/delete',
];

const RESTRICTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Extracts JWT token from cookies or Authorization header.
 */
function extractToken(req) {
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Express Middleware: preventImpersonatorDestruction
 * Checks if the current request is operating under an active impersonatorId.
 * If so, strictly blocks DELETE, POST, PUT, or PATCH to sensitive billing, password, and workspace destruction endpoints.
 */
function preventImpersonatorDestruction(req, res, next) {
  // Only inspect state-modifying requests
  if (!RESTRICTED_METHODS.includes(req.method.toUpperCase())) {
    return next();
  }

  let payload = req.user;
  if (!payload) {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    try {
      payload = verifyToken(token);
      req.user = payload; // Attach to request for downstream handlers
    } catch {
      return next(); // Downstream auth middleware will handle invalid token
    }
  }

  // Check if current session contains an impersonatorId
  if (payload && payload.impersonatorId) {
    const currentPath = (req.originalUrl || req.path || '').toLowerCase();

    // Check if path matches any restricted pattern
    const isRestricted = RESTRICTED_ROUTES.some(
      (route) => currentPath === route || currentPath.startsWith(`${route}/`) || currentPath.startsWith(route)
    );

    if (isRestricted) {
      console.warn(
        `[Security Guard] Blocked ${req.method} request to '${currentPath}' by impersonator '${payload.impersonatorId}' on behalf of user '${payload.userId || payload.id}'`
      );

      return res.status(403).json({
        success: false,
        error: 'This action is not allowed while impersonating a user.',
        code: 'IMPERSONATION_RESTRICTED_ACTION',
        restrictedPath: currentPath,
        impersonatorId: payload.impersonatorId,
      });
    }
  }

  next();
}

module.exports = {
  preventImpersonatorDestruction,
  RESTRICTED_ROUTES,
  RESTRICTED_METHODS,
};
