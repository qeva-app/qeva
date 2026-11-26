import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { startWeeklyEmailScheduler, stopWeeklyEmailScheduler } from '@/lib/weekly-email-scheduler';

async function handleGet() {
  return NextResponse.json({
    autoStart: process.env.WEEKLY_EMAIL_SCHEDULER_AUTO_START === 'true',
    status: 'configured',
  });
}

async function handlePost(req: NextRequest) {
  const { action } = await req.json();
  if (action === 'start') {
    startWeeklyEmailScheduler();
    return NextResponse.json({ message: 'Scheduler started' });
  } else if (action === 'stop') {
    stopWeeklyEmailScheduler();
    return NextResponse.json({ message: 'Scheduler stopped' });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export const GET = withAuth(handleGet, 'SETTINGS:MANAGE');
export const POST = withAuth(handlePost, 'SETTINGS:MANAGE');
