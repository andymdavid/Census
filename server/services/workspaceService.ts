import db from '../db';
import { nip19 } from 'nostr-tools';

export interface WorkspaceRecord {
  id: string;
  name: string;
  organization_id: string;
  created_at: number;
  updated_at: number;
}

const insertWorkspace = db.prepare(
  'INSERT INTO workspaces (id, name, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
);
const insertMember = db.prepare(
  'INSERT INTO workspace_members (workspace_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);
const selectWorkspaceById = db.prepare(
  'SELECT id, name, organization_id, created_at, updated_at FROM workspaces WHERE id = ?'
);
const selectWorkspacesForUser = db.prepare(
  `
  SELECT w.id, w.name, w.organization_id, w.created_at, w.updated_at
  FROM workspaces w
  INNER JOIN workspace_members m ON m.workspace_id = w.id
  WHERE m.pubkey = ?
  ORDER BY w.created_at ASC
  `
);
const selectWorkspacesForOrgAndUser = db.prepare(
  `
  SELECT w.id, w.name, w.organization_id, w.created_at, w.updated_at
  FROM workspaces w
  INNER JOIN workspace_members m ON m.workspace_id = w.id
  WHERE m.pubkey = ? AND w.organization_id = ?
  ORDER BY w.created_at ASC
  `
);
const selectMembership = db.prepare(
  'SELECT workspace_id, pubkey, role FROM workspace_members WHERE workspace_id = ? AND pubkey = ?'
);
const selectMembers = db.prepare(
  'SELECT workspace_id, pubkey, role, created_at FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC'
);
const selectMemberCount = db.prepare(
  'SELECT COUNT(*) as member_count FROM workspace_members WHERE workspace_id = ?'
);
const deleteMember = db.prepare(
  'DELETE FROM workspace_members WHERE workspace_id = ? AND pubkey = ?'
);
const deleteMembersByWorkspace = db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?');
const deleteWorkspaceById = db.prepare('DELETE FROM workspaces WHERE id = ?');
const updateWorkspace = db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?');
const updateFormsWorkspace = db.prepare(
  "UPDATE forms SET workspace_id = ? WHERE workspace_id = '' OR workspace_id IS NULL"
);
const updateWorkspacesOrg = db.prepare(
  "UPDATE workspaces SET organization_id = ? WHERE organization_id = '' OR organization_id IS NULL"
);
const updateFormsWorkspaceById = db.prepare(
  'UPDATE forms SET workspace_id = ? WHERE workspace_id = ?'
);
const insertMemberIfMissing = db.prepare(
  'INSERT OR IGNORE INTO workspace_members (workspace_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);

export const listWorkspacesForUser = (pubkey: string) => {
  return selectWorkspacesForUser.all(pubkey) as WorkspaceRecord[];
};

export const listWorkspacesForOrgAndUser = (organizationId: string, pubkey: string) => {
  return selectWorkspacesForOrgAndUser.all(pubkey, organizationId) as WorkspaceRecord[];
};

export const getWorkspaceById = (id: string) => {
  const row = selectWorkspaceById.get(id) as WorkspaceRecord | undefined;
  return row ?? null;
};

export const createWorkspace = (name: string, pubkey: string, organizationId: string) => {
  const now = Date.now();
  const id = crypto.randomUUID();
  insertWorkspace.run(id, name, organizationId, now, now);
  insertMember.run(id, pubkey, 'owner', now);
  return { id, created_at: now, updated_at: now };
};

export const ensureDefaultWorkspace = (pubkey: string, organizationId: string) => {
  const existing = listWorkspacesForOrgAndUser(organizationId, pubkey);
  if (existing.length > 0) {
    return existing[0];
  }
  const created = createWorkspace('My workspace', pubkey, organizationId);
  updateFormsWorkspace.run(created.id);
  return getWorkspaceById(created.id);
};

export const isWorkspaceMember = (workspaceId: string, pubkey: string) => {
  const row = selectMembership.get(workspaceId, pubkey) as
    | { workspace_id: string; pubkey: string; role: string }
    | undefined;
  return Boolean(row);
};

export const getWorkspaceMemberRole = (workspaceId: string, pubkey: string) => {
  const row = selectMembership.get(workspaceId, pubkey) as
    | { workspace_id: string; pubkey: string; role: string }
    | undefined;
  return row?.role ?? null;
};

export const renameWorkspace = (workspaceId: string, name: string) => {
  const now = Date.now();
  updateWorkspace.run(name, now, workspaceId);
  return { updated_at: now };
};

export const listWorkspaceMembers = (workspaceId: string) => {
  return selectMembers.all(workspaceId) as Array<{
    workspace_id: string;
    pubkey: string;
    role: string;
    created_at: number;
  }>;
};

export const normalizePubkey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('npub')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        return decoded.data;
      }
    } catch {
      return null;
    }
  }
  return /^[0-9a-f]{64}$/i.test(trimmed) ? trimmed : null;
};

export const addWorkspaceMember = (workspaceId: string, pubkey: string, role = 'member') => {
  const now = Date.now();
  insertMemberIfMissing.run(workspaceId, pubkey, role, now);
  return listWorkspaceMembers(workspaceId);
};

export const removeWorkspaceMember = (workspaceId: string, pubkey: string) => {
  deleteMember.run(workspaceId, pubkey);
  const countRow = selectMemberCount.get(workspaceId) as { member_count: number } | undefined;
  return countRow?.member_count ?? 0;
};

export const deleteWorkspace = (workspaceId: string) => {
  updateFormsWorkspaceById.run('', workspaceId);
  deleteMembersByWorkspace.run(workspaceId);
  deleteWorkspaceById.run(workspaceId);
};

export const updateWorkspacesOrganization = (organizationId: string) => {
  updateWorkspacesOrg.run(organizationId);
};
