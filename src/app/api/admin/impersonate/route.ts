/**
 * src/app/api/admin/impersonate/route.ts
 * Next.js App Router route handler for starting a Superadmin impersonation session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { signToken, verifyToken, SECURE_COOKIE_OPTIONS } from '@/utils/jwt.util';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'targetUserId is required.' },
        { status: 400 }
      );
    }

    // 1. Resolve active session from cookies or headers
    const authToken =
      req.cookies.get('auth_token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '').trim();

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing session token.' },
        { status: 401 }
      );
    }

    let callerPayload: any;
    try {
      callerPayload = verifyToken(authToken);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: `Invalid session token: ${err.message}` },
        { status: 401 }
      );
    }

    // Verify caller has SUPERADMIN privileges
    if (callerPayload.role !== 'SUPERADMIN' && callerPayload.systemRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Caller is not a SUPERADMIN.' },
        { status: 403 }
      );
    }

    // Prevent nested impersonation
    if (callerPayload.impersonatorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nested impersonation is prohibited. Please revert the current session first.',
        },
        { status: 400 }
      );
    }

    // 2. Fetch and Validate Target User
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
      return NextResponse.json(
        { success: false, error: `Target user with ID '${targetUserId}' not found.` },
        { status: 404 }
      );
    }

    if (targetUser.systemRole === 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Cannot impersonate another Superadmin account.' },
        { status: 400 }
      );
    }

    // 3. Issue New JWT with impersonatorId claim
    const callerId = callerPayload.userId || callerPayload.id;
    const impersonationPayload = {
      userId: targetUser.id,
      email: targetUser.email,
      role: 'USER',
      impersonatorId: callerId, // CRITICAL: Audit trail of superadmin initiator
      impersonatedAt: new Date().toISOString(),
    };

    const impersonationToken = signToken(impersonationPayload, 7200); // 2 hours

    // 4. Return response with HTTP-only cookies
    const response = NextResponse.json({
      success: true,
      message: `Now impersonating ${targetUser.email}`,
      impersonatorId: callerId,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
      },
    });

    // Store original admin token in admin_token cookie
    response.cookies.set('admin_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7200,
    });

    // Set new impersonation JWT as the main auth_token cookie
    response.cookies.set('auth_token', impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7200,
    });

    return response;
  } catch (error: any) {
    console.error('[API /api/admin/impersonate Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
