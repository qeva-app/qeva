import { NextRequest, NextResponse } from 'next/server';
import {
  hasEnterpriseFeature,
  allowsCompanyAccounts,
  type EnterpriseFeature,
  getEdition,
} from '@/lib/edition';

type ApiHandler = (
  req: NextRequest,
  context?: unknown
) => Promise<NextResponse>;

function enterpriseUnavailable(extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      error: 'This feature requires Qeva Enterprise',
      edition: getEdition(),
      docs: 'https://qeva.in',
      ...extra,
    },
    { status: 404 }
  );
}

/** API guard — Community builds get 404 (feature absent), not a tease. */
export function requireEnterpriseFeature(feature: EnterpriseFeature): NextResponse | null {
  if (hasEnterpriseFeature(feature)) return null;
  return enterpriseUnavailable({ feature });
}

/** Company / org surfaces — absent on Community (individuals only). */
export function requireCompanyAccounts(): NextResponse | null {
  if (allowsCompanyAccounts()) return null;
  return enterpriseUnavailable({ feature: 'company_accounts' });
}

/** Wrap a route handler so Community editions never reach the body. */
export function withEnterpriseFeature(
  feature: EnterpriseFeature,
  handler: ApiHandler
): ApiHandler {
  return async (req, context) => {
    const denied = requireEnterpriseFeature(feature);
    if (denied) return denied;
    return handler(req, context);
  };
}
