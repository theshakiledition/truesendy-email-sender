/**
 * src/middleware.ts
 * Next.js Edge Middleware for Impersonation Security Guard.
 * 
 * Intercepts requests and enforces strict security policies during active impersonation sessions.
 * Blocks DELETE, POST, PUT, or PATCH requests to sensitive customer endpoints:
 * - /api/user/billing
 * - /api/user/password
 * - /api/workspaces/delete
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Restricted paths blocked for active impersonators
export const RESTRICTED_IMPERSONATION_ROUTES = [
  '/api/user/billing',
  '/api/user/password',
  '/api/workspaces/delete',
];

// Destructive or state-altering HTTP methods
export const RESTRICTED_HTTP_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Decodes the payload portion of a JWT without external native crypto dependencies,
 * making it 100% compatible with the Next.js Edge and Node runtimes.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Checks if the request is an impersonated session attempting a restricted action.
 * Returns a 403 Forbidden response if violation is detected, or null if allowed.
 */
export function preventImpersonatorDestruction(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();

  // 1. Only guard state-modifying requests
  if (!RESTRICTED_HTTP_METHODS.includes(method)) {
    return null;
  }

  const { pathname } = request.nextUrl;

  // 2. Fast check: is this a sensitive route?
  const isSensitiveRoute = RESTRICTED_IMPERSONATION_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isSensitiveRoute) {
    return null;
  }

  // 3. Extract JWT from cookie or Authorization header
  const token =
    request.cookies.get('auth_token')?.value ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return null; // Let downstream authentication handlers return 401
  }

  // 4. Inspect JWT claims for impersonatorId
  const payload = decodeJwtPayload(token);
  if (payload && payload.impersonatorId) {
    console.warn(
      `[Next.js Middleware Guard] Blocked ${method} ${pathname} by impersonator '${payload.impersonatorId}' on behalf of user '${payload.userId || payload.id}'`
    );

    return NextResponse.json(
      {
        error: 'This action is not allowed while impersonating a user.',
        code: 'IMPERSONATION_RESTRICTED_ACTION',
        restrictedPath: pathname,
        impersonatorId: payload.impersonatorId,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Next.js Edge Middleware entrypoint.
 */
export function middleware(request: NextRequest) {
  const blockResponse = preventImpersonatorDestruction(request);
  if (blockResponse) {
    return blockResponse;
  }

  return NextResponse.next();
}

/**
 * Configure matching routes for optimal Next.js middleware execution.
 */
export const config = {
  matcher: [
    '/api/user/billing/:path*',
    '/api/user/password/:path*',
    '/api/workspaces/delete/:path*',
  ],
};
