/**
 * src/app/api/admin/proxies/sync/route.ts
 * Next.js App Router endpoint delegating to the standalone syncWebshareProxies utility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncWebshareProxies } from '@/utils/proxySync.util';

export async function GET(req: NextRequest) {
  try {
    const result = await syncWebshareProxies();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      stats: result.stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
