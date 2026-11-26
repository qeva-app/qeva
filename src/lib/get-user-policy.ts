import prisma from '@/lib/db';
import {
  DEFAULT_PASSWORD_POLICY,
  parsePasswordPolicy,
  type PasswordPolicy,
} from '@/lib/password-policy';

export async function getPasswordPolicyForUser(userId: string): Promise<PasswordPolicy> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      organization: { select: { passwordPolicy: true } },
    },
  });

  if (!user?.organizationId || !user.organization?.passwordPolicy) {
    return { ...DEFAULT_PASSWORD_POLICY };
  }

  try {
    const parsed = JSON.parse(user.organization.passwordPolicy);
    return parsePasswordPolicy(parsed);
  } catch {
    return { ...DEFAULT_PASSWORD_POLICY };
  }
}
