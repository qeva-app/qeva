import { createHash } from 'crypto';
import prisma from './db';
import { decrypt } from './encryption-unified';
import { getOrgEncryptionKey } from './org-encryption';
import logger from './logger';

/** HIBP k-anonymity range API — never sends full password. */
async function hibpPwnedCount(plaintext: string): Promise<number> {
  const sha1 = createHash('sha1').update(plaintext, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'Qeva-SecurityScan' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return -1;
  const text = await res.text();
  for (const line of text.split('\n')) {
    const [hashSuffix, count] = line.trim().split(':');
    if (hashSuffix === suffix) return parseInt(count, 10) || 1;
  }
  return 0;
}

interface ScanResult {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCount: number;
  affectedPasswords: string[];
}

const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', 'login', 'admin', 'letmein', 'welcome', 'password1', 'iloveyou',
  'sunshine', 'princess', 'football', 'charlie', 'shadow', 'michael',
];

export async function runSecurityScan(
  userId?: string,
  options: { checkBreaches?: boolean } = {}
): Promise<{
  results: ScanResult[];
  riskScore: number;
  grade: string;
}> {
  const checkBreaches = options.checkBreaches !== false;
  const where = userId ? { userId } : {};
  const passwords = await prisma.passwordEntry.findMany({
    where,
    select: {
      id: true,
      title: true,
      encryptedPassword: true,
      strength: true,
      expiryDate: true,
      encryptionType: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { organizationId: true } },
      team: { select: { organizationId: true } },
    },
  });

  const results: ScanResult[] = [];
  const decryptedPasswords: Map<string, { title: string; plaintext: string }> = new Map();

  // Decrypt server-held entries for analysis (not USER_MASTER)
  for (const pw of passwords) {
    if (pw.encryptionType === 'USER_MASTER') continue;
    try {
      const orgId = pw.user?.organizationId || pw.team?.organizationId || null;
      const key =
        pw.encryptionType === 'ORG_KEY' && orgId
          ? getOrgEncryptionKey(orgId)
          : undefined;
      const plaintext = decrypt(pw.encryptedPassword, key);
      decryptedPasswords.set(pw.id, { title: pw.title, plaintext });
    } catch {
      // Can't decrypt — skip
    }
  }

  // 1. Weak passwords
  const weakPasswords = passwords.filter((p) => p.strength < 40);
  if (weakPasswords.length > 0) {
    results.push({
      type: 'weak',
      severity: weakPasswords.some((p) => p.strength < 20) ? 'critical' : 'high',
      title: 'Weak Passwords Detected',
      description: `${weakPasswords.length} password(s) have a strength score below 40.`,
      affectedCount: weakPasswords.length,
      affectedPasswords: weakPasswords.map((p) => p.title),
    });
  }

  // 2. Reused passwords
  const plaintextValues = Array.from(decryptedPasswords.values());
  const passwordCounts = new Map<string, string[]>();
  for (const { title, plaintext } of plaintextValues) {
    const existing = passwordCounts.get(plaintext) || [];
    existing.push(title);
    passwordCounts.set(plaintext, existing);
  }
  const reused = Array.from(passwordCounts.entries()).filter(([, titles]) => titles.length > 1);
  if (reused.length > 0) {
    const affectedTitles = reused.flatMap(([, titles]) => titles);
    results.push({
      type: 'reused',
      severity: 'high',
      title: 'Reused Passwords',
      description: `${affectedTitles.length} passwords are reused across multiple entries.`,
      affectedCount: affectedTitles.length,
      affectedPasswords: affectedTitles,
    });
  }

  // 3. Common passwords
  const common: string[] = [];
  for (const { title, plaintext } of plaintextValues) {
    if (COMMON_PASSWORDS.includes(plaintext.toLowerCase())) {
      common.push(title);
    }
  }
  if (common.length > 0) {
    results.push({
      type: 'common',
      severity: 'critical',
      title: 'Common Passwords',
      description: `${common.length} password(s) are in the list of most commonly used passwords.`,
      affectedCount: common.length,
      affectedPasswords: common,
    });
  }

  // 4. Expired passwords
  const now = new Date();
  const expired = passwords.filter((p) => p.expiryDate && p.expiryDate < now);
  if (expired.length > 0) {
    results.push({
      type: 'expired',
      severity: 'medium',
      title: 'Expired Passwords',
      description: `${expired.length} password(s) have passed their expiry date.`,
      affectedCount: expired.length,
      affectedPasswords: expired.map((p) => p.title),
    });
  }

  // 5. Sequential patterns
  const sequential: string[] = [];
  for (const { title, plaintext } of plaintextValues) {
    if (/123|abc|qwerty|asdf/i.test(plaintext)) {
      sequential.push(title);
    }
  }
  if (sequential.length > 0) {
    results.push({
      type: 'sequential',
      severity: 'medium',
      title: 'Sequential Patterns',
      description: `${sequential.length} password(s) contain sequential patterns.`,
      affectedCount: sequential.length,
      affectedPasswords: sequential,
    });
  }

  // 6. No recovery (encryption users without recovery setup)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptionEnabled: true, encryptedDEK: true },
    });
    if (user?.encryptionEnabled && !user?.encryptedDEK) {
      results.push({
        type: 'weak_recovery',
        severity: 'high',
        title: 'No Recovery Setup',
        description: 'Encryption is enabled but recovery data is missing.',
        affectedCount: 1,
        affectedPasswords: [],
      });
    }
  }

  // 7. HIBP breach check (decryptable entries only; USER_MASTER skipped)
  if (checkBreaches && plaintextValues.length > 0) {
    const breached: string[] = [];
    const unique = new Map<string, string[]>();
    for (const { title, plaintext } of plaintextValues) {
      const list = unique.get(plaintext) || [];
      list.push(title);
      unique.set(plaintext, list);
    }
    let checked = 0;
    for (const [plaintext, titles] of unique) {
      if (checked >= 40) break; // rate-limit budget per scan
      try {
        const count = await hibpPwnedCount(plaintext);
        if (count > 0) breached.push(...titles);
        checked++;
        // polite spacing for HIBP
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        logger.warn('HIBP check failed', { error: e instanceof Error ? e.message : String(e) });
        break;
      }
    }
    if (breached.length > 0) {
      results.push({
        type: 'breach',
        severity: 'critical',
        title: 'Found in Known Breaches',
        description: `${breached.length} password(s) appear in the Have I Been Pwned dataset (k-anonymity check). USER_MASTER entries are not scanned server-side.`,
        affectedCount: breached.length,
        affectedPasswords: breached,
      });
    }
  }

  // Calculate risk score (0 = best, 100 = worst)
  const severityWeights = { critical: 25, high: 15, medium: 8, low: 3 };
  let totalWeight = 0;
  for (const r of results) {
    totalWeight += severityWeights[r.severity] * Math.min(r.affectedCount, 5);
  }
  const riskScore = Math.min(100, totalWeight);

  // Grade
  let grade: string;
  if (riskScore === 0) grade = 'A';
  else if (riskScore <= 15) grade = 'B';
  else if (riskScore <= 35) grade = 'C';
  else if (riskScore <= 60) grade = 'D';
  else grade = 'F';

  return { results, riskScore, grade };
}
