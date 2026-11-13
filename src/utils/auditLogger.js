/**
 * src/utils/auditLogger.js
 * Prisma Audit Logging Utility with Impersonation Actor Attribution.
 * 
 * Ensures that whenever an action is performed during an active impersonation session,
 * the audit log entry attributes the action's `actorId` to the `impersonatorId`,
 * while recording the customer in `targetUserId`.
 */

let defaultPrismaClient = null;

function getPrisma() {
  if (!defaultPrismaClient) {
    const { PrismaClient } = require('@prisma/client');
    defaultPrismaClient = new PrismaClient();
  }
  return defaultPrismaClient;
}

/**
 * Resolves the actor, impersonator, and target user IDs from a session/JWT payload.
 * 
 * Attribution Rule:
 * - When impersonating:
 *   - actorId: attributes directly to impersonatorId (the Superadmin performing the action)
 *   - impersonatorId: explicit foreign key / record of impersonatorId
 *   - targetUserId: the customer account whose resources are being viewed/modified
 * - When normal user:
 *   - actorId: user ID
 *   - impersonatorId: null
 *   - targetUserId: null
 * 
 * @param {Object} session - Decoded JWT or req.user object
 * @returns {Object} { actorId, impersonatorId, targetUserId, isImpersonating }
 */
function resolveAuditActors(session) {
  if (!session) {
    return {
      actorId: '00000000-0000-0000-0000-000000000000', // anonymous / system fallback
      impersonatorId: null,
      targetUserId: null,
      isImpersonating: false,
    };
  }

  const effectiveUserId = session.userId || session.id;
  const impersonatorId = session.impersonatorId || null;
  const isImpersonating = Boolean(impersonatorId);

  return {
    // CRITICAL: Attribute action to the impersonatorId if impersonating, else to userId
    actorId: isImpersonating ? impersonatorId : effectiveUserId,
    impersonatorId: isImpersonating ? impersonatorId : null,
    targetUserId: isImpersonating ? effectiveUserId : null,
    isImpersonating,
  };
}

/**
 * Creates an audit log record in PostgreSQL via Prisma.
 * 
 * @param {Object} params
 * @param {Object} params.session - req.user or decoded JWT
 * @param {string} params.action - e.g. "UPDATE_CAMPAIGN", "DELETE_PROXY", "SEND_EMAIL"
 * @param {string} params.entityType - e.g. "Campaign", "Proxy", "ConnectedEmail"
 * @param {string} [params.entityId] - Target entity UUID or identifier
 * @param {Object} [params.details={}] - Contextual metadata or payload diff
 * @param {string} [params.ipAddress] - Caller IP address
 * @param {string} [params.userAgent] - Caller User Agent
 * @param {Object} [params.prisma] - Optional custom PrismaClient instance
 * @returns {Promise<Object>} Created AuditLog record
 */
async function logAuditEvent({
  session,
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  prisma = null,
}) {
  const db = prisma || getPrisma();
  const { actorId, impersonatorId, targetUserId, isImpersonating } = resolveAuditActors(session);

  const enrichedDetails = {
    ...details,
    metadata: {
      isImpersonated: isImpersonating,
      ...(isImpersonating ? { impersonatorId, targetUserId } : {}),
      timestamp: new Date().toISOString(),
      ...(details.metadata || {}),
    },
  };

  try {
    const record = await db.auditLog.create({
      data: {
        actorId,
        impersonatorId,
        targetUserId,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        details: enrichedDetails,
        ipAddress: ipAddress || null,
        userAgent: userAgent ? String(userAgent).substring(0, 500) : null,
      },
    });

    if (isImpersonating) {
      console.info(
        `[AUDIT LOG] Action '${action}' on '${entityType}' attributed to IMPERSONATOR '${actorId}' (acting on user '${targetUserId}')`
      );
    }

    return record;
  } catch (error) {
    console.error(`[AUDIT LOG ERROR] Failed to record audit log for '${action}':`, error.message);
    // Avoid crashing primary business logic if audit logging fails
    return null;
  }
}

/**
 * Helper to record audit log directly from an Express request object.
 * 
 * @param {import('express').Request} req
 * @param {Object} auditData
 */
async function logRequestAudit(req, auditData) {
  return logAuditEvent({
    session: req.user,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    ...auditData,
  });
}

/**
 * Prisma Client Extension factory that injects an `audit` method into prisma.
 * 
 * Usage:
 * const prismaWithAudit = prisma.$extends(auditExtension(req.user));
 * await prismaWithAudit.audit.log({ action: 'UPDATE_PROFILE', entityType: 'User' });
 */
function auditExtension(session) {
  return {
    name: 'auditLogging',
    model: {
      auditLog: {
        async record(data) {
          return logAuditEvent({ session, ...data });
        },
      },
    },
  };
}

module.exports = {
  resolveAuditActors,
  logAuditEvent,
  logRequestAudit,
  auditExtension,
};
