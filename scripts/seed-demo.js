/**
 * Qeva demo seed — realistic org + individual vaults for product demos.
 *
 * Run:  npm run seed:demo
 * Force refresh of demo passwords:  node scripts/seed-demo.js --refresh
 *
 * Login password for every demo user: Demo@1234
 *
 * Demo story
 * ──────────
 * Acme Corp (ACTIVE) — primary walkthrough org
 *   Sarah Chen   admin@acmecorp.com   ADMIN   — full vault, onboarding complete
 *   James Wilson manager@acmecorp.com MANAGER — Security team owner
 *   Priya Sharma  dev@acmecorp.com    USER    — Engineering
 *   Mike Rodriguez ops@acmecorp.com   USER    — DevOps
 *   Ava Nguyen    newhire@acmecorp.com USER   — incomplete onboarding (banner demo)
 *
 * NovaTech Labs (TRIAL) — secondary org with light data
 *
 * Individuals — personal vault only
 *   john@gmail.com / alex@outlook.com
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Load .env without depending on dotenv package
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
})();

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const REFRESH = process.argv.includes('--refresh');
const DEMO_PASSWORD = 'Demo@1234';
const GENERAL_ONBOARDING_SLUG = 'general-onboarding';

const ACME_POLICY = {
  minLength: 14,
  maxLength: 128,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true,
  excludeAmbiguous: false,
  excludeSimilar: true,
  defaultMode: 'password',
  rotationDays: 90,
  expiryWarningDays: 14,
};

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to your org vault',
    description:
      'Qeva keeps personal, team, and global credentials encrypted and role-scoped. This short checklist gets your account ready.',
    sortOrder: 0,
    stepType: 'INFO',
    actionKey: 'WELCOME',
    href: null,
    isRequired: true,
  },
  {
    title: 'Enable encryption',
    description: 'Set a master password so vault secrets stay zero-knowledge on this device.',
    sortOrder: 1,
    stepType: 'ACTION',
    actionKey: 'ENABLE_ENCRYPTION',
    href: '/settings',
    isRequired: true,
  },
  {
    title: 'Join a team',
    description: 'Teams share credentials with membership roles. Join or ask an admin to invite you.',
    sortOrder: 2,
    stepType: 'ACTION',
    actionKey: 'JOIN_TEAM',
    href: '/teams',
    isRequired: true,
  },
  {
    title: 'Add your first password',
    description: 'Store a credential in your personal or team vault.',
    sortOrder: 3,
    stepType: 'ACTION',
    actionKey: 'CREATE_PASSWORD',
    href: '/vault?action=add',
    isRequired: true,
  },
  {
    title: 'Generate a strong secret',
    description: 'Use the generator to create a policy-compliant password or passphrase.',
    sortOrder: 4,
    stepType: 'LINK',
    actionKey: 'OPEN_GENERATOR',
    href: '/generator',
    isRequired: false,
  },
  {
    title: 'Review password health',
    description: 'Check weak, reused, or aging credentials across your vault.',
    sortOrder: 5,
    stepType: 'LINK',
    actionKey: 'REVIEW_HEALTH',
    href: '/health',
    isRequired: false,
  },
];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function encrypt(plaintext) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set — add it to .env');
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    version: 'v2',
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted,
  });
}

async function ensureRoles() {
  const roles = {};
  for (const name of ['ADMIN', 'MANAGER', 'USER']) {
    let role = await prisma.role.findFirst({ where: { name, isSystem: true } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name,
          description: `${name} role`,
          isSystem: true,
          isActive: true,
          organizationId: null,
          permissions: '[]',
        },
      });
    }
    roles[name] = role;
  }
  return roles;
}

async function upsertUser({
  email,
  username,
  firstName,
  lastName,
  roleName,
  roles,
  hashedPw,
  accountType,
  organizationId,
  department,
  position,
  jobTitle,
}) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashedPw,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        isVerified: true,
        isActive: true,
        accountType,
        organizationId: organizationId || null,
        department: department || null,
        position: position || null,
        jobTitle: jobTitle || position || null,
      },
    });
    const assignment = await prisma.userRoleAssignment.findFirst({
      where: { userId: updated.id, isPrimary: true },
    });
    if (assignment) {
      await prisma.userRoleAssignment.update({
        where: { id: assignment.id },
        data: { roleId: roles[roleName].id, isActive: true },
      });
    } else {
      await prisma.userRoleAssignment.create({
        data: {
          userId: updated.id,
          roleId: roles[roleName].id,
          isPrimary: true,
          isActive: true,
        },
      });
    }
    return updated;
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPw,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      isVerified: true,
      isActive: true,
      accountType,
      organizationId: organizationId || null,
      department: department || null,
      position: position || null,
      jobTitle: jobTitle || position || null,
    },
  });
  await prisma.userRoleAssignment.create({
    data: {
      userId: user.id,
      roleId: roles[roleName].id,
      isPrimary: true,
      isActive: true,
    },
  });
  return user;
}

async function ensureTeam(orgId, creatorId, def) {
  const existing = await prisma.team.findFirst({
    where: { name: def.name, organizationId: orgId },
  });
  if (existing) {
    return prisma.team.update({
      where: { id: existing.id },
      data: {
        description: def.description,
        color: def.color,
        icon: def.icon,
        isActive: true,
      },
    });
  }
  return prisma.team.create({
    data: {
      name: def.name,
      description: def.description,
      color: def.color,
      icon: def.icon,
      isActive: true,
      createdBy: creatorId,
      organizationId: orgId,
    },
  });
}

async function ensureMembership(teamId, userId, role) {
  const existing = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing) {
    return prisma.teamMembership.update({
      where: { id: existing.id },
      data: { role, isActive: true },
    });
  }
  return prisma.teamMembership.create({
    data: { teamId, userId, role, isActive: true },
  });
}

async function upsertPassword(p) {
  if (p.isTeam && !p.teamId) return false;
  const existing = await prisma.passwordEntry.findFirst({
    where: { title: p.title, userId: p.userId },
  });

  const data = {
    title: p.title,
    username: p.username || null,
    encryptedPassword: encrypt(p.password),
    website: p.website || null,
    category: p.category || null,
    notes: p.notes || null,
    tags: p.tags || null,
    strength: p.strength ?? 70,
    color: p.color || null,
    label: p.label || null,
    isFavorite: !!p.isFavorite,
    isGlobal: !!p.isGlobal,
    isTeam: !!p.isTeam,
    teamId: p.teamId || null,
    expiryDate: p.expiryDate || null,
    lastUsed: p.lastUsed || null,
    encryptionType: 'PUBLIC_KEY',
    createdAt: p.createdAt || undefined,
  };

  if (existing) {
    if (!REFRESH) return false;
    await prisma.passwordEntry.update({
      where: { id: existing.id },
      data: {
        ...data,
        createdAt: undefined,
      },
    });
    return true;
  }

  await prisma.passwordEntry.create({
    data: { ...data, userId: p.userId },
  });
  return true;
}

async function ensureGeneralOnboarding(organizationId) {
  const existing = await prisma.workflow.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug: GENERAL_ONBOARDING_SLUG,
      },
    },
    include: { steps: true },
  });
  if (existing) return existing;

  return prisma.workflow.create({
    data: {
      organizationId,
      name: 'General Onboarding',
      slug: GENERAL_ONBOARDING_SLUG,
      type: 'ONBOARDING',
      description:
        'Default checklist for new organization members. Admins can edit steps under Settings.',
      isActive: true,
      isRequired: true,
      audience: 'ALL',
      sortOrder: 0,
      steps: { create: ONBOARDING_STEPS },
    },
    include: { steps: true },
  });
}

async function completeWorkflowForUser(workflow, userId) {
  let progress = await prisma.workflowProgress.findUnique({
    where: { workflowId_userId: { workflowId: workflow.id, userId } },
  });
  if (!progress) {
    progress = await prisma.workflowProgress.create({
      data: {
        workflowId: workflow.id,
        userId,
        status: 'IN_PROGRESS',
        startedAt: daysAgo(5),
      },
    });
  }

  for (const step of workflow.steps) {
    await prisma.workflowStepCompletion.upsert({
      where: {
        progressId_stepId: { progressId: progress.id, stepId: step.id },
      },
      create: {
        progressId: progress.id,
        stepId: step.id,
        autoCompleted: false,
        completedAt: daysAgo(4),
      },
      update: {},
    });
  }

  await prisma.workflowProgress.update({
    where: { id: progress.id },
    data: {
      status: 'COMPLETED',
      startedAt: progress.startedAt || daysAgo(5),
      completedAt: daysAgo(3),
      dismissedAt: null,
    },
  });
}

async function seedDemo() {
  console.log('\n🔐 Seeding Qeva demo data...\n');
  if (REFRESH) console.log('  Mode: --refresh (updating existing demo passwords)\n');

  const roles = await ensureRoles();
  const hashedPw = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // ── Organizations ─────────────────────────────────────────
  console.log('📦 Organizations');

  const acme = await prisma.organization.upsert({
    where: { name: 'Acme Corp' },
    update: {
      domain: 'acmecorp.com',
      description: 'Enterprise SaaS — primary Qeva demo organization',
      status: 'ACTIVE',
      contactEmail: 'admin@acmecorp.com',
      trialStartDate: daysAgo(45),
      trialDays: 90,
      approvedAt: daysAgo(45),
      isActive: true,
      passwordPolicy: JSON.stringify(ACME_POLICY),
    },
    create: {
      name: 'Acme Corp',
      domain: 'acmecorp.com',
      description: 'Enterprise SaaS — primary Qeva demo organization',
      status: 'ACTIVE',
      contactEmail: 'admin@acmecorp.com',
      trialStartDate: daysAgo(45),
      trialDays: 90,
      approvedAt: daysAgo(45),
      isActive: true,
      passwordPolicy: JSON.stringify(ACME_POLICY),
    },
  });
  console.log('  ✓ Acme Corp (ACTIVE) + password policy');

  const nova = await prisma.organization.upsert({
    where: { name: 'NovaTech Labs' },
    update: {
      domain: 'novatech.io',
      description: 'AI startup on trial — secondary demo org',
      status: 'TRIAL',
      contactEmail: 'founder@novatech.io',
      trialStartDate: daysAgo(3),
      trialDays: 14,
      approvedAt: daysAgo(3),
      isActive: true,
    },
    create: {
      name: 'NovaTech Labs',
      domain: 'novatech.io',
      description: 'AI startup on trial — secondary demo org',
      status: 'TRIAL',
      contactEmail: 'founder@novatech.io',
      trialStartDate: daysAgo(3),
      trialDays: 14,
      approvedAt: daysAgo(3),
      isActive: true,
    },
  });
  console.log('  ✓ NovaTech Labs (TRIAL)');

  // ── Users ─────────────────────────────────────────────────
  console.log('\n👥 Users');

  const sarah = await upsertUser({
    email: 'admin@acmecorp.com',
    username: 'sarah.chen',
    firstName: 'Sarah',
    lastName: 'Chen',
    roleName: 'ADMIN',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: acme.id,
    department: 'Engineering',
    position: 'CTO',
  });
  console.log('  ✓ admin@acmecorp.com (ADMIN)');

  const james = await upsertUser({
    email: 'manager@acmecorp.com',
    username: 'james.wilson',
    firstName: 'James',
    lastName: 'Wilson',
    roleName: 'MANAGER',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: acme.id,
    department: 'Security',
    position: 'Security Lead',
  });
  console.log('  ✓ manager@acmecorp.com (MANAGER)');

  const priya = await upsertUser({
    email: 'dev@acmecorp.com',
    username: 'priya.sharma',
    firstName: 'Priya',
    lastName: 'Sharma',
    roleName: 'USER',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: acme.id,
    department: 'Engineering',
    position: 'Senior Engineer',
  });
  console.log('  ✓ dev@acmecorp.com (USER)');

  const mike = await upsertUser({
    email: 'ops@acmecorp.com',
    username: 'mike.rodriguez',
    firstName: 'Mike',
    lastName: 'Rodriguez',
    roleName: 'USER',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: acme.id,
    department: 'Platform',
    position: 'DevOps Engineer',
  });
  console.log('  ✓ ops@acmecorp.com (USER)');

  const ava = await upsertUser({
    email: 'newhire@acmecorp.com',
    username: 'ava.nguyen',
    firstName: 'Ava',
    lastName: 'Nguyen',
    roleName: 'USER',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: acme.id,
    department: 'Engineering',
    position: 'Software Engineer',
  });
  console.log('  ✓ newhire@acmecorp.com (USER — onboarding pending)');

  const founder = await upsertUser({
    email: 'founder@novatech.io',
    username: 'ria.kapoor',
    firstName: 'Ria',
    lastName: 'Kapoor',
    roleName: 'ADMIN',
    roles,
    hashedPw,
    accountType: 'ORGANIZATION',
    organizationId: nova.id,
    department: 'Founders',
    position: 'CEO',
  });
  console.log('  ✓ founder@novatech.io (NovaTech ADMIN)');

  const john = await upsertUser({
    email: 'john@gmail.com',
    username: 'john.doe',
    firstName: 'John',
    lastName: 'Doe',
    roleName: 'USER',
    roles,
    hashedPw,
    accountType: 'INDIVIDUAL',
  });
  console.log('  ✓ john@gmail.com (INDIVIDUAL)');

  const alex = await upsertUser({
    email: 'alex@outlook.com',
    username: 'alex.turner',
    firstName: 'Alex',
    lastName: 'Turner',
    roleName: 'USER',
    roles,
    hashedPw,
    accountType: 'INDIVIDUAL',
  });
  console.log('  ✓ alex@outlook.com (INDIVIDUAL)');

  // ── Teams ─────────────────────────────────────────────────
  console.log('\n🏢 Teams');

  const engineering = await ensureTeam(acme.id, sarah.id, {
    name: 'Engineering',
    description: 'Product engineering — shared staging & CI secrets',
    color: '#2563EB',
    icon: 'Code',
  });
  const devops = await ensureTeam(acme.id, mike.id, {
    name: 'DevOps',
    description: 'Infrastructure, Kubernetes, and observability',
    color: '#059669',
    icon: 'Server',
  });
  const security = await ensureTeam(acme.id, james.id, {
    name: 'Security',
    description: 'AppSec tooling and privileged break-glass accounts',
    color: '#DC2626',
    icon: 'Shield',
  });
  console.log('  ✓ Engineering, DevOps, Security');

  await ensureMembership(engineering.id, sarah.id, 'OWNER');
  await ensureMembership(engineering.id, priya.id, 'MEMBER');
  await ensureMembership(engineering.id, mike.id, 'MEMBER');
  await ensureMembership(engineering.id, james.id, 'VIEWER');
  // Ava intentionally not on a team yet — onboarding step stays open

  await ensureMembership(devops.id, mike.id, 'OWNER');
  await ensureMembership(devops.id, priya.id, 'MEMBER');
  await ensureMembership(devops.id, sarah.id, 'ADMIN');

  await ensureMembership(security.id, james.id, 'OWNER');
  await ensureMembership(security.id, sarah.id, 'ADMIN');
  console.log('  ✓ Memberships (Ava left unassigned for onboarding demo)');

  // ── Workflows ─────────────────────────────────────────────
  console.log('\n🧭 Workflows');
  const acmeOnboarding = await ensureGeneralOnboarding(acme.id);
  await ensureGeneralOnboarding(nova.id);

  // Veterans finished onboarding; Ava (new hire) stays pending
  for (const u of [sarah, james, priya, mike, founder]) {
    const wf =
      u.organizationId === nova.id
        ? await ensureGeneralOnboarding(nova.id)
        : acmeOnboarding;
    await completeWorkflowForUser(wf, u.id);
  }
  console.log('  ✓ General Onboarding ensured; completed for veterans');
  console.log('  ✓ newhire@acmecorp.com still pending (banner + sidebar)');

  // ── Passwords ─────────────────────────────────────────────
  console.log('\n🔑 Passwords');

  // Intentionally reused weak secret for health "reused" findings
  const REUSED = 'Welcome2024!';

  const passwordDefs = [
    // Sarah — personal (strong, favorites, age variety)
    {
      title: 'AWS Console (Prod)',
      username: 'sarah.chen@acmecorp.com',
      password: 'AwsR00t!2026#AcmeSecureVault',
      website: 'https://console.aws.amazon.com',
      category: 'Cloud Platforms',
      strength: 94,
      userId: sarah.id,
      color: '#FF9900',
      isFavorite: true,
      tags: 'aws,prod,infra',
      notes: 'Root-adjacent IAM user — rotate after contractor offboarding.',
      lastUsed: daysAgo(1),
      createdAt: daysAgo(60),
      expiryDate: daysFromNow(55),
    },
    {
      title: 'GitHub Enterprise',
      username: 'sarah-chen',
      password: 'Gh!tHub$Enterprise2026Acme',
      website: 'https://github.com/enterprises/acmecorp',
      category: 'Development Tools',
      strength: 90,
      userId: sarah.id,
      color: '#24292E',
      isFavorite: true,
      tags: 'github,source',
      lastUsed: daysAgo(0),
      createdAt: daysAgo(40),
      expiryDate: daysFromNow(50),
    },
    {
      title: 'Okta Admin',
      username: 'sarah.chen',
      password: '0kt4!Adm1n#Acme2026Secure',
      website: 'https://acmecorp.okta.com',
      category: 'Cloud Platforms',
      strength: 92,
      userId: sarah.id,
      color: '#007DC1',
      tags: 'sso,identity',
      createdAt: daysAgo(20),
      expiryDate: daysFromNow(70),
    },
    {
      title: 'Notion Workspace',
      username: 'sarah@acmecorp.com',
      password: 'N0t10n!Docs#AcmeTeam',
      website: 'https://www.notion.so',
      category: 'Documentation',
      strength: 78,
      userId: sarah.id,
      color: '#000000',
      createdAt: daysAgo(15),
      expiryDate: daysFromNow(75),
    },
    // Health: expired
    {
      title: 'Legacy Jenkins',
      username: 'jenkins-admin',
      password: 'J3nk1ns!L3gacy#StillInUse',
      website: 'https://ci-legacy.acmecorp.com',
      category: 'Development Tools',
      strength: 72,
      userId: sarah.id,
      color: '#D24939',
      tags: 'legacy,ci',
      notes: 'Pending migration to GitHub Actions.',
      createdAt: daysAgo(200),
      expiryDate: daysAgo(12),
      lastUsed: daysAgo(20),
    },
    // Health: expiring soon
    {
      title: 'SendGrid SMTP',
      username: 'apikey',
      password: 'SG.demoKey.AcmeMailRelay2026!',
      website: 'https://app.sendgrid.com',
      category: 'API Services',
      strength: 86,
      userId: sarah.id,
      color: '#1A82E2',
      isGlobal: true,
      tags: 'email,smtp',
      createdAt: daysAgo(80),
      expiryDate: daysFromNow(6),
      lastUsed: daysAgo(2),
    },
    // Health: reused pair (same secret)
    {
      title: 'Staging Portal',
      username: 'demo-staging',
      password: REUSED,
      website: 'https://staging.acmecorp.com',
      category: 'Cloud Platforms',
      strength: 28,
      userId: sarah.id,
      color: '#9CA3AF',
      tags: 'staging,reuse-demo',
      notes: 'Intentionally weak + reused for Password Health demo.',
      createdAt: daysAgo(90),
      expiryDate: daysFromNow(30),
    },
    {
      title: 'QA Shared Login',
      username: 'qa-shared',
      password: REUSED,
      website: 'https://qa.acmecorp.com',
      category: 'Development Tools',
      strength: 28,
      userId: sarah.id,
      color: '#9CA3AF',
      tags: 'qa,reuse-demo',
      notes: 'Same secret as Staging Portal — triggers reused finding.',
      createdAt: daysAgo(88),
      expiryDate: daysFromNow(30),
    },
    // Health: very weak
    {
      title: 'Old Guest WiFi',
      username: 'guest',
      password: 'password',
      website: '',
      category: 'Cloud Platforms',
      strength: 8,
      userId: sarah.id,
      color: '#9CA3AF',
      tags: 'wifi,weak',
      notes: 'Should be rotated — kept for health demo.',
      createdAt: daysAgo(300),
      expiryDate: daysAgo(100),
    },

    // Acme global credentials
    {
      title: 'Company VPN',
      username: 'vpn-acme',
      password: 'VPN!AcmeC0rp#2026SecureGate',
      website: 'https://vpn.acmecorp.com',
      category: 'Cloud Platforms',
      strength: 95,
      userId: sarah.id,
      isGlobal: true,
      color: '#059669',
      isFavorite: true,
      tags: 'vpn,global',
      createdAt: daysAgo(50),
      expiryDate: daysFromNow(40),
      lastUsed: daysAgo(1),
    },
    {
      title: 'Confluence Wiki',
      username: 'acme-wiki',
      password: 'C0nfl!W1k1#AcmeKnowledge',
      website: 'https://acmecorp.atlassian.net/wiki',
      category: 'Documentation',
      strength: 82,
      userId: sarah.id,
      isGlobal: true,
      color: '#172B4D',
      createdAt: daysAgo(35),
      expiryDate: daysFromNow(55),
    },
    {
      title: 'Sentry Error Tracking',
      username: 'acme-sentry',
      password: 'S3ntry!Err0r#AcmeTrack2026',
      website: 'https://sentry.io',
      category: 'Analytics Tools',
      strength: 84,
      userId: sarah.id,
      isGlobal: true,
      color: '#362D59',
      createdAt: daysAgo(25),
      expiryDate: daysFromNow(65),
    },

    // Engineering team
    {
      title: 'CI/CD Pipeline Token',
      username: 'ci-bot',
      password: 'C1CD!P1p3l1n3#AcmeT0k3n2026',
      website: 'https://github.com/acmecorp',
      category: 'Development Tools',
      strength: 94,
      userId: priya.id,
      isTeam: true,
      teamId: engineering.id,
      color: '#2563EB',
      tags: 'ci,github',
      createdAt: daysAgo(18),
      expiryDate: daysFromNow(72),
      lastUsed: daysAgo(0),
    },
    {
      title: 'Staging Postgres',
      username: 'staging_admin',
      password: 'St4g1ng!DB#AcmeReadWrite',
      website: '',
      category: 'Databases',
      strength: 88,
      userId: priya.id,
      isTeam: true,
      teamId: engineering.id,
      color: '#336791',
      notes: 'Non-prod only. Never use on production RDS.',
      createdAt: daysAgo(22),
      expiryDate: daysFromNow(8),
    },
    {
      title: 'Docker Hub',
      username: 'acmecorp',
      password: 'D0ck3r!Hub#Acm3PushImages',
      website: 'https://hub.docker.com',
      category: 'Cloud Platforms',
      strength: 85,
      userId: mike.id,
      isTeam: true,
      teamId: engineering.id,
      color: '#2496ED',
      createdAt: daysAgo(30),
      expiryDate: daysFromNow(60),
    },

    // DevOps team
    {
      title: 'Terraform Cloud',
      username: 'acme-tf',
      password: 'T3rr4f0rm!Cloud#AcmeIaC2026',
      website: 'https://app.terraform.io',
      category: 'Cloud Platforms',
      strength: 91,
      userId: mike.id,
      isTeam: true,
      teamId: devops.id,
      color: '#7B42BC',
      isFavorite: true,
      createdAt: daysAgo(14),
      expiryDate: daysFromNow(76),
    },
    {
      title: 'Kubernetes Admin',
      username: 'k8s-admin',
      password: 'K8s!Adm1n#AcmeCluster2026',
      website: '',
      category: 'Cloud Platforms',
      strength: 93,
      userId: mike.id,
      isTeam: true,
      teamId: devops.id,
      color: '#326CE5',
      notes: 'Cluster-admin kubeconfig passphrase reference.',
      createdAt: daysAgo(10),
      expiryDate: daysFromNow(80),
      lastUsed: daysAgo(1),
    },
    {
      title: 'Grafana Dashboard',
      username: 'admin',
      password: 'Gr4f4n4!AcmeObservability',
      website: 'https://grafana.acmecorp.com',
      category: 'Analytics Tools',
      strength: 81,
      userId: mike.id,
      isTeam: true,
      teamId: devops.id,
      color: '#F46800',
      createdAt: daysAgo(28),
      expiryDate: daysFromNow(5),
    },

    // Security team
    {
      title: 'HashiCorp Vault',
      username: 'root',
      password: 'V4ult!R00t#AcmeBreakGlass26',
      website: 'https://vault.acmecorp.com',
      category: 'Cloud Platforms',
      strength: 97,
      userId: james.id,
      isTeam: true,
      teamId: security.id,
      color: '#000000',
      isFavorite: true,
      tags: 'vault,privileged',
      createdAt: daysAgo(12),
      expiryDate: daysFromNow(78),
    },
    {
      title: 'Snyk Security',
      username: 'security@acmecorp.com',
      password: 'Snyk!S3cSc4n#Acme2026',
      website: 'https://app.snyk.io',
      category: 'Development Tools',
      strength: 86,
      userId: james.id,
      isTeam: true,
      teamId: security.id,
      color: '#4C4A73',
      createdAt: daysAgo(16),
      expiryDate: daysFromNow(74),
    },

    // Priya personal
    {
      title: 'Vercel Dashboard',
      username: 'priya@acmecorp.com',
      password: 'V3rc3l!D3ploy#Acme2026',
      website: 'https://vercel.com',
      category: 'Cloud Platforms',
      strength: 84,
      userId: priya.id,
      color: '#000000',
      createdAt: daysAgo(9),
      expiryDate: daysFromNow(81),
      lastUsed: daysAgo(2),
    },
    {
      title: 'npm Account',
      username: 'priya-sharma',
      password: 'Npm!Publish#AcmePkg2026',
      website: 'https://www.npmjs.com',
      category: 'Development Tools',
      strength: 80,
      userId: priya.id,
      color: '#CB3837',
      createdAt: daysAgo(45),
      expiryDate: daysFromNow(45),
    },

    // James personal
    {
      title: '1Password SCIM Bridge',
      username: 'scim-admin',
      password: 'SC1M!Br1dge#AcmeIdP2026',
      website: '',
      category: 'API Services',
      strength: 89,
      userId: james.id,
      color: '#066',
      createdAt: daysAgo(7),
      expiryDate: daysFromNow(83),
    },

    // NovaTech light set
    {
      title: 'OpenAI Platform',
      username: 'founder@novatech.io',
      password: '0penAI!Nova#Labs2026Key',
      website: 'https://platform.openai.com',
      category: 'ML Platforms',
      strength: 88,
      userId: founder.id,
      color: '#10A37F',
      isFavorite: true,
      createdAt: daysAgo(2),
      expiryDate: daysFromNow(88),
    },
    {
      title: 'Linear Workspace',
      username: 'ria',
      password: 'L1n3ar!Nova#ShipFast26',
      website: 'https://linear.app',
      category: 'Project Management',
      strength: 82,
      userId: founder.id,
      color: '#5E6AD2',
      isGlobal: true,
      createdAt: daysAgo(2),
      expiryDate: daysFromNow(88),
    },

    // Individuals
    {
      title: 'Google Account',
      username: 'john.doe@gmail.com',
      password: 'G00gl3!Pers0nal#John2026',
      website: 'https://myaccount.google.com',
      category: 'Email',
      strength: 82,
      userId: john.id,
      color: '#4285F4',
      isFavorite: true,
      createdAt: daysAgo(100),
      expiryDate: daysFromNow(20),
    },
    {
      title: 'GitHub Personal',
      username: 'johndoe-dev',
      password: 'Gh!P3rs0nal#John2026Dev',
      website: 'https://github.com',
      category: 'Development Tools',
      strength: 86,
      userId: john.id,
      color: '#24292E',
      createdAt: daysAgo(50),
      expiryDate: daysFromNow(40),
    },
    {
      title: 'Netflix',
      username: 'john.doe@gmail.com',
      password: 'N3tfl1x!Watch2026',
      website: 'https://netflix.com',
      category: 'Email',
      strength: 62,
      userId: john.id,
      color: '#E50914',
      createdAt: daysAgo(200),
      expiryDate: daysAgo(5),
    },
    {
      title: 'Amazon',
      username: 'john.doe@gmail.com',
      password: 'shop123',
      website: 'https://amazon.com',
      category: 'API Services',
      strength: 18,
      userId: john.id,
      color: '#FF9900',
      notes: 'Weak password for personal health demo.',
      createdAt: daysAgo(400),
    },
    {
      title: 'Outlook Mail',
      username: 'alex@outlook.com',
      password: '0utl00k!M41l#AlexKey26',
      website: 'https://outlook.com',
      category: 'Email',
      strength: 76,
      userId: alex.id,
      color: '#0078D4',
      isFavorite: true,
      createdAt: daysAgo(30),
      expiryDate: daysFromNow(60),
    },
    {
      title: 'Spotify',
      username: 'alex.turner',
      password: 'music',
      website: 'https://spotify.com',
      category: 'Email',
      strength: 10,
      userId: alex.id,
      color: '#1DB954',
      notes: 'Weak password for personal health demo.',
      createdAt: daysAgo(250),
    },
  ];

  let pwCount = 0;
  for (const p of passwordDefs) {
    if (await upsertPassword(p)) pwCount++;
  }
  console.log(`  ✓ ${pwCount} passwords created/updated`);

  // ── Services ──────────────────────────────────────────────
  console.log('\n🌐 Services');
  const services = [
    {
      name: 'AWS',
      description: 'Amazon Web Services',
      icon: 'Cloud',
      category: 'Cloud',
      website: 'https://aws.amazon.com',
      // SigV4 needs a dedicated connector — not in v1 HTTP probes
      probeType: null,
      probeUrl: null,
      probeAuth: null,
    },
    {
      name: 'GitHub',
      description: 'Code hosting and CI/CD',
      icon: 'Code',
      category: 'Development',
      website: 'https://github.com',
      probeType: 'http_bearer',
      probeUrl: 'https://api.github.com/user',
      probeAuth: null,
    },
    {
      name: 'Okta',
      description: 'Identity provider',
      icon: 'Shield',
      category: 'Security',
      website: 'https://okta.com',
      probeType: null,
      probeUrl: null,
      probeAuth: null,
    },
    {
      name: 'Datadog',
      description: 'Monitoring and observability',
      icon: 'BarChart3',
      category: 'Monitoring',
      website: 'https://datadoghq.com',
      probeType: 'http_header',
      probeUrl: 'https://api.datadoghq.com/api/v1/validate',
      probeAuth: 'DD-API-KEY',
    },
    {
      name: 'Sentry',
      description: 'Error tracking',
      icon: 'Bug',
      category: 'Monitoring',
      website: 'https://sentry.io',
      probeType: 'http_bearer',
      probeUrl: 'https://sentry.io/api/0/',
      probeAuth: null,
    },
    {
      name: 'Vercel',
      description: 'Frontend deployment',
      icon: 'Globe',
      category: 'Hosting',
      website: 'https://vercel.com',
      probeType: 'http_bearer',
      probeUrl: 'https://api.vercel.com/v2/user',
      probeAuth: null,
    },
    {
      name: 'PostgreSQL',
      description: 'Relational database',
      icon: 'Database',
      category: 'Database',
      website: 'https://postgresql.org',
      probeType: 'postgres',
      probeUrl: null,
      probeAuth: null,
    },
    {
      name: 'Slack',
      description: 'Team communication',
      icon: 'MessageSquare',
      category: 'Collaboration',
      website: 'https://slack.com',
      probeType: 'http_bearer',
      probeUrl: 'https://slack.com/api/auth.test',
      probeAuth: null,
    },
  ];
  let svcCount = 0;
  for (const s of services) {
    const existing = await prisma.service.findUnique({ where: { name: s.name } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          probeType: s.probeType,
          probeUrl: s.probeUrl,
          probeAuth: s.probeAuth,
        },
      });
      continue;
    }
    await prisma.service.create({
      data: { ...s, isActive: true },
    });
    svcCount++;
  }
  console.log(`  ✓ ${svcCount} new services`);

  // ── Audit trail (recent, no backup actions) ───────────────
  console.log('\n📋 Audit logs');
  const auditActions = [
    { userId: sarah.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
    { userId: sarah.id, action: 'PASSWORD_CREATED', resource: 'password', details: { title: 'AWS Console (Prod)' } },
    { userId: sarah.id, action: 'TEAM_CREATED', resource: 'team', details: { teamName: 'Engineering' } },
    { userId: sarah.id, action: 'SETTINGS_UPDATED', resource: 'organization_password_policy', details: { minLength: 14 } },
    { userId: james.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
    { userId: james.id, action: 'SECURITY_SCAN_TRIGGERED', resource: 'security', details: {} },
    { userId: priya.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
    { userId: priya.id, action: 'PASSWORD_CREATED', resource: 'password', details: { title: 'CI/CD Pipeline Token' } },
    { userId: mike.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
    { userId: mike.id, action: 'PASSWORD_VIEWED', resource: 'password', details: { title: 'Kubernetes Admin' } },
    { userId: ava.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false, firstLogin: true } },
    { userId: john.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
    { userId: sarah.id, action: 'REPORT_GENERATED', resource: 'report', details: { type: 'security' } },
    { userId: founder.id, action: 'USER_LOGIN', resource: 'auth', details: { anomaly: false } },
  ];

  // Avoid flooding on every re-seed: only add if fewer than 20 demo-ish logs for sarah
  const existingAudits = await prisma.auditLog.count({ where: { userId: sarah.id } });
  if (existingAudits < 20 || REFRESH) {
    for (let i = 0; i < auditActions.length; i++) {
      const a = auditActions[i];
      const days = Math.floor((i / auditActions.length) * 10);
      const hours = Math.floor(Math.random() * 10);
      await prisma.auditLog.create({
        data: {
          userId: a.userId,
          action: a.action,
          resource: a.resource,
          details: JSON.stringify(a.details),
          createdAt: new Date(Date.now() - days * 86400000 - hours * 3600000),
        },
      });
    }
    console.log(`  ✓ ${auditActions.length} audit entries`);
  } else {
    console.log('  ⊘ audit logs already present (use --refresh to append)');
  }

  // ── Sessions ──────────────────────────────────────────────
  console.log('\n📊 Sessions');
  const sessionUsers = [sarah, james, priya, mike, john];
  const sessionCount = await prisma.userSession.count({ where: { userId: sarah.id } });
  if (sessionCount < 5 || REFRESH) {
    for (const u of sessionUsers) {
      for (let d = 0; d < 5; d++) {
        const loginAt = new Date(Date.now() - d * 86400000 - Math.random() * 8 * 3600000);
        const duration = Math.floor(Math.random() * 7200) + 600;
        await prisma.userSession.create({
          data: {
            userId: u.id,
            loginAt,
            logoutAt: d === 0 ? null : new Date(loginAt.getTime() + duration * 1000),
            duration: d === 0 ? null : duration,
            browser: ['Chrome', 'Firefox', 'Edge', 'Safari'][d % 4],
            os: ['Windows', 'Mac', 'Linux'][d % 3],
            deviceType: 'desktop',
            isActive: d === 0,
            sessionType: 'web',
            ipAddress: `10.20.${(u.email.charCodeAt(0) % 50) + 1}.${d + 10}`,
          },
        });
      }
    }
    console.log(`  ✓ ${sessionUsers.length * 5} session records`);
  } else {
    console.log('  ⊘ sessions already present');
  }

  console.log('\n' + '═'.repeat(56));
  console.log('  DEMO DATA READY');
  console.log('═'.repeat(56));
  console.log('\n  Password for all accounts: Demo@1234\n');
  console.log('  Primary demo (Acme Corp)');
  console.log('    admin@acmecorp.com      ADMIN    — full org, onboarding done');
  console.log('    manager@acmecorp.com    MANAGER  — Security team');
  console.log('    dev@acmecorp.com        USER     — Engineering');
  console.log('    ops@acmecorp.com        USER     — DevOps');
  console.log('    newhire@acmecorp.com    USER     — onboarding still open');
  console.log('\n  Secondary org');
  console.log('    founder@novatech.io     ADMIN    — NovaTech TRIAL');
  console.log('\n  Individuals');
  console.log('    john@gmail.com / alex@outlook.com');
  console.log('\n  Demo tips');
  console.log('    • Sarah: Dashboard, Vault tabs, Health (weak/reused/expiring)');
  console.log('    • Ava:   Onboarding banner + sidebar item');
  console.log('    • Settings → Org policy + Workflows (as Sarah)');
  console.log('');
}

seedDemo()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
