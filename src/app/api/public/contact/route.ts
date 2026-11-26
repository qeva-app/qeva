import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import logger from '@/lib/logger';
import { marketingCorsHeaders } from '@/lib/marketing-cors';
import { verifyCaptcha } from '@/lib/public-captcha';
import { sendEmail } from '@/lib/smtp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: marketingCorsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers = marketingCorsHeaders(origin);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const limit = checkRateLimit(`contact:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // Honeypot: bots fill hidden "website"; pretend success.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json(
      { ok: true, message: 'Thanks. We will get back to you soon.' },
      { headers }
    );
  }

  if (!verifyCaptcha(body.captchaToken, body.captchaAnswer)) {
    return NextResponse.json(
      { error: 'Captcha failed. Refresh the challenge and try again.' },
      { status: 400, headers }
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : undefined;
  const subject =
    typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : undefined;
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 80) : 'marketing';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400, headers });
  }
  if (!message || message.length < 10) {
    return NextResponse.json(
      { error: 'Message must be at least 10 characters' },
      { status: 400, headers }
    );
  }

  try {
    await prisma.contactMessage.create({
      data: { email, name, subject, message, source },
    });

    const inbox =
      process.env.CONTACT_INBOX?.trim() ||
      process.env.SUPER_ADMIN_EMAIL?.trim() ||
      process.env.EMAIL_FROM?.trim();
    if (inbox && process.env.EMAIL_SERVER_PASSWORD) {
      const safeSubject = subject || 'Website contact';
      await sendEmail(
        inbox,
        `[Qeva contact] ${safeSubject}`,
        `<p><strong>From:</strong> ${name || '—'} &lt;${email}&gt;</p>
         <p><strong>Subject:</strong> ${safeSubject}</p>
         <pre style="white-space:pre-wrap;font-family:inherit">${message
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')}</pre>`
      ).catch((error) => {
        logger.error('Contact notify email failed', { error });
      });
    }

    return NextResponse.json(
      { ok: true, message: 'Thanks. We will get back to you soon.' },
      { headers }
    );
  } catch (error) {
    logger.error('Contact form failed', { error });
    return NextResponse.json({ error: 'Could not send message' }, { status: 500, headers });
  }
}
