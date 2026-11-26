import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and health endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/public/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Backup & Database Explorer removed from the product for safety
  if (
    pathname === '/backup' ||
    pathname.startsWith('/backup/') ||
    pathname === '/database' ||
    pathname.startsWith('/database/') ||
    pathname.startsWith('/api/backup') ||
    pathname.startsWith('/api/admin/database')
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'This feature has been disabled' },
        { status: 410 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // HTTPS redirect only when explicitly required (TLS terminator or FORCE_HTTPS).
  // Self-host Docker on plain HTTP must not loop-redirect.
  const forceHttps =
    process.env.FORCE_HTTPS === 'true' ||
    (process.env.NEXTAUTH_URL || '').startsWith('https://');
  if (
    forceHttps &&
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
