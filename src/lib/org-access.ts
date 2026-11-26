import prisma from '@/lib/db';

/** Same-org check for admin/manager actions against another user. */
export async function assertSameOrganization(
  actorId: string,
  targetUserId: string
): Promise<{ ok: true; organizationId: string } | { ok: false; status: number; error: string }> {
  if (actorId === targetUserId) {
    const self = await prisma.user.findUnique({
      where: { id: actorId },
      select: { organizationId: true },
    });
    if (!self?.organizationId) {
      return { ok: false, status: 403, error: 'Organization required' };
    }
    return { ok: true, organizationId: self.organizationId };
  }

  const [actor, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { organizationId: true },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { organizationId: true },
    }),
  ]);

  if (!target) {
    return { ok: false, status: 404, error: 'User not found' };
  }

  if (!actor?.organizationId || !target.organizationId) {
    return { ok: false, status: 403, error: 'Organization required' };
  }

  if (actor.organizationId !== target.organizationId) {
    return { ok: false, status: 403, error: 'User is not in your organization' };
  }

  return { ok: true, organizationId: actor.organizationId };
}

export async function getActorOrganizationId(actorId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}
