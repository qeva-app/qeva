import { NextRequest } from 'next/server';

/** Resolve client IP from request headers. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    // shortcut: rightmost hop (one reverse proxy that appends); multi-proxy needs hop count
    return parts[parts.length - 1] || 'unknown';
  }
  return headers.get('x-real-ip') || 'unknown';
}

export function getClientIp(req: NextRequest): string {
  return clientIpFromHeaders(req.headers);
}
