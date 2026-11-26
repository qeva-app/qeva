import { requireCompanyAccounts } from '@/lib/enterprise-guard';

/** Community stub - enterprise metrics are Enterprise-only. */
async function unavailable() {
  return requireCompanyAccounts()!;
}

export const GET = unavailable;
