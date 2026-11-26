import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWeeklyAnalytics } from '@/lib/weekly-analytics';
import { getWeeklyEmailTemplate } from '@/lib/weekly-email-template';
import { sendEmail } from '@/lib/smtp';

async function handler() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const analytics = await getWeeklyAnalytics(session.user.id);
  const html = getWeeklyEmailTemplate(session.user.name || 'User', analytics);
  await sendEmail(session.user.email, 'Qeva — Weekly Summary (Test)', html);

  return NextResponse.json({ message: 'Test email sent' });
}

export const POST = withAuth(handler, 'SETTINGS:MANAGE');
