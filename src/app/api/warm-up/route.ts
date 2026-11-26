import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ warmed: true, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ warmed: false }, { status: 500 });
  }
}
