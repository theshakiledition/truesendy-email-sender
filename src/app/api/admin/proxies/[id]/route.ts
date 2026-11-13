import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = await prisma.proxy.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Proxy not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.proxy.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        _count: {
          select: { connectedEmails: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Proxy ${updated.host}:${updated.port} is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
