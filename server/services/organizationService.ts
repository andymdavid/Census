import db from '../db';
import { createWorkspace, listWorkspacesForOrgAndUser, updateWorkspacesOrganization } from './workspaceService';

export interface OrganizationRecord {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

const insertOrganization = db.prepare(
  'INSERT INTO organizations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
);
const insertMember = db.prepare(
  'INSERT INTO organization_members (organization_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);
const selectOrganizationsForUser = db.prepare(
  `
  SELECT o.id, o.name, o.created_at, o.updated_at
  FROM organizations o
  INNER JOIN organization_members m ON m.organization_id = o.id
  WHERE m.pubkey = ?
  ORDER BY o.created_at ASC
  `
);
const selectOrganizationById = db.prepare(
  'SELECT id, name, created_at, updated_at FROM organizations WHERE id = ?'
);
const selectMembership = db.prepare(
  'SELECT organization_id, pubkey, role FROM organization_members WHERE organization_id = ? AND pubkey = ?'
);

export const listOrganizationsForUser = (pubkey: string) => {
  return selectOrganizationsForUser.all(pubkey) as OrganizationRecord[];
};

export const getOrganizationById = (id: string) => {
  const row = selectOrganizationById.get(id) as OrganizationRecord | undefined;
  return row ?? null;
};

export const isOrganizationMember = (organizationId: string, pubkey: string) => {
  const row = selectMembership.get(organizationId, pubkey) as
    | { organization_id: string; pubkey: string; role: string }
    | undefined;
  return Boolean(row);
};

export const createOrganization = (name: string, pubkey: string) => {
  const now = Date.now();
  const id = crypto.randomUUID();
  insertOrganization.run(id, name, now, now);
  insertMember.run(id, pubkey, 'owner', now);
  return { id, created_at: now, updated_at: now };
};

export const ensureDefaultOrganization = (pubkey: string) => {
  const existing = listOrganizationsForUser(pubkey);
  if (existing.length > 0) {
    return existing[0];
  }
  const created = createOrganization('Personal', pubkey);
  const defaultWorkspace = createWorkspace('My workspace', pubkey, created.id);
  updateWorkspacesOrganization(created.id);
  if (defaultWorkspace?.id) {
    // no-op: createWorkspace already assigns the org
  }
  return getOrganizationById(created.id);
};

export const listWorkspacesForOrganization = (organizationId: string, pubkey: string) => {
  return listWorkspacesForOrgAndUser(organizationId, pubkey);
};
