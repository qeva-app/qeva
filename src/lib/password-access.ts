import prisma from '@/lib/db';
import {
  decrypt,
  decryptWithKey,
  decryptNotes,
} from '@/lib/encryption-unified';
import { resolveVaultKey } from '@/lib/org-encryption';
import { canManageTeam } from '@/lib/team';
import { getDEK } from '@/lib/encryption-session';
import { getUserFeatureAccess } from '@/lib/feature-access';

export interface PasswordAccessContext {
  userId: string;
  role: string;
  organizationId: string | null;
  accountType: string | null;
  teamIds: string[];
  canAccessGlobalVault: boolean;
  canAccessTeams: boolean;
}

type PasswordEntryLike = {
  id: string;
  userId: string;
  isGlobal: boolean;
  isTeam: boolean;
  teamId: string | null;
  encryptionType?: string | null;
  encryptedPassword?: string;
  notes?: string | null;
  user?: { organizationId?: string | null } | null;
  team?: { organizationId?: string | null } | null;
};

export type ToClientOptions = {
  /** When false (default for lists), ciphertext is not decrypted into the response. */
  includeSecret?: boolean;
};

/** Load org + active team memberships for access checks. */
export async function getPasswordAccessContext(
  userId: string,
  role?: string | null
): Promise<PasswordAccessContext> {
  const resolvedRole = role || 'USER';
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        accountType: true,
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
            status: true,
            trialStartDate: true,
            trialDays: true,
          },
        },
      },
    }),
    prisma.teamMembership.findMany({
      where: { userId, isActive: true },
      select: { teamId: true },
    }),
  ]);

  const access = getUserFeatureAccess({
    accountType: user?.accountType,
    role: resolvedRole,
    organization: user?.organization,
  });

  return {
    userId,
    role: resolvedRole,
    organizationId: user?.organizationId ?? null,
    accountType: user?.accountType ?? null,
    teamIds: memberships.map((m) => m.teamId),
    canAccessGlobalVault: access.canAccessGlobalVault,
    canAccessTeams: access.canAccessTeams,
  };
}

/** Prisma where for every entry the user may see. */
export function buildAccessibleWhere(ctx: PasswordAccessContext) {
  const conditions: Record<string, unknown>[] = [
    { userId: ctx.userId, isGlobal: false, isTeam: false },
  ];

  if (ctx.organizationId && ctx.canAccessGlobalVault) {
    conditions.push({
      isGlobal: true,
      user: { organizationId: ctx.organizationId },
    });
  }

  if (ctx.teamIds.length > 0 && ctx.canAccessTeams) {
    conditions.push({
      isTeam: true,
      teamId: { in: ctx.teamIds },
    });
  }

  return { OR: conditions };
}

export function canViewPassword(entry: PasswordEntryLike, ctx: PasswordAccessContext): boolean {
  if (entry.isGlobal) {
    if (!ctx.canAccessGlobalVault || !ctx.organizationId) return false;
    const ownerOrg = entry.user?.organizationId;
    if (ownerOrg === undefined) return false;
    return ownerOrg === ctx.organizationId;
  }

  if (entry.isTeam && entry.teamId) {
    if (!ctx.canAccessTeams) return false;
    return ctx.teamIds.includes(entry.teamId);
  }

  return entry.userId === ctx.userId;
}

export function canEditPassword(
  entry: PasswordEntryLike,
  ctx: PasswordAccessContext,
  teamRole?: string | null
): boolean {
  if (entry.isGlobal) {
    if (!ctx.canAccessGlobalVault || !ctx.organizationId) return false;
    if (entry.userId === ctx.userId) return true;
    return (
      ctx.role === 'ADMIN' && entry.user?.organizationId === ctx.organizationId
    );
  }

  if (entry.isTeam && entry.teamId) {
    if (!ctx.canAccessTeams || !ctx.teamIds.includes(entry.teamId)) return false;
    if (entry.userId === ctx.userId) return true;
    return !!teamRole && canManageTeam(teamRole);
  }

  return entry.userId === ctx.userId;
}

export function canDeletePassword(
  entry: PasswordEntryLike,
  ctx: PasswordAccessContext,
  teamRole?: string | null
): boolean {
  if (entry.isGlobal) {
    if (!ctx.canAccessGlobalVault || !ctx.organizationId) return false;
    if (entry.userId === ctx.userId) return true;
    return (
      ctx.role === 'ADMIN' && entry.user?.organizationId === ctx.organizationId
    );
  }

  if (entry.isTeam && entry.teamId) {
    if (!ctx.canAccessTeams) return false;
    if (entry.userId === ctx.userId) return true;
    if (
      ctx.role === 'ADMIN' &&
      ctx.organizationId &&
      entry.team?.organizationId === ctx.organizationId
    ) {
      return true;
    }
    if (ctx.teamIds.includes(entry.teamId)) {
      return !!teamRole && canManageTeam(teamRole);
    }
    return false;
  }

  return entry.userId === ctx.userId;
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
  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true, isActive: true },
  });
  if (!membership?.isActive) return null;
  return { role: membership.role };
}

function decryptSecretFields(
  entry: PasswordEntryLike,
  ctx?: PasswordAccessContext
): { decryptedPassword: string; notes: string | null; locked: boolean } {
  const { encryptedPassword, notes: rawNotes } = entry;
  let decryptedPassword = '';
  let notes: string | null = rawNotes ?? null;
  let locked = false;
  let dek: Buffer | null = null;

  const isMaster = entry.encryptionType === 'USER_MASTER';
  if (isMaster) {
    if (!ctx?.userId) {
      locked = true;
      return { decryptedPassword: '', notes: null, locked };
    }
    dek = getDEK(ctx.userId);
    if (!dek) {
      locked = true;
      return { decryptedPassword: '', notes: null, locked };
    }
  }

  const orgId = entry.user?.organizationId ?? entry.team?.organizationId ?? null;
  const orgKey = resolveVaultKey({
    encryptionType: entry.encryptionType,
    organizationId: orgId,
  });

  if (encryptedPassword) {
    try {
      if (isMaster && dek) {
        decryptedPassword = decryptWithKey(encryptedPassword, dek).toString('utf8');
      } else {
        decryptedPassword = decrypt(encryptedPassword, orgKey);
      }
    } catch {
      decryptedPassword = '';
    }
  }

  if (rawNotes) {
    try {
      if (isMaster && dek) notes = decryptNotes(rawNotes, dek);
      else notes = decryptNotes(rawNotes, orgKey);
    } catch {
      notes = rawNotes;
    }
  }

  return { decryptedPassword, notes, locked };
}

/** Strip ciphertext; decrypt only when includeSecret is true. */
export function toClientPassword<T extends PasswordEntryLike>(
  entry: T,
  ctx?: PasswordAccessContext,
  teamRole?: string | null,
  options?: ToClientOptions
) {
  const includeSecret = options?.includeSecret === true;
  const { encryptedPassword, ...rest } = entry as T & { encryptedPassword?: string };

  let decryptedPassword = '';
  let locked = false;
  let notes = (rest as { notes?: string | null }).notes ?? null;

  if (includeSecret && encryptedPassword) {
    const secret = decryptSecretFields(entry, ctx);
    decryptedPassword = secret.decryptedPassword;
    locked = secret.locked;
    notes = secret.notes;
  } else if (entry.encryptionType === 'USER_MASTER' && ctx?.userId && !getDEK(ctx.userId)) {
    locked = true;
  }

  const { notes: _rawNotes, ...withoutNotes } = rest as T & { notes?: string | null };
  void _rawNotes;
  void encryptedPassword;

  const permissions = ctx
    ? {
        canEdit: canEditPassword(entry, ctx, teamRole),
        canDelete: canDeletePassword(entry, ctx, teamRole),
        canFavorite: entry.userId === ctx.userId,
      }
    : undefined;

  return {
    ...withoutNotes,
    notes: includeSecret ? notes : null,
    decryptedPassword: includeSecret ? decryptedPassword : '',
    locked,
    permissions,
  };
}

export function toClientPasswordList<T extends PasswordEntryLike>(
  entries: T[],
  ctx?: PasswordAccessContext,
  teamRoles?: Map<string, string>,
  options?: ToClientOptions
) {
  return entries.map((entry) =>
    toClientPassword(
      entry,
      ctx,
      entry.teamId && teamRoles ? teamRoles.get(entry.teamId) : null,
      options
    )
  );
}
