import prisma from './db';
import logger from './logger';
import crypto from 'crypto';

function parseUserAgent(ua: string) {
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\s/](\d+)/)?.[1] || 'Unknown';
  const os = ua.match(/(Windows|Mac|Linux|Android|iOS|iPhone|iPad)/i)?.[1] || 'Unknown';
  const deviceType = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, deviceType };
}

/**
 * Generate a session fingerprint from browser, OS, device type, and IP subnet.
 * This creates a stable identifier for a user's typical access pattern
 * without tracking exact IPs (privacy-respecting).
 */
export function generateSessionFingerprint(
  browser: string,
  os: string,
  deviceType: string,
  ipAddress?: string
): string {
  // Use the IP /24 subnet (first 3 octets) for location consistency without exact IP tracking
  const ipSubnet = ipAddress
    ? ipAddress.split('.').slice(0, 3).join('.') + '.0'
    : 'unknown';

  const components = [browser, os, deviceType, ipSubnet].join('|');
  return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
}

/**
 * Detect anomalies by comparing the current session fingerprint
 * against the user's recent session history.
 */
export async function detectSessionAnomaly(
  userId: string,
  currentFingerprint: string,
  currentBrowser: string,
  currentOs: string,
  currentIp?: string
): Promise<{ isAnomaly: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // Get the user's last 20 sessions
  const recentSessions = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { loginAt: 'desc' },
    take: 20,
    select: { browser: true, os: true, ipAddress: true, location: true, loginAt: true },
  });

  if (recentSessions.length === 0) {
    // First login — no history to compare against
    return { isAnomaly: false, reasons: [] };
  }

  // Check for new browser
  const knownBrowsers = new Set(recentSessions.map(s => s.browser).filter(Boolean));
  if (knownBrowsers.size > 0 && !knownBrowsers.has(currentBrowser)) {
    reasons.push(`New browser detected: ${currentBrowser}`);
  }

  // Check for new OS
  const knownOs = new Set(recentSessions.map(s => s.os).filter(Boolean));
  if (knownOs.size > 0 && !knownOs.has(currentOs)) {
    reasons.push(`New operating system detected: ${currentOs}`);
  }

  // Check for new IP subnet
  if (currentIp) {
    const currentSubnet = currentIp.split('.').slice(0, 3).join('.');
    const knownSubnets = new Set(
      recentSessions
        .map(s => s.ipAddress?.split('.').slice(0, 3).join('.'))
        .filter(Boolean)
    );
    if (knownSubnets.size > 0 && !knownSubnets.has(currentSubnet)) {
      reasons.push(`Login from new IP range: ${currentSubnet}.*`);
    }
  }

  // Check for unusual login time (outside the user's typical hours)
  const now = new Date();
  const currentHour = now.getHours();
  const loginHours = recentSessions.map(s => s.loginAt.getHours());
  const avgHour = loginHours.reduce((a, b) => a + b, 0) / loginHours.length;
  const hourDiff = Math.abs(currentHour - avgHour);
  if (loginHours.length >= 5 && (hourDiff > 6 && hourDiff < 18)) {
    reasons.push(`Unusual login time: ${currentHour}:00 (typical: ~${Math.round(avgHour)}:00)`);
  }

  return {
    isAnomaly: reasons.length > 0,
    reasons,
  };
}

export async function trackLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; anomaly: { isAnomaly: boolean; reasons: string[] } }> {
  const { browser, os, deviceType } = parseUserAgent(userAgent || '');
  const fingerprint = generateSessionFingerprint(browser, os, deviceType, ipAddress);

  // Detect anomalies before creating the session
  const anomaly = await detectSessionAnomaly(userId, fingerprint, browser, os, ipAddress);

  if (anomaly.isAnomaly) {
    logger.warn('Session anomaly detected', {
      userId,
      reasons: anomaly.reasons,
      ipAddress,
      browser,
      os,
    });
  }

  const session = await prisma.userSession.create({
    data: {
      userId,
      loginAt: new Date(),
      ipAddress,
      userAgent,
      browser,
      os,
      deviceType,
      isActive: true,
      sessionType: 'web',
      location: fingerprint, // Store fingerprint in location field for now
    },
  });

  return { sessionId: session.id, anomaly };
}

export async function trackLogout(sessionId: string): Promise<void> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      const duration = Math.floor(
        (Date.now() - session.loginAt.getTime()) / 1000
      );

      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          logoutAt: new Date(),
          duration,
          isActive: false,
        },
      });
    }
  } catch (error) {
    logger.error('Failed to track logout', { error, sessionId });
  }
}

export async function getActiveSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, isActive: true },
    orderBy: { loginAt: 'desc' },
  });
}
