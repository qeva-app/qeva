import { NextRequest, NextResponse } from 'next/server';
import {
  hasEnterpriseFeature,
  type EnterpriseFeature,
  getEdition,
} from '@/lib/edition';

type ApiHandler = (
  req: NextRequest,
  context?: unknown
) => Promise<NextResponse>;

/** API guard — Community builds get 404 (feature absent), not a tease. */
export function requireEnterpriseFeature(feature: EnterpriseFeature): NextResponse | null {
  if (hasEnterpriseFeature(feature)) return null;
  return NextResponse.json(
    {
      error: 'This feature requires Qeva Enterprise',
      feature,
      edition: getEdition(),
      docs: 'https://qeva.in',
    },
    { status: 404 }
  );
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
