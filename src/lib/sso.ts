/**
 * Community stub — real SSO lives in qeva-enterprise overlay.
 */
export type SSOProviderType = 'SAML' | 'LDAP' | 'OAuth' | 'AzureAD' | 'Google' | 'Okta';

export interface SSOConfig {
  id: string;
  name: string;
  provider: SSOProviderType;
  isActive: boolean;
  isRequired: boolean;
  config: Record<string, unknown>;
  metadata?: string;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  signatureAlgorithm?: string;
  nameIdFormat?: string;
}

export interface LDAPConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  searchFilter: string;
  usernameAttribute: string;
  emailAttribute: string;
  tlsEnabled: boolean;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  callbackUrl: string;
}

export interface AzureADConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleSSOConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OktaSSOConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer?: string;
}

export function ssoTypeFromAuthProviderId(authId: string): SSOProviderType | null {
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

export function oktaIssuerFromConfig(c: Partial<OktaSSOConfig>): string | null {
  if (c.issuer?.trim()) return c.issuer.trim().replace(/\/$/, '');
  const domain = c.domain?.trim();
  if (!domain) return null;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain.replace(/\/$/, '');
  }
  return `https://${domain}`;
}

export function getProviderDisplayName(provider: SSOProviderType): string {
  const names: Record<SSOProviderType, string> = {
    SAML: 'SAML 2.0',
    LDAP: 'LDAP / Active Directory',
    OAuth: 'OAuth 2.0',
    AzureAD: 'Microsoft Azure AD',
    Google: 'Google Workspace',
    Okta: 'Okta',
  };
  return names[provider] || provider;
}

export function nextAuthProviderId(provider: SSOProviderType): string | null {
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

export function parseSSOConfigJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getProviderFields(provider: SSOProviderType): string[] {
  const fields: Record<SSOProviderType, string[]> = {
    SAML: ['entityId', 'ssoUrl', 'certificate', 'signatureAlgorithm', 'nameIdFormat'],
    LDAP: ['url', 'baseDN', 'bindDN', 'bindPassword', 'searchFilter', 'usernameAttribute', 'emailAttribute', 'tlsEnabled'],
    OAuth: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'userInfoUrl', 'scopes', 'callbackUrl'],
    AzureAD: ['tenantId', 'clientId', 'clientSecret', 'redirectUri'],
    Google: ['clientId', 'clientSecret', 'redirectUri'],
    Okta: ['domain', 'clientId', 'clientSecret', 'redirectUri', 'issuer'],
  };
  return fields[provider] || [];
}

export async function getActiveSSOConfigs(): Promise<SSOConfig[]> {
  return [];
}

export async function handleSSOCallback(
  _provider: SSOProviderType,
  _ssoUser: { email: string; name?: string; ssoId: string; avatar?: string }
): Promise<{ id: string; email: string; name: string; role: string } | null> {
  return null;
}

export async function testSSOConnection(
  _provider: SSOProviderType,
  _config: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  return { success: false, message: 'SSO requires Qeva Enterprise' };
}

