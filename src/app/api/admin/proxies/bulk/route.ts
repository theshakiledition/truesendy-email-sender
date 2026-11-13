import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawProxyText } = body;

    if (!rawProxyText || typeof rawProxyText !== 'string' || !rawProxyText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or empty rawProxyText string. Expected IP:Port:Username:Password format per line.',
        },
        { status: 400 }
      );
    }

    // 1. Split the raw text by newlines
    const rawLines = rawProxyText.split(/\r?\n/);

    // 2. Filter out empty lines (and comment lines starting with #)
    const validLines = rawLines
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    if (validLines.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid proxy lines found in input.',
        },
        { status: 400 }
      );
    }

    // 3. Split each line by ':' to extract host, port, username, password
    const proxyRecords: Array<{
      host: string;
      port: string;
      username: string | null;
      password: string | null;
      protocol: string;
      isActive: boolean;
    }> = [];

    for (const line of validLines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parts[1].trim();
        const username = parts[2] ? parts[2].trim() : null;
        const password = parts[3] ? parts[3].trim() : null;

        if (host && port) {
          proxyRecords.push({
            host,
            port, // string format as required
            username: username || null,
            password: password || null,
            protocol: 'HTTP', // Webshare defaults to HTTP
            isActive: true,
          });
        }
      }
    }

    if (proxyRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Malformed proxy lines. Expected IP:Port:Username:Password',
        },
        { status: 400 }
      );
    }

    // 4. Bulk insert using Prisma createMany with skipDuplicates to safely ignore existing proxies
    const result = await prisma.proxy.createMany({
      data: proxyRecords,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${proxyRecords.length} proxies (${result.count} inserted, ${proxyRecords.length - result.count} duplicates skipped).`,
      parsedCount: proxyRecords.length,
      insertedCount: result.count,
    });
  } catch (error: any) {
    console.error('[API /api/admin/proxies/bulk Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
