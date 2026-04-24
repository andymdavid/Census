import db from '../db';
import {
  attachLegacyFormsToWorkspace,
  createWorkspace,
  listWorkspacesForOrgAndUser,
  normalizePubkey,
  updateWorkspacesOrganization,
} from './workspaceService';

export interface OrganizationRecord {
  id: string;
  name: string;
  role?: string;
  created_at: number;
  updated_at: number;
}

export interface OrganizationSettingsRecord {
  organization_id: string;
  ai_enabled: number;
  ai_default_model: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_background_color: string | null;
  brand_text_color: string | null;
  updated_at: number;
  updated_by: string | null;
}

const insertOrganization = db.prepare(
  'INSERT INTO organizations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
);
const insertMember = db.prepare(
  'INSERT INTO organization_members (organization_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);
const selectOrganizationsForUser = db.prepare(
  `
  SELECT o.id, o.name, m.role, o.created_at, o.updated_at
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
const selectMembers = db.prepare(
  'SELECT organization_id, pubkey, role, created_at FROM organization_members WHERE organization_id = ? ORDER BY created_at ASC'
);
const insertMemberIfMissing = db.prepare(
  'INSERT OR IGNORE INTO organization_members (organization_id, pubkey, role, created_at) VALUES (?, ?, ?, ?)'
);
const updateOrganizationNameStatement = db.prepare(
  'UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?'
);
const selectOrganizationSettings = db.prepare(
  `SELECT organization_id, ai_enabled, ai_default_model, brand_logo_url, brand_primary_color,
          brand_background_color, brand_text_color, updated_at, updated_by
   FROM organization_settings
   WHERE organization_id = ?`
);
const upsertOrganizationSettings = db.prepare(
  `INSERT INTO organization_settings (
      organization_id,
      ai_enabled,
      ai_default_model,
      brand_logo_url,
      brand_primary_color,
      brand_background_color,
      brand_text_color,
      updated_at,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      ai_enabled = excluded.ai_enabled,
      ai_default_model = excluded.ai_default_model,
      brand_logo_url = excluded.brand_logo_url,
      brand_primary_color = excluded.brand_primary_color,
      brand_background_color = excluded.brand_background_color,
      brand_text_color = excluded.brand_text_color,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`
);

export const listOrganizationsForUser = (pubkey: string) => {
  return selectOrganizationsForUser.all(pubkey) as OrganizationRecord[];
};

export const getOrganizationById = (id: string) => {
  const row = selectOrganizationById.get(id) as OrganizationRecord | undefined;
  return row ?? null;
};

export const renameOrganization = (organizationId: string, name: string) => {
  const now = Date.now();
  updateOrganizationNameStatement.run(name, now, organizationId);
  return { updated_at: now };
};

export const isOrganizationMember = (organizationId: string, pubkey: string) => {
  const row = selectMembership.get(organizationId, pubkey) as
    | { organization_id: string; pubkey: string; role: string }
    | undefined;
  return Boolean(row);
};

export const getOrganizationMemberRole = (organizationId: string, pubkey: string) => {
  const row = selectMembership.get(organizationId, pubkey) as
    | { organization_id: string; pubkey: string; role: string }
    | undefined;
  return row?.role ?? null;
};

export const createOrganization = (name: string, pubkey: string) => {
  const now = Date.now();
  const id = crypto.randomUUID();
  insertOrganization.run(id, name, now, now);
  insertMember.run(id, pubkey, 'owner', now);
  return { id, created_at: now, updated_at: now };
};

export const listOrganizationMembers = (organizationId: string) => {
  return selectMembers.all(organizationId) as Array<{
    organization_id: string;
    pubkey: string;
    role: string;
    created_at: number;
  }>;
};

export const addOrganizationMember = (organizationId: string, pubkey: string, role = 'member') => {
  const normalized = normalizePubkey(pubkey);
  if (!normalized) return null;
  const now = Date.now();
  insertMemberIfMissing.run(organizationId, normalized, role, now);
  return listOrganizationMembers(organizationId);
};

export const getOrganizationSettings = (organizationId: string) => {
  const row = selectOrganizationSettings.get(organizationId) as OrganizationSettingsRecord | undefined;
  return (
    row ?? {
      organization_id: organizationId,
      ai_enabled: 1,
      ai_default_model: null,
      brand_logo_url: null,
      brand_primary_color: null,
      brand_background_color: null,
      brand_text_color: null,
      updated_at: 0,
      updated_by: null,
    }
  );
};

export const updateOrganizationSettings = (
  organizationId: string,
  input: {
    aiEnabled: boolean;
    aiDefaultModel?: string | null;
    brandLogoUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandBackgroundColor?: string | null;
    brandTextColor?: string | null;
  },
  updatedBy: string
) => {
  const now = Date.now();
  upsertOrganizationSettings.run(
    organizationId,
    input.aiEnabled ? 1 : 0,
    input.aiDefaultModel?.trim() || null,
    input.brandLogoUrl?.trim() || null,
    input.brandPrimaryColor?.trim() || null,
    input.brandBackgroundColor?.trim() || null,
    input.brandTextColor?.trim() || null,
    now,
    updatedBy
  );
  return getOrganizationSettings(organizationId);
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
    attachLegacyFormsToWorkspace(defaultWorkspace.id);
  }
  return getOrganizationById(created.id);
};

export const listWorkspacesForOrganization = (organizationId: string, pubkey: string) => {
  return listWorkspacesForOrgAndUser(organizationId, pubkey);
};
