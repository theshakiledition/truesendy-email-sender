/**
 * src/app/api/auth/session/route.ts
 * Next.js App Router endpoint returning the active session and impersonation status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/jwt.util';

export async function GET(req: NextRequest) {
  try {
    const authToken = req.cookies.get('auth_token')?.value;

    if (!authToken) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    let payload: any;
    try {
      payload = verifyToken(authToken);
    } catch {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.userId || payload.id,
        email: payload.email,
        role: payload.role,
        impersonatorId: payload.impersonatorId || null,
        impersonatedAt: payload.impersonatedAt || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, user: null, error: err.message },
      { status: 500 }
    );
  }
}
