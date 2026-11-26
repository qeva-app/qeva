const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const steps = [
  {
    title: 'Welcome to your org vault',
    description:
      'Qeva keeps personal, team, and global credentials encrypted and role-scoped.',
    sortOrder: 0,
    stepType: 'INFO',
    actionKey: 'WELCOME',
    isRequired: true,
  },
  {
    title: 'Enable encryption',
    description: 'Set a master password so vault secrets stay zero-knowledge.',
    sortOrder: 1,
    stepType: 'ACTION',
    actionKey: 'ENABLE_ENCRYPTION',
    href: '/settings',
    isRequired: true,
  },
  {
    title: 'Join a team',
    description: 'Join or ask an admin to invite you.',
    sortOrder: 2,
    stepType: 'ACTION',
    actionKey: 'JOIN_TEAM',
    href: '/teams',
    isRequired: true,
  },
  {
    title: 'Add your first password',
    description: 'Store a credential in your vault.',
    sortOrder: 3,
    stepType: 'ACTION',
    actionKey: 'CREATE_PASSWORD',
    href: '/vault?action=add',
    isRequired: true,
  },
  {
    title: 'Generate a strong secret',
    description: 'Use the generator for a policy-compliant password.',
    sortOrder: 4,
    stepType: 'LINK',
    actionKey: 'OPEN_GENERATOR',
    href: '/generator',
    isRequired: false,
  },
  {
    title: 'Review password health',
    description: 'Check weak or aging credentials.',
    sortOrder: 5,
    stepType: 'LINK',
    actionKey: 'REVIEW_HEALTH',
    href: '/health',
    isRequired: false,
  },
];

async function main() {
  const orgs = await p.organization.findMany({ select: { id: true, name: true } });
  let created = 0;
  for (const org of orgs) {
    const ex = await p.workflow.findUnique({
      where: {
        organizationId_slug: {
          organizationId: org.id,
          slug: 'general-onboarding',
        },
      },
    });
    if (ex) continue;
    await p.workflow.create({
      data: {
        organizationId: org.id,
        name: 'General Onboarding',
        slug: 'general-onboarding',
        type: 'ONBOARDING',
        description: 'Default checklist for new organization members.',
        isActive: true,
        isRequired: true,
        audience: 'ALL',
        steps: { create: steps },
      },
    });
    created += 1;
    console.log('seeded', org.name);
  }
  console.log(`done, created ${created} for ${orgs.length} orgs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
