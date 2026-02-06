import db from '../db';

export interface WorkspaceRecord {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

const insertWorkspace = db.prepare(
  'INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
);
const insertMember = db.prepare(
  'INSERT INTO workspace_members (workspace_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);
const selectWorkspaceById = db.prepare(
  'SELECT id, name, created_at, updated_at FROM workspaces WHERE id = ?'
);
const selectWorkspacesForUser = db.prepare(
  `
  SELECT w.id, w.name, w.created_at, w.updated_at
  FROM workspaces w
  INNER JOIN workspace_members m ON m.workspace_id = w.id
  WHERE m.pubkey = ?
  ORDER BY w.created_at ASC
  `
);
const selectMembership = db.prepare(
  'SELECT workspace_id, pubkey, role FROM workspace_members WHERE workspace_id = ? AND pubkey = ?'
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
const updateFormsWorkspaceById = db.prepare(
  'UPDATE forms SET workspace_id = ? WHERE workspace_id = ?'
);

export const listWorkspacesForUser = (pubkey: string) => {
  return selectWorkspacesForUser.all(pubkey) as WorkspaceRecord[];
};

export const getWorkspaceById = (id: string) => {
  const row = selectWorkspaceById.get(id) as WorkspaceRecord | undefined;
  return row ?? null;
};

export const createWorkspace = (name: string, pubkey: string) => {
  const now = Date.now();
  const id = crypto.randomUUID();
  insertWorkspace.run(id, name, now, now);
  insertMember.run(id, pubkey, 'owner', now);
  return { id, created_at: now, updated_at: now };
};

export const ensureDefaultWorkspace = (pubkey: string) => {
  const existing = listWorkspacesForUser(pubkey);
  if (existing.length > 0) {
    return existing[0];
  }
  const created = createWorkspace('My workspace', pubkey);
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
