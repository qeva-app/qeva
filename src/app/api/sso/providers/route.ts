import { NextResponse } from 'next/server';
import { hasEnterpriseFeature } from '@/lib/edition';

/** Community: no SSO providers. EE overlay replaces this file. */
export async function GET() {
  if (!hasEnterpriseFeature('sso')) return NextResponse.json([]);
  return NextResponse.json([]);
}

