import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import os from 'os';

export async function GET() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 as health`;
    const dbLatency = Date.now() - start;

    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      database: { connected: true, latencyMs: dbLatency },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      system: {
        platform: os.platform(),
        nodeVersion: process.version,
        cpus: os.cpus().length,
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      },
      version: process.env.APP_VERSION || '1.0.0',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        database: { connected: false },
      },
      { status: 503 }
    );
  }
}
