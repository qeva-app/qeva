import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { getUserFeatureAccess } from '@/lib/feature-access';
import { isSuperAdminEmail } from '@/lib/super-admin';
import { getEditionInfo } from '@/lib/edition';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      accountType: true,
      organizationId: true,
      encryptionEnabled: true,
      organization: {
        select: {
          id: true,
          name: true,
          domain: true,
          logo: true,
          status: true,
          trialStartDate: true,
          trialDays: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const access = getUserFeatureAccess({
    accountType: user.accountType,
    role: session.user.role,
    isSuperAdmin,
    organization: user.organization,
  });

  const orgDomain =
    user.organization?.domain ||
    (user.email.includes('@') ? user.email.split('@')[1]?.toLowerCase() : null);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      accountType: user.accountType,
      organizationId: user.organizationId,
      encryptionEnabled: user.encryptionEnabled,
      role: session.user.role,
    },
    access,
    orgDomain,
    isSuperAdmin,
    edition: getEditionInfo(),
  });
}
