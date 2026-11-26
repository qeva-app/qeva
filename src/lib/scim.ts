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

