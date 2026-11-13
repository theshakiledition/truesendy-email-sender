/**
 * src/app/api/admin/impersonate/revert/route.ts
 * Next.js App Router route handler for reverting an active impersonation session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/jwt.util';

export async function POST(req: NextRequest) {
  try {
    const adminToken = req.cookies.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active impersonation session found (missing admin_token cookie).',
        },
        { status: 400 }
      );
    }

    // 1. Verify the preserved admin token
    let adminPayload: any;
    try {
      adminPayload = verifyToken(adminToken);
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Preserved admin token is invalid or expired: ${err.message}`,
        },
        { status: 401 }
      );
    }

    if (adminPayload.role !== 'SUPERADMIN' && adminPayload.systemRole !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Preserved token does not hold SUPERADMIN privileges.' },
        { status: 403 }
      );
    }

    // 2. Prepare response
    const response = NextResponse.json({
      success: true,
      message: 'Impersonation session reverted. Restored Superadmin session.',
      superadminId: adminPayload.userId || adminPayload.id,
    });

    // 3. Set admin_token back as primary auth_token cookie
    response.cookies.set('auth_token', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 86400, // 24h
    });

    // 4. Delete the admin_token cookie
    response.cookies.delete('admin_token');

    return response;
  } catch (error: any) {
    console.error('[API /api/admin/impersonate/revert Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
