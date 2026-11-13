/**
 * src/lib/auditLogger.ts
 * TypeScript Audit Logging utility for Next.js App Router & Server Actions.
 * 
 * Enforces attribution of actions to `impersonatorId` whenever impersonation is active.
 */

import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

let prismaInstance: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export interface SessionContext {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  impersonatorId?: string | null;
}

export interface AuditLogOptions {
  session?: SessionContext | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  prisma?: PrismaClient;
}

/**
 * Resolves the true actor ID for audit attribution.
 * Crucial Rule: If impersonatorId exists, the action is attributed to impersonatorId, not targetUserId.
 */
export function resolveAuditActors(session?: SessionContext | null) {
  if (!session) {
    return {
      actorId: '00000000-0000-0000-0000-000000000000',
      impersonatorId: null,
      targetUserId: null,
      isImpersonating: false,
    };
  }

  const effectiveUserId = session.userId || session.id || 'anonymous';
  const impersonatorId = session.impersonatorId || null;
  const isImpersonating = Boolean(impersonatorId);

  return {
    actorId: isImpersonating ? (impersonatorId as string) : effectiveUserId,
    impersonatorId,
    targetUserId: isImpersonating ? effectiveUserId : null,
    isImpersonating,
  };
}

/**
 * Persists an audit log event to PostgreSQL.
 */
export async function logAuditEvent({
  session,
  action,
  entityType,
  entityId,
  details = {},
  ipAddress,
  userAgent,
  prisma,
}: AuditLogOptions) {
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
  } catch (error: any) {
    console.error(`[AUDIT LOG ERROR] Failed to record audit log for '${action}':`, error.message);
    return null;
  }
}

/**
 * Convenience helper for Next.js Route Handlers (NextRequest).
 */
export async function logNextRequestAudit(
  req: NextRequest,
  session: SessionContext | null,
  auditData: Omit<AuditLogOptions, 'session' | 'ipAddress' | 'userAgent'>
) {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';

  return logAuditEvent({
    session,
    ipAddress,
    userAgent,
    ...auditData,
  });
}
