/** Community stub - real Graph client lives in qeva-enterprise overlay. */
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

