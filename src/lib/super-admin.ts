/**
 * Platform super-admin is a single allowlisted email from SUPER_ADMIN_EMAIL.
 * Org ADMIN role is separate and must not unlock this.
 */

export function isSuperAdminEmail(email?: string | null): boolean {
  const allowed = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
}

export function requireSuperAdmin(session: {
  user?: { email?: string | null } | null;
} | null): boolean {
  return !!session?.user?.email && isSuperAdminEmail(session.user.email);
}
