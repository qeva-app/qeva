# Write Community stubs for Enterprise-only paths. Used by sync-open-core-repos.ps1
param(
  [Parameter(Mandatory = $true)][string]$CommunityRoot
)

$ErrorActionPreference = 'Stop'

function Write-Stub([string]$Rel, [string]$Content) {
  $path = Join-Path $CommunityRoot $Rel
  $dir = Split-Path $path -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  Set-Content -LiteralPath $path -Value ($Content.TrimEnd() + "`n") -Encoding utf8
}

function Stub-Api([string]$Feature) {
  @"
import { NextResponse } from 'next/server';
import { requireEnterpriseFeature } from '@/lib/enterprise-guard';

async function unavailable() {
  return requireEnterpriseFeature('$Feature')!;
}

export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
"@
}

# --- libs ---
Write-Stub 'src\lib\sso.ts' @'
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
'@

Write-Stub 'src\lib\scim.ts' @'
/** Community stub — real SCIM lives in qeva-enterprise overlay. */
import { createHash, randomBytes } from 'crypto';

export function hashScimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateScimToken(): string {
  return `qeva_scim_${randomBytes(24).toString('hex')}`;
}

export async function resolveScimOrg(_authorization: string | null) {
  return null;
}

export function scimUserResource(user: {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    userName: user.username || user.email,
    name: { formatted: user.name || user.email },
    emails: [{ value: user.email, primary: true }],
    active: user.isActive !== false,
  };
}

export async function scimListUsers() {
  return { Resources: [], totalResults: 0, startIndex: 1, itemsPerPage: 0 };
}

export async function scimCreateUser() {
  return { error: 'SCIM requires Qeva Enterprise', status: 404 };
}

export async function scimPatchUser() {
  return { error: 'SCIM requires Qeva Enterprise', status: 404 };
}

export async function scimDeleteUser() {
  return { error: 'SCIM requires Qeva Enterprise', status: 404 };
}
'@

Write-Stub 'src\lib\microsoft-graph.ts' @'
/** Community stub — real Graph client lives in qeva-enterprise overlay. */
export type GraphUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  accountEnabled?: boolean | null;
  givenName?: string | null;
  surname?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  mobilePhone?: string | null;
  businessPhones?: string[] | null;
  officeLocation?: string | null;
  manager?: { mail?: string | null; userPrincipalName?: string | null } | null;
};

export function graphUserEmail(_u: GraphUser): string | null {
  return null;
}

export function graphManagerEmail(_u: GraphUser): string | null {
  return null;
}

export async function getGraphToken(_params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  throw new Error('Directory sync requires Qeva Enterprise');
}

export async function listGraphUsers(_params: {
  token: string;
  select?: string[];
  expandManager?: boolean;
}): Promise<GraphUser[]> {
  return [];
}

export type GraphGroup = { id: string; displayName?: string | null };

export async function listUserMemberGroups(_params: {
  token: string;
  userId: string;
}): Promise<GraphGroup[]> {
  return [];
}
'@

Write-Stub 'src\lib\directory-sync.ts' @'
/** Community stub — real directory sync lives in qeva-enterprise overlay. */
import {
  DEFAULT_FIELD_MAPPING,
  DIRECTORY_MAPPABLE_FIELDS,
  type DirectoryFieldMapping,
} from '@/lib/directory-sync-shared';

export { DEFAULT_FIELD_MAPPING, DIRECTORY_MAPPABLE_FIELDS };
export type { DirectoryFieldMapping };

export function parseFieldMapping(raw: string | null | undefined): DirectoryFieldMapping {
  if (!raw) return { ...DEFAULT_FIELD_MAPPING };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FIELD_MAPPING, ...parsed };
  } catch {
    return { ...DEFAULT_FIELD_MAPPING };
  }
}

export type DirectorySyncPublic = {
  id: string;
  provider: string;
  tenantId: string;
  clientId: string;
  hasClientSecret: boolean;
  fieldMapping: DirectoryFieldMapping;
  syncManagers: boolean;
  createMissingUsers: boolean;
  deactivateMissing: boolean;
  syncGroups: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncSummary: string | null;
};

export function toPublicConfig(row: {
  id: string;
  provider: string;
  tenantId: string;
  clientId: string;
  clientSecretEnc: string;
  fieldMapping: string | null;
  syncManagers: boolean;
  createMissingUsers: boolean;
  deactivateMissing?: boolean;
  syncGroups?: boolean;
  isActive: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncSummary: string | null;
}): DirectorySyncPublic {
  return {
    id: row.id,
    provider: row.provider,
    tenantId: row.tenantId,
    clientId: row.clientId,
    hasClientSecret: !!row.clientSecretEnc,
    fieldMapping: parseFieldMapping(row.fieldMapping),
    syncManagers: row.syncManagers,
    createMissingUsers: row.createMissingUsers,
    deactivateMissing: !!row.deactivateMissing,
    syncGroups: !!row.syncGroups,
    isActive: row.isActive,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncSummary: row.lastSyncSummary,
  };
}

export function encryptClientSecret(secret: string): string {
  return secret;
}

export function decryptClientSecret(enc: string): string {
  return enc;
}

export type SyncSummary = {
  scanned: number;
  matched: number;
  updated: number;
  managersSet: number;
  created: number;
  skipped: number;
  deactivated: number;
  teamsLinked: number;
  errors: string[];
};

export async function runMicrosoftGraphSync(_organizationId: string) {
  return { ok: false as const, error: 'Directory sync requires Qeva Enterprise' };
}

export async function testMicrosoftGraphConnection(_organizationId: string) {
  return { ok: false as const, error: 'Directory sync requires Qeva Enterprise' };
}
'@

Write-Stub 'src\components\SSOConfiguration.tsx' @'
'use client';

/** Community stub — real UI in qeva-enterprise overlay. */
export default function SSOConfiguration() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">SSO is Enterprise</h1>
      <p className="text-muted-foreground">
        Apply the private qeva-enterprise overlay (or use managed hosting) to enable Azure AD,
        Google, and Okta.
      </p>
    </div>
  );
}
'@

Write-Stub 'src\components\DirectorySyncPanel.tsx' @'
'use client';

/** Community stub — real panel in qeva-enterprise overlay. */
export default function DirectorySyncPanel(_props: { onSynced?: () => void }) {
  return null;
}
'@

# API stubs (no EE logic in public tree)
$apiStubs = @{
  'src\app\api\admin\siem\export\route.ts' = 'siem'
  'src\app\api\admin\alerts\route.ts' = 'alerts'
  'src\app\api\admin\scim\route.ts' = 'scim'
  'src\app\api\scim\v2\Users\route.ts' = 'scim'
  'src\app\api\scim\v2\Users\[id]\route.ts' = 'scim'
  'src\app\api\admin\directory-sync\route.ts' = 'directory_sync'
  'src\app\api\admin\directory-sync\sync\route.ts' = 'directory_sync'
  'src\app\api\admin\directory-sync\test\route.ts' = 'directory_sync'
  'src\app\api\admin\sso\configs\route.ts' = 'sso'
  'src\app\api\admin\sso\configs\[id]\route.ts' = 'sso'
  'src\app\api\admin\sso\configs\[id]\activate\route.ts' = 'sso'
  'src\app\api\admin\sso\configs\[id]\test\route.ts' = 'sso'
  'src\app\api\sso\configs\route.ts' = 'sso'
  'src\app\api\sso\configs\[id]\route.ts' = 'sso'
}

foreach ($kv in $apiStubs.GetEnumerator()) {
  Write-Stub $kv.Key (Stub-Api $kv.Value)
}

Write-Stub 'src\app\api\sso\providers\route.ts' @'
import { NextResponse } from 'next/server';
import { hasEnterpriseFeature } from '@/lib/edition';

/** Community: no SSO providers. EE overlay replaces this file. */
export async function GET() {
  if (!hasEnterpriseFeature('sso')) return NextResponse.json([]);
  return NextResponse.json([]);
}
'@

Write-Host "Community stubs written under $CommunityRoot"
