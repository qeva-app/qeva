export type DocsNavChild = {
  title: string;
  href: string;
  keywords?: string[];
  /** Enterprise-only capability — still listed so Community readers know what EE unlocks. */
  edition?: 'enterprise';
};
export type DocsNavItem = {
  title: string;
  href?: string;
  icon?: 'book' | 'bot' | 'users' | 'settings' | 'shield' | 'code' | 'help' | 'sparkles';
  children?: DocsNavChild[];
  keywords?: string[];
};

export const docsNav: DocsNavItem[] = [
  { title: 'Overview', href: '/docs', icon: 'book', keywords: ['home', 'start'] },
  {
    title: 'Self-hosting',
    href: '/docs/self-hosting',
    icon: 'settings',
    keywords: ['docker', 'compose', 'deploy', 'install', 'postgres'],
  },
  {
    title: 'Open-core editions',
    href: '/docs/open-core',
    icon: 'sparkles',
    keywords: ['community', 'enterprise', 'edition', 'oss', 'ce', 'ee'],
  },
  { title: 'Features', href: '/docs/features', icon: 'sparkles', keywords: ['capabilities'] },
  { title: 'Release Notes', href: '/docs/release-notes', icon: 'book', keywords: ['changelog'] },
  {
    title: 'AI Agents',
    icon: 'bot',
    children: [
      { title: 'Overview', href: '/docs/developer/agents', keywords: ['cli', 'mcp', 'cursor'] },
      { title: 'Access Tokens', href: '/docs/developer/access-tokens', keywords: ['bearer', 'api key'] },
      { title: 'API Reference', href: '/docs/developer/api', keywords: ['endpoints', 'rest'] },
    ],
  },
  {
    title: 'User Guide',
    icon: 'users',
    children: [
      { title: 'Passwords', href: '/docs/user-guide/passwords', keywords: ['vault', 'import', 'generator'] },
      {
        title: 'Teams',
        href: '/docs/user-guide/teams',
        keywords: ['share', 'collaboration', 'org'],
        edition: 'enterprise',
      },
      { title: 'Encryption', href: '/docs/user-guide/encryption', keywords: ['master key', 'USER_MASTER', 'unlock'] },
    ],
  },
  {
    title: 'Admin Guide',
    icon: 'settings',
    children: [
      {
        title: 'Users',
        href: '/docs/admin-guide/users',
        keywords: ['roles', 'lifecycle'],
        edition: 'enterprise',
      },
      { title: 'Settings', href: '/docs/admin-guide/settings', keywords: ['smtp', 'session', 'tokens'] },
      { title: 'Audit', href: '/docs/admin-guide/audit', keywords: ['logs', 'compliance'] },
    ],
  },
  {
    title: 'Security model',
    icon: 'shield',
    children: [
      { title: 'Overview', href: '/docs/security', keywords: ['headers', 'hibp', 'scan'] },
      { title: 'Encryption deep dive', href: '/docs/encryption', keywords: ['aes', 'argon2', 'dek', 'rsa'] },
      {
        title: 'RBAC',
        href: '/docs/rbac',
        keywords: ['roles', 'permissions'],
        edition: 'enterprise',
      },
    ],
  },
  {
    title: 'Developer',
    icon: 'code',
    children: [
      { title: 'Components', href: '/docs/developer/components', keywords: ['react', 'ui'] },
    ],
  },
  { title: 'Support', href: '/docs/support', icon: 'help', keywords: ['troubleshoot', 'help', 'faq'] },
  { title: 'Feedback', href: '/docs/feedback', icon: 'help' },
];

export type FlatDocPage = {
  title: string;
  href: string;
  group: string;
  keywords: string[];
  edition?: 'enterprise';
};

export function flattenDocsNav(items: DocsNavItem[] = docsNav): FlatDocPage[] {
  const out: FlatDocPage[] = [];
  for (const item of items) {
    if (item.href) {
      out.push({
        title: item.title,
        href: item.href,
        group: item.title,
        keywords: item.keywords ?? [],
      });
    }
    for (const child of item.children ?? []) {
      out.push({
        title: child.title,
        href: child.href,
        group: item.title,
        keywords: child.keywords ?? [],
        edition: child.edition,
      });
    }
  }
  return out;
}

export function docsNeighbors(pathname: string) {
  const pages = flattenDocsNav();
  const i = pages.findIndex((p) => p.href === pathname);
  return {
    prev: i > 0 ? pages[i - 1] : null,
    next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : null,
  };
}
