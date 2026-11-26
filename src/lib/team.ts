import prisma from './db';

export async function createTeam(data: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  icon?: string;
  color?: string;
  label?: string;
  createdBy: string;
  organizationId?: string;
}) {
  const team = await prisma.team.create({
    data: {
      name: data.name,
      description: data.description,
      isPrivate: data.isPrivate ?? false,
      icon: data.icon,
      color: data.color,
      label: data.label,
      createdBy: data.createdBy,
      organizationId: data.organizationId,
    },
  });

  // Add creator as OWNER
  await prisma.teamMembership.create({
    data: {
      teamId: team.id,
      userId: data.createdBy,
      role: 'OWNER',
      isActive: true,
    },
  });

  return team;
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role = 'MEMBER',
  invitedBy?: string
) {
  return prisma.teamMembership.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: { role, isActive: true },
    create: { teamId, userId, role, invitedBy, isActive: true },
  });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return prisma.teamMembership.update({
    where: { teamId_userId: { teamId, userId } },
    data: { isActive: false },
  });
}

export async function getTeamMembers(teamId: string) {
  return prisma.teamMembership.findMany({
    where: { teamId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        },
      },
    },
  });
}

export async function getUserTeams(userId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId, isActive: true },
    include: {
      team: {
        include: {
          _count: {
            select: {
              memberships: { where: { isActive: true } },
              passwords: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.team,
    role: m.role,
    memberCount: m.team._count.memberships,
    passwordCount: m.team._count.passwords,
  }));
}

export function canManageTeam(memberRole: string): boolean {
  return ['OWNER', 'ADMIN'].includes(memberRole);
}

export async function getTeamRole(userId: string, teamId: string): Promise<string | null> {
  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true, isActive: true },
  });
  if (!membership?.isActive) return null;
  return membership.role;
}

export async function assertTeamMembership(
  userId: string,
  teamId: string
): Promise<{ role: string } | null> {
  const role = await getTeamRole(userId, teamId);
  return role ? { role } : null;
}
