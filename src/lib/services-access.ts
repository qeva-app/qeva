import prisma from '@/lib/db';
import { getUserFeatureAccess } from '@/lib/feature-access';
import { isSuperAdminEmail } from '@/lib/super-admin';

/** Org feature gate shared by Services catalog + probe routes. */
export async function userCanAccessServices(
  userId: string,
  sessionRole?: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
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
  });
  if (!user) return false;
  return getUserFeatureAccess({
    accountType: user.accountType,
    role: sessionRole,
    isSuperAdmin: isSuperAdminEmail(user.email),
    organization: user.organization,
  }).canAccessServices;
}
