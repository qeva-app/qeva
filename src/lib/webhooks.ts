import crypto from 'crypto';
import prisma from '@/lib/db';
import { createWebhookPayload } from '@/lib/api';
import logger from '@/lib/logger';

export type DomainEvent =
  | 'password.created'
  | 'password.rotated'
  | 'share.viewed'
  | 'emergency.requested'
  | 'breach.detected';

export function signWebhookBody(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function postJson(url: string, body: string, headers: Record<string, string>) {
  // shortcut: in-process fire-and-forget with one retry; upgrade to durable queue when volume grows
  const attempt = async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };
  try {
    await attempt();
  } catch (e1) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      await attempt();
    } catch (e2) {
      logger.warn('Webhook delivery failed', {
        url,
        error: e2 instanceof Error ? e2.message : String(e2),
      });
    }
  }
}

export async function emitDomainEvent(
  event: DomainEvent,
  data: Record<string, unknown>,
  scope: { organizationId?: string | null; userId?: string | null }
) {
  const payload = createWebhookPayload(event, data);
  const body = JSON.stringify(payload);

  try {
    const subs = await prisma.webhookSubscription.findMany({
      where: {
        active: true,
        OR: [
          scope.organizationId ? { organizationId: scope.organizationId } : undefined,
          scope.userId ? { userId: scope.userId } : undefined,
        ].filter(Boolean) as any,
      },
    });

    for (const sub of subs) {
      let events: string[] = [];
      try {
        events = JSON.parse(sub.events);
      } catch {
        continue;
      }
      if (!events.includes(event) && !events.includes('*')) continue;
      const sig = signWebhookBody(sub.secret, body);
      void postJson(sub.url, body, {
        'X-Qeva-Signature': sig,
        'X-Qeva-Event': event,
      });
    }

    const channels = await prisma.alertChannel.findMany({
      where: {
        active: true,
        OR: [
          scope.organizationId ? { organizationId: scope.organizationId } : undefined,
          scope.userId ? { userId: scope.userId } : undefined,
        ].filter(Boolean) as any,
      },
    });

    for (const ch of channels) {
      let events: string[] = [];
      try {
        events = JSON.parse(ch.events);
      } catch {
        continue;
      }
      if (!events.includes(event) && !events.includes('*')) continue;

      if (ch.type === 'SLACK') {
        const text = `*Qeva* \`${event}\`\n\`\`\`${JSON.stringify(data, null, 0).slice(0, 500)}\`\`\``;
        void postJson(ch.webhookUrl, JSON.stringify({ text }), {});
      } else if (ch.type === 'TEAMS') {
        const card = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: `Qeva ${event}`,
          themeColor: '1d4ed8',
          title: `Qeva: ${event}`,
          text: JSON.stringify(data).slice(0, 500),
        };
        void postJson(ch.webhookUrl, JSON.stringify(card), {});
      }
    }
  } catch (e) {
    logger.error('emitDomainEvent failed', { event, error: e instanceof Error ? e.message : String(e) });
  }
}
