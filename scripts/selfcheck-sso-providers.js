/**
 * Assert NextAuth provider id mapping for SSO (no DB).
 * Run: node scripts/selfcheck-sso-providers.js
 */
function nextAuthProviderId(provider) {
  switch (provider) {
    case 'AzureAD':
      return 'azuread';
    case 'Google':
      return 'google';
    case 'Okta':
      return 'okta';
    default:
      return null;
  }
}

function ssoTypeFromAuthProviderId(authId) {
  switch (authId) {
    case 'azuread':
      return 'AzureAD';
    case 'google':
      return 'Google';
    case 'okta':
      return 'Okta';
    default:
      return null;
  }
}

function oktaIssuerFromConfig(c) {
  if (c.issuer?.trim()) return c.issuer.trim().replace(/\/$/, '');
  const domain = c.domain?.trim();
  if (!domain) return null;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain.replace(/\/$/, '');
  }
  return `https://${domain}`;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  }
}

for (const [provider, expected] of [
  ['AzureAD', 'azuread'],
  ['Google', 'google'],
  ['Okta', 'okta'],
  ['SAML', null],
  ['LDAP', null],
]) {
  assert(nextAuthProviderId(provider) === expected, `${provider} → ${expected}`);
}

for (const [id, type] of [
  ['azuread', 'AzureAD'],
  ['google', 'Google'],
  ['okta', 'Okta'],
  ['azure-ad', null],
]) {
  assert(ssoTypeFromAuthProviderId(id) === type, `auth ${id} → ${type}`);
}

assert(oktaIssuerFromConfig({ domain: 'dev-1.okta.com' }) === 'https://dev-1.okta.com', 'okta domain');
assert(
  oktaIssuerFromConfig({ issuer: 'https://dev-1.okta.com/oauth2/default' }) ===
    'https://dev-1.okta.com/oauth2/default',
  'okta issuer'
);

if (failed) {
  console.error(`selfcheck-sso-providers: ${failed} failure(s)`);
  process.exit(1);
}
console.log('selfcheck-sso-providers: ok');
