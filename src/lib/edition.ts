/**
 * Open-core edition: Community (public) vs Enterprise (private package / paid).
 * See docs/open-core.md. License flags alone do not hide source — keep paid code out of the public tree.
 */

export type QevaEdition = 'community' | 'enterprise';

/** Features that require Enterprise edition (or managed Enterprise image). */
export const ENTERPRISE_FEATURES = [
  'sso',
  'scim',
  'directory_sync',
  'siem',
  'alerts',
] as const;

export type EnterpriseFeature = (typeof ENTERPRISE_FEATURES)[number];

export type EditionInfo = {
  edition: QevaEdition;
  features: EnterpriseFeature[];
  packageLoaded: boolean;
};

type EnterprisePackage = {
  features?: readonly string[];
};

let cached: EditionInfo | null = null;

function tryLoadEnterprisePackage(): EnterprisePackage | null {
  if (typeof window !== 'undefined') return null;
  try {
    // Optional private dependency — absent in Community / public GitHub builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@qeva/enterprise') as EnterprisePackage;
  } catch {
    return null;
  }
}

function parseEnvEdition(): QevaEdition | null {
  const raw = (process.env.QEVA_EDITION || '').trim().toLowerCase();
  if (raw === 'community' || raw === 'ce') return 'community';
  if (raw === 'enterprise' || raw === 'ee') return 'enterprise';
  return null;
}

export function getEditionInfo(): EditionInfo {
  if (cached) return cached;

  const pkg = tryLoadEnterprisePackage();
  const fromEnv = parseEnvEdition();
    // extraction use: fromEnv ?? (pkg ? 'enterprise' : 'community')
  const edition: QevaEdition = fromEnv ?? (pkg ? 'enterprise' : 'community');

  const features: EnterpriseFeature[] =
    edition === 'enterprise' ? [...ENTERPRISE_FEATURES] : [];

  cached = {
    edition,
    features,
    packageLoaded: !!pkg,
  };
  return cached;
}

/** Test helper — clears memoization after env changes in selfchecks. */
export function resetEditionCache(): void {
  cached = null;
}

export function getEdition(): QevaEdition {
  return getEditionInfo().edition;
}

export function isEnterpriseEdition(): boolean {
  return getEdition() === 'enterprise';
}

/** Community / public Docker image is individuals-only (no company signup or org features). */
export function allowsCompanyAccounts(): boolean {
  return isEnterpriseEdition();
}

export function hasEnterpriseFeature(feature: EnterpriseFeature): boolean {
  return getEditionInfo().features.includes(feature);
}
