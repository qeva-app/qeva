import prisma from '@/lib/db';

/** Walk the manager chain; true if assigning managerId to userId would cycle. */
export async function wouldCreateManagerCycle(
  userId: string,
  managerId: string | null
): Promise<boolean> {
  if (!managerId) return false;
  if (managerId === userId) return true;

  let current: string | null = managerId;
  const seen = new Set<string>([userId]);
  // Cap depth to avoid runaway walks
  for (let i = 0; i < 50 && current; i++) {
    if (seen.has(current)) return true;
    seen.add(current);
    const row: { managerId: string | null } | null = await prisma.user.findUnique({
      where: { id: current },
      select: { managerId: true },
    });
    current = row?.managerId ?? null;
  }
  return false;
}

/**
 * Set optional manager (Reports to). Both users must be in organizationId.
 * Pass managerId null to clear.
 */
export async function setUserManager(params: {
  organizationId: string;
  userId: string;
  managerId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { organizationId, userId, managerId } = params;

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: 'User not found in organization' };

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!manager) return { ok: false, error: 'Manager not found in organization' };
    if (await wouldCreateManagerCycle(userId, managerId)) {
      return { ok: false, error: 'That manager would create a reporting cycle' };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { managerId },
  });
  return { ok: true };
}
