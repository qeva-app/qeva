import { requireCompanyAccounts } from '@/lib/enterprise-guard';

/** Community stub — org admin APIs are Enterprise-only. */
async function unavailable() {
  return requireCompanyAccounts()!;
}

export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
