import crypto from 'crypto';

// API key generation
export function generateApiKey(prefix = 'qeva'): string {
  const key = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${key}`;
}

// Rate limiting interface (in-memory for now)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  const allowed = entry.count <= maxRequests;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

// Webhook interfaces
export interface WebhookEvent {
  type: string;
  data: Record<string, any>;
  timestamp: string;
}

export function createWebhookPayload(
  type: string,
  data: Record<string, any>
): WebhookEvent {
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
  };
}
