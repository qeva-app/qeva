import logger from './logger';

let keepAliveInterval: NodeJS.Timeout | null = null;

const ENDPOINTS = ['/api/health', '/api/warm-up', '/api/auth/public-key'];
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startKeepAlive(baseUrl: string): void {
  if (keepAliveInterval) return;

  keepAliveInterval = setInterval(async () => {
    for (const endpoint of ENDPOINTS) {
      try {
        await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // Silently ignore - keep-alive is best-effort
      }
    }
  }, INTERVAL_MS);

  logger.info('Keep-alive system started');
}

export function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}
