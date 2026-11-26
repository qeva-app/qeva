import NextAuth, { NextAuthOptions, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import GoogleProvider from 'next-auth/providers/google';
import OktaProvider from 'next-auth/providers/okta';
import { JWT } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import prisma from './db';
import { decryptCredentials } from './server-crypto';
import {
  openMfaSecret,
  verifyTotp,
  looksLikeBackupCode,
  consumeBackupCode,
} from './mfa';
import logger from './logger';
import { trackLogin } from './session-tracker';
import { logAudit, AuditActions } from './audit';
import { hasValidMfaCookie } from './mfa-session';
import {
  getActiveSSOConfigs,
  handleSSOCallback,
  nextAuthProviderId,
  oktaIssuerFromConfig,
  ssoTypeFromAuthProviderId,
  type AzureADConfig,
  type GoogleSSOConfig,
  type OktaSSOConfig,
} from './sso';
import { allowsCompanyAccounts } from './edition';

// Session cache
const sessionCache = new Map<string, { user: any; timestamp: number }>();
const SESSION_CACHE_TTL = 30 * 1000; // 30s — keep short so deactivation propagates across instances
const DB_REVALIDATION_INTERVAL = 30 * 1000; // 30s — always re-check isActive soon after revoke
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// In-memory revocation list — when a user is deactivated, add their ID here
// JWT callback checks this on every request for instant revocation
const revokedUserIds = new Set<string>();

export function revokeUserSessions(userId: string) {
  revokedUserIds.add(userId);
  sessionCache.delete(userId);
  // Auto-clean after 1 hour (JWT will have expired by then)
  setTimeout(() => revokedUserIds.delete(userId), 60 * 60 * 1000);
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string;
      role?: string;
      isActive?: boolean;
      isVerified?: boolean;
      accountType?: string;
      organizationId?: string | null;
      twoFactorEnabled?: boolean;
      mfaVerified?: boolean;
      mustChangePassword?: boolean;
      mfaPromptPending?: boolean;
    };
  }
  interface User {
    username?: string;
    role?: string;
    isActive?: boolean;
    isVerified?: boolean;
    accountType?: string;
    organizationId?: string | null;
    twoFactorEnabled?: boolean;
    mfaVerified?: boolean;
    mustChangePassword?: boolean;
    mfaPromptPending?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
    role?: string;
    isActive?: boolean;
    isVerified?: boolean;
    accountType?: string;
    organizationId?: string | null;
    lastActivity?: number;
    lastUserCheck?: number;
    twoFactorEnabled?: boolean;
    mfaVerified?: boolean;
    mustChangePassword?: boolean;
    mfaPromptPending?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        // Sealed by encryptCredentials() in client-crypto.ts. Plaintext credentials are not accepted.
        payload: { label: 'Encrypted credentials', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.payload) return null;

        let email: string;
        let password: string;
        let totp: string | undefined;
        try {
          ({ email, password, totp } = decryptCredentials(credentials.payload));
        } catch {
          // Usually a stale public key in the browser. The sign-in page refetches the key and retries once.
          throw new Error('CREDENTIALS_DECRYPT_FAILED');
        }

        const emailDomain = email?.includes('@') ? email.split('@')[1]?.toLowerCase() : undefined;

        const fail = async (reason: string, userId?: string) => {
          await logAudit({
            userId: userId ?? null,
            action: AuditActions.USER_LOGIN_FAILED,
            resource: 'auth',
            details: { reason, emailDomain },
          });
          return null;
        };

        try {
          if (!email || !password) return await fail('missing_credentials');

          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
              password: true,
              isActive: true,
              isVerified: true,
              image: true,
              accountType: true,
              organizationId: true,
              twoFactorEnabled: true,
              twoFactorSecret: true,
              twoFactorBackupCodes: true,
              mustChangePassword: true,
              mfaPromptPending: true,
            },
          });

          if (!user || !user.password) return await fail('invalid_credentials');

          // Check the password before reporting account status, so the status of an
          // account is only ever revealed to someone who knows its password.
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) return await fail('invalid_credentials', user.id);

          if (!user.isVerified) {
            throw new Error('EMAIL_NOT_VERIFIED');
          }

          if (!user.isActive) {
            throw new Error('ACCOUNT_DEACTIVATED');
          }

          if (user.twoFactorEnabled && user.twoFactorSecret) {
            if (!totp) throw new Error('MFA_REQUIRED');
            let mfaOk = false;
            if (looksLikeBackupCode(totp)) {
              const remaining = await consumeBackupCode(user.twoFactorBackupCodes, totp);
              if (!remaining) throw new Error('MFA_BACKUP_USED');
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: JSON.stringify(remaining) },
              });
              mfaOk = true;
            }
            if (!mfaOk) {
              try {
                const secret = openMfaSecret(user.twoFactorSecret);
                mfaOk = verifyTotp(secret, totp);
              } catch {
                mfaOk = false;
              }
            }
            if (!mfaOk) {
              await logAudit({
                userId: user.id,
                action: AuditActions.USER_LOGIN_FAILED,
                resource: 'auth',
                details: { reason: 'mfa_invalid', emailDomain },
              });
              throw new Error('MFA_INVALID');
            }
          }

          // Get primary role
          const roleAssignment = await prisma.userRoleAssignment.findFirst({
            where: { userId: user.id, isActive: true },
            orderBy: { isPrimary: 'desc' },
            include: { role: true },
          });

          const role = roleAssignment?.role?.name || 'USER';

          return {
            id: user.id,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            image: user.image,
            username: user.username,
            role,
            isActive: user.isActive,
            isVerified: user.isVerified,
            accountType: user.accountType || 'INDIVIDUAL',
            organizationId: user.organizationId || null,
            twoFactorEnabled: !!user.twoFactorEnabled,
            // Password path already satisfied MFA inside authorize
            mfaVerified: true,
            mustChangePassword: !!user.mustChangePassword,
            mfaPromptPending: !!user.mfaPromptPending && !user.twoFactorEnabled,
          };
        } catch (error: any) {
          if (
            error.message === 'EMAIL_NOT_VERIFIED' ||
            error.message === 'ACCOUNT_DEACTIVATED' ||
            error.message === 'MFA_REQUIRED' ||
            error.message === 'MFA_INVALID' ||
            error.message === 'MFA_BACKUP_USED'
          ) {
            throw error;
          }
          logger.error('Auth error', { error: error.message });
          return await fail('auth_error');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
    updateAge: 5 * 60, // 5 minutes
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === 'credentials') return true;

      const providerId = account.provider;
      const ssoType = ssoTypeFromAuthProviderId(providerId);
      if (!ssoType) {
        logger.warn('SSO sign-in rejected — provider not wired', { providerId });
        return false;
      }

      const emailRaw =
        user.email ||
        (profile as { email?: string; preferred_username?: string } | undefined)?.email ||
        (profile as { preferred_username?: string } | undefined)?.preferred_username;
      if (!emailRaw) return false;

      const mapped = await handleSSOCallback(ssoType, {
        email: emailRaw.toLowerCase(),
        name: user.name || undefined,
        ssoId: account.providerAccountId,
        avatar: user.image || undefined,
      });
      if (!mapped) return false;

      const dbUser = await prisma.user.findUnique({
        where: { id: mapped.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          isActive: true,
          isVerified: true,
          accountType: true,
          organizationId: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
          mfaPromptPending: true,
          image: true,
        },
      });
      if (!dbUser?.isActive) return false;

      user.id = dbUser.id;
      user.email = dbUser.email;
      user.name = dbUser.name;
      user.image = dbUser.image;
      user.username = dbUser.username || undefined;
      user.role = mapped.role;
      user.isActive = dbUser.isActive;
      user.isVerified = dbUser.isVerified;
      user.accountType = dbUser.accountType || 'INDIVIDUAL';
      user.organizationId = dbUser.organizationId;
      user.twoFactorEnabled = !!dbUser.twoFactorEnabled;
      user.mfaVerified = !dbUser.twoFactorEnabled;
      user.mustChangePassword = !!dbUser.mustChangePassword;
      user.mfaPromptPending = !!dbUser.mfaPromptPending && !dbUser.twoFactorEnabled;
      return true;
    },
    async jwt({ token, user, account, trigger, session }): Promise<JWT> {
      if (trigger === 'update' && session) {
        if (typeof session.mustChangePassword === 'boolean') {
          token.mustChangePassword = session.mustChangePassword;
        }
        if (typeof session.mfaPromptPending === 'boolean') {
          token.mfaPromptPending = session.mfaPromptPending;
        }
        if (typeof session.twoFactorEnabled === 'boolean') {
          token.twoFactorEnabled = session.twoFactorEnabled;
        }
        if ('image' in session) {
          token.picture = session.image ?? undefined;
        }
      }

      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.isActive = user.isActive;
        token.isVerified = user.isVerified;
        token.picture = user.image ?? undefined;
        token.mustChangePassword = !!user.mustChangePassword;
        token.mfaPromptPending = !!user.mfaPromptPending;
        // Community Docker is individuals-only — never expose org session state.
        if (allowsCompanyAccounts()) {
          token.accountType = user.accountType || 'INDIVIDUAL';
          token.organizationId = user.organizationId || null;
        } else {
          token.accountType = 'INDIVIDUAL';
          token.organizationId = null;
        }
        token.lastActivity = Date.now();
        token.lastUserCheck = Date.now();

        if (account && account.provider !== 'credentials') {
          // SSO / OAuth — require step-up MFA when enabled on the account
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              twoFactorEnabled: true,
              mustChangePassword: true,
              mfaPromptPending: true,
            },
          });
          token.twoFactorEnabled = !!dbUser?.twoFactorEnabled;
          token.mfaVerified = !dbUser?.twoFactorEnabled;
          token.mustChangePassword = !!dbUser?.mustChangePassword;
          token.mfaPromptPending = !!dbUser?.mfaPromptPending && !dbUser?.twoFactorEnabled;
        } else {
          token.twoFactorEnabled = !!user.twoFactorEnabled;
          token.mfaVerified = user.mfaVerified !== false;
        }
      }

      // Cookie set by /api/auth/mfa/verify (SSO step-up)
      if (token.id && token.twoFactorEnabled && !token.mfaVerified) {
        if (hasValidMfaCookie(token.id)) {
          token.mfaVerified = true;
        }
      }

      // Check inactivity timeout
      if (token.lastActivity && Date.now() - token.lastActivity > INACTIVITY_TIMEOUT) {
        return {} as JWT; // Force re-auth
      }

      // Instant revocation check — checked on every JWT validation
      if (token.id && revokedUserIds.has(token.id)) {
        return {} as JWT; // Force re-auth immediately
      }

      // Periodic DB re-validation — never trust a cached "active" longer than SESSION_CACHE_TTL
      if (token.id && token.lastUserCheck && Date.now() - token.lastUserCheck > DB_REVALIDATION_INTERVAL) {
        try {
          const cachedEntry = sessionCache.get(token.id);
          let dbUser = cachedEntry?.user;
          const cacheFresh =
            cachedEntry && Date.now() - cachedEntry.timestamp < SESSION_CACHE_TTL;

          if (!cacheFresh) {
            dbUser = await prisma.user.findUnique({
              where: { id: token.id },
              select: {
                isActive: true,
                isVerified: true,
                mustChangePassword: true,
                mfaPromptPending: true,
                twoFactorEnabled: true,
              },
            });
            if (dbUser) {
              sessionCache.set(token.id, { user: dbUser, timestamp: Date.now() });
            }
          }

          if (dbUser) {
            token.isActive = dbUser.isActive;
            token.isVerified = dbUser.isVerified;
            if ('mustChangePassword' in dbUser) {
              token.mustChangePassword = !!dbUser.mustChangePassword;
            }
            if ('mfaPromptPending' in dbUser) {
              token.mfaPromptPending =
                !!dbUser.mfaPromptPending && !dbUser.twoFactorEnabled;
            }
            if ('twoFactorEnabled' in dbUser) {
              token.twoFactorEnabled = !!dbUser.twoFactorEnabled;
            }
            if (!dbUser.isActive) {
              revokedUserIds.add(token.id);
              sessionCache.delete(token.id);
              return {} as JWT;
            }
          }
          token.lastUserCheck = Date.now();
        } catch (error) {
          logger.error('JWT revalidation error', { error });
        }
      }

      if (token.isActive === false) {
        return {} as JWT;
      }

      // Community Docker: strip org state on every refresh (covers older sessions).
      if (!allowsCompanyAccounts()) {
        token.accountType = 'INDIVIDUAL';
        token.organizationId = null;
      }

      // Update activity
      token.lastActivity = Date.now();

      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (token.id) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.isActive = token.isActive;
        session.user.isVerified = token.isVerified;
        session.user.accountType = token.accountType;
        session.user.organizationId = token.organizationId;
        session.user.twoFactorEnabled = token.twoFactorEnabled;
        session.user.mfaVerified = token.mfaVerified !== false;
        session.user.mustChangePassword = !!token.mustChangePassword;
        session.user.mfaPromptPending = !!token.mfaPromptPending;
        session.user.image = (token.picture as string | undefined) ?? null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        try {
          const { anomaly } = await trackLogin(user.id);

          await logAudit({
            userId: user.id,
            action: AuditActions.USER_LOGIN,
            resource: 'auth',
            details: {
              anomaly: anomaly.isAnomaly,
              anomalyReasons: anomaly.reasons,
            },
          });

          if (anomaly.isAnomaly) {
            logger.warn('Anomalous login detected', {
              userId: user.id,
              reasons: anomaly.reasons,
            });
          }
        } catch (error) {
          logger.error('Failed to track login session', { error });
        }
      }
    },
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      const userId = token?.sub;
      if (!userId) return;
      await logAudit({
        userId,
        action: AuditActions.USER_LOGOUT,
        resource: 'auth',
        details: {},
      });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/** Full NextAuth options including DB-backed OIDC providers (route handler only). */
export async function buildAuthOptions(): Promise<NextAuthOptions> {
  const providers = [...authOptions.providers];
  const added = new Set<string>();

  const { hasEnterpriseFeature } = await import('./edition');
  if (!hasEnterpriseFeature('sso')) {
    return { ...authOptions, providers };
  }

  try {
    const configs = await getActiveSSOConfigs();
    for (const cfg of configs) {
      const authId = nextAuthProviderId(cfg.provider);
      if (!authId || added.has(authId)) continue;

      if (cfg.provider === 'AzureAD') {
        const c = cfg.config as Partial<AzureADConfig>;
        if (!c.clientId || !c.clientSecret || !c.tenantId) {
          logger.warn('Skipping Azure AD SSO — missing clientId/clientSecret/tenantId', {
            configId: cfg.id,
          });
          continue;
        }
        providers.push(
          AzureADProvider({
            id: 'azuread',
            name: cfg.name || 'Microsoft Azure AD',
            clientId: c.clientId,
            clientSecret: c.clientSecret,
            tenantId: c.tenantId,
            authorization: { params: { scope: 'openid profile email User.Read' } },
          })
        );
        added.add(authId);
        continue;
      }

      if (cfg.provider === 'Google') {
        const c = cfg.config as Partial<GoogleSSOConfig>;
        if (!c.clientId || !c.clientSecret) {
          logger.warn('Skipping Google SSO — missing clientId/clientSecret', { configId: cfg.id });
          continue;
        }
        providers.push(
          GoogleProvider({
            id: 'google',
            name: cfg.name || 'Google Workspace',
            clientId: c.clientId,
            clientSecret: c.clientSecret,
            authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
          })
        );
        added.add(authId);
        continue;
      }

      if (cfg.provider === 'Okta') {
        const c = cfg.config as Partial<OktaSSOConfig>;
        const issuer = oktaIssuerFromConfig(c);
        if (!c.clientId || !c.clientSecret || !issuer) {
          logger.warn('Skipping Okta SSO — missing clientId/clientSecret/domain', {
            configId: cfg.id,
          });
          continue;
        }
        providers.push(
          OktaProvider({
            id: 'okta',
            name: cfg.name || 'Okta',
            clientId: c.clientId,
            clientSecret: c.clientSecret,
            issuer,
          })
        );
        added.add(authId);
      }
    }
  } catch (error) {
    logger.error('Failed to load SSO providers for NextAuth', { error });
  }

  return { ...authOptions, providers };
}

export default NextAuth(authOptions);
