import { NextResponse } from 'next/server';
import { requireEnterpriseFeature } from '@/lib/enterprise-guard';

async function unavailable() {
  return requireEnterpriseFeature('directory_sync')!;
}

export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;

