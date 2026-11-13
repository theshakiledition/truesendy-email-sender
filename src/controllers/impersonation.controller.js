/**
 * src/controllers/impersonation.controller.js
 * User Impersonation controller for Superadmins.
 * Features:
 * - JWT issuance with `impersonatorId` audit claims.
 * - Multi-cookie isolation (admin_token preserved in HTTP-only, SameSite=Strict cookie).
 * - Safe rollback / revert to original Superadmin session.
 */

const { PrismaClient } = require('@prisma/client');
const { signToken, verifyToken, SECURE_COOKIE_OPTIONS } = require('../utils/jwt.util');

let prismaClient;
function getPrisma() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

/**
 * Extracts and decodes the active JWT token from cookies or Authorization header.
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
 * POST /api/admin/impersonate
 * Verifies caller is SUPERADMIN, generates impersonation JWT, saves admin_token cookie,
 * and sets auth_token to the target user.
 */
async function startImpersonation(req, res, next) {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'targetUserId is required.',
      });
    }

    // 1. Resolve & Verify Caller is SUPERADMIN
    const currentToken = extractToken(req);
    let callerPayload = req.user;

    if (!callerPayload && currentToken) {
      try {
        callerPayload = verifyToken(currentToken);
      } catch (err) {
        return res.status(401).json({
          success: false,
          error: `Authentication failed: ${err.message}`,
        });
      }
    }

    if (!callerPayload || (callerPayload.role !== 'SUPERADMIN' && callerPayload.systemRole !== 'SUPERADMIN')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Caller is not a SUPERADMIN.',
      });
    }

    // If caller is already in an impersonation session, prevent nested impersonation
    if (callerPayload.impersonatorId) {
      return res.status(400).json({
        success: false,
        error: 'Nested impersonation is prohibited. Please revert the current session first.',
      });
    }

    // 2. Fetch and Validate Target User
    const prisma = getPrisma();
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        systemRole: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: `Target user with ID '${targetUserId}' not found.`,
      });
    }

    // Prevent impersonating another Superadmin for security
    if (targetUser.systemRole === 'SUPERADMIN') {
      return res.status(400).json({
        success: false,
        error: 'Cannot impersonate another Superadmin account.',
      });
    }

    // 3. Issue New JWT with impersonatorId claim
    const callerId = callerPayload.userId || callerPayload.id;
    const impersonationPayload = {
      userId: targetUser.id,
      email: targetUser.email,
      role: 'USER',
      impersonatorId: callerId, // CRITICAL: Audit trail of which admin initiated this
      impersonatedAt: new Date().toISOString(),
    };

    const impersonationToken = signToken(impersonationPayload, 7200); // 2 hours

    // 4. Preserve original admin JWT in `admin_token` cookie
    // If currentToken is present, preserve it. Otherwise re-sign original admin payload.
    const originalAdminToken =
      currentToken ||
      signToken(
        {
          userId: callerId,
          email: callerPayload.email,
          role: 'SUPERADMIN',
        },
        86400
      );

    res.cookie('admin_token', originalAdminToken, SECURE_COOKIE_OPTIONS);

    // 5. Set the new impersonation token as primary `auth_token`
    res.cookie('auth_token', impersonationToken, SECURE_COOKIE_OPTIONS);

    console.log(
      `[Security Audit] Superadmin '${callerId}' started impersonating user '${targetUser.email}' (ID: ${targetUser.id})`
    );

    return res.status(200).json({
      success: true,
      message: `Now impersonating ${targetUser.email}`,
      impersonatorId: callerId,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/impersonate/revert
 * Reads `admin_token` cookie, sets it back as the primary `auth_token`,
 * and deletes the `admin_token` cookie.
 */
async function revertImpersonation(req, res, next) {
  try {
    const adminToken = req.cookies?.admin_token;

    if (!adminToken) {
      return res.status(400).json({
        success: false,
        error: 'No active impersonation session found (missing admin_token cookie).',
      });
    }

    // 1. Verify the preserved admin token
    let adminPayload;
    try {
      adminPayload = verifyToken(adminToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: `Preserved admin token is invalid or expired: ${err.message}`,
      });
    }

    if (adminPayload.role !== 'SUPERADMIN' && adminPayload.systemRole !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Preserved token does not hold SUPERADMIN privileges.',
      });
    }

    // 2. Restore admin_token as the primary auth_token
    res.cookie('auth_token', adminToken, SECURE_COOKIE_OPTIONS);

    // 3. Clear the admin_token cookie
    res.clearCookie('admin_token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    console.log(
      `[Security Audit] Reverted impersonation. Restored Superadmin session for '${adminPayload.userId || adminPayload.id}'`
    );

    return res.status(200).json({
      success: true,
      message: 'Impersonation session reverted. Superadmin session restored.',
      superadminId: adminPayload.userId || adminPayload.id,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  startImpersonation,
  revertImpersonation,
};
