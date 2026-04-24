import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Calendar, ChevronDown, LayoutGrid, Plus, Search, UserPlus } from 'lucide-react';
import { nip19, SimplePool } from 'nostr-tools';

interface FormListItem {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  published: number;
  responses_count?: number;
}

interface FunnelStats {
  totalStarts: number;
  completions: number;
}

interface WorkspaceItem {
  id: string;
  name: string;
  role?: string;
  created_at: number;
  updated_at: number;
}

interface OrganizationItem {
  id: string;
  name: string;
  role?: string;
  created_at: number;
  updated_at: number;
}

interface MemberProfile {
  name: string | null;
  picture: string | null;
}

interface OrganizationSettingsData {
  aiEnabled: boolean;
  aiDefaultModel: string | null;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  brandBackgroundColor: string | null;
  brandTextColor: string | null;
  updatedAt: number;
  updatedBy: string | null;
}

interface OrganizationSettingsResponse {
  organization: {
    id: string;
    name: string;
  };
  settings: OrganizationSettingsData;
  integrations: {
    openRouterConfigured: boolean;
  };
}

const Forms: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [funnelStats, setFunnelStats] = useState<Record<string, FunnelStats>>({});
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [npub, setNpub] = useState<string | null>(null);
  const [workspacesOpen, setWorkspacesOpen] = useState(true);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [renameWorkspaceOpen, setRenameWorkspaceOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'alpha'>('created');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState<
    Array<{ pubkey: string; role: string; created_at: number }>
  >([]);
  const [workspaceMembersLoading, setWorkspaceMembersLoading] = useState(false);
  const [workspaceMembersError, setWorkspaceMembersError] = useState<string | null>(null);
  const [orgInviteOpen, setOrgInviteOpen] = useState(false);
  const [orgInviteValue, setOrgInviteValue] = useState('');
  const [organizationMembers, setOrganizationMembers] = useState<
    Array<{ pubkey: string; role: string; created_at: number }>
  >([]);
  const [organizationMembersLoading, setOrganizationMembersLoading] = useState(false);
  const [organizationMembersError, setOrganizationMembersError] = useState<string | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgError, setOrgError] = useState<string | null>(null);
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
  const [adminSettingsError, setAdminSettingsError] = useState<string | null>(null);
  const [adminSettingsSaving, setAdminSettingsSaving] = useState(false);
  const [adminOrganizationName, setAdminOrganizationName] = useState('');
  const [adminAiEnabled, setAdminAiEnabled] = useState(true);
  const [adminAiDefaultModel, setAdminAiDefaultModel] = useState('');
  const [adminBrandLogoUrl, setAdminBrandLogoUrl] = useState('');
  const [adminBrandPrimaryColor, setAdminBrandPrimaryColor] = useState('#4f46e5');
  const [adminBrandBackgroundColor, setAdminBrandBackgroundColor] = useState('#f5f6fa');
  const [adminBrandTextColor, setAdminBrandTextColor] = useState('#1f2937');
  const [openRouterConfigured, setOpenRouterConfigured] = useState(false);
  const [deleteFormTarget, setDeleteFormTarget] = useState<FormListItem | null>(null);

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const data = (await response.json()) as { error?: string; details?: string[] };
      if (Array.isArray(data.details) && data.details.length > 0) {
        return data.details[0];
      }
      if (data.error) {
        return data.error;
      }
    } catch {
      // ignore parse errors and use the fallback message
    }
    return fallback;
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [meResponse, organizationsResponse] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/organizations', { credentials: 'include' }),
        ]);
        if (isMounted) {
          if (meResponse.ok) {
            const meData = (await meResponse.json()) as { pubkey?: string; npub?: string };
            const nextPubkey = meData.pubkey ?? null;
            const nextNpub = meData.npub ?? (nextPubkey ? nip19.npubEncode(nextPubkey) : null);
            setPubkey(nextPubkey);
            setNpub(nextNpub);
          }
        }
        if (!organizationsResponse.ok) {
          throw new Error('Failed to load organisations.');
        }
        const orgData = (await organizationsResponse.json()) as { organizations?: OrganizationItem[] };
        if (isMounted) {
          const list = orgData.organizations ?? [];
          setOrganizations(list);
          const storedOrgId = localStorage.getItem('census.activeOrganizationId');
          const fallbackOrgId = list[0]?.id ?? null;
          const nextOrgId =
            storedOrgId && list.some((org) => org.id === storedOrgId) ? storedOrgId : fallbackOrgId;
          setActiveOrganizationId(nextOrgId);
          if (nextOrgId) {
            localStorage.setItem('census.activeOrganizationId', nextOrgId);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaces = async () => {
      if (!activeOrganizationId) return;
      try {
        const response = await fetch(`/api/workspaces?orgId=${activeOrganizationId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load workspaces.');
        }
        const data = (await response.json()) as { workspaces?: WorkspaceItem[] };
        if (isMounted) {
          const list = data.workspaces ?? [];
          setWorkspaces(list);
          const storedWorkspaceId = localStorage.getItem(
            `census.activeWorkspaceId.${activeOrganizationId}`
          );
          const fallbackId = list[0]?.id ?? null;
          const nextId =
            storedWorkspaceId && list.some((w) => w.id === storedWorkspaceId)
              ? storedWorkspaceId
              : fallbackId;
          setActiveWorkspaceId(nextId);
          if (nextId) {
            localStorage.setItem(`census.activeWorkspaceId.${activeOrganizationId}`, nextId);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [activeOrganizationId]);

  useEffect(() => {
    let isMounted = true;

    const loadFunnels = async () => {
      if (!forms.length) return;
      const entries = await Promise.all(
        forms.map(async (form) => {
          try {
            const response = await fetch(`/api/forms/${form.id}/responses/funnel`);
            if (!response.ok) return [form.id, null] as const;
            const data = (await response.json()) as FunnelStats;
            return [form.id, data] as const;
          } catch {
            return [form.id, null] as const;
          }
        })
      );
      if (isMounted) {
        const next: Record<string, FunnelStats> = {};
        entries.forEach(([id, data]) => {
          if (data) {
            next[id] = data;
          }
        });
        setFunnelStats(next);
      }
    };

    loadFunnels();

    return () => {
      isMounted = false;
    };
  }, [forms]);

  useEffect(() => {
    let isMounted = true;

    const loadForms = async () => {
      if (!activeWorkspaceId) return;
      try {
        const response = await fetch(`/api/forms?workspaceId=${activeWorkspaceId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load forms.');
        }
        const data = (await response.json()) as { forms?: FormListItem[] };
        if (isMounted) {
          setForms(data.forms ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    loadForms();

    return () => {
      isMounted = false;
    };
  }, [activeWorkspaceId]);

  const filteredForms = useMemo(() => {
    if (!query.trim()) return forms;
    const lowered = query.toLowerCase();
    return forms.filter((form) => form.title.toLowerCase().includes(lowered));
  }, [forms, query]);

  const sortedForms = useMemo(() => {
    const next = [...filteredForms];
    if (sortBy === 'updated') {
      next.sort((a, b) => (Number(b.updated_at) || 0) - (Number(a.updated_at) || 0));
      return next;
    }
    if (sortBy === 'alpha') {
      next.sort((a, b) => a.title.localeCompare(b.title));
      return next;
    }
    next.sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
    return next;
  }, [filteredForms, sortBy]);

  const sortLabel =
    sortBy === 'updated' ? 'Last updated' : sortBy === 'alpha' ? 'Alphabetical' : 'Date created';

  const applySort = (next: 'created' | 'updated' | 'alpha') => {
    setSortBy(next);
  };

  useEffect(() => {
    if (!pubkey) {
      setProfileName(null);
      setProfilePicture(null);
      return;
    }
    let isActive = true;
    const pool = new SimplePool();
    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];
    (async () => {
      try {
        const event = await pool.get(relays, { kinds: [0], authors: [pubkey] }, { maxWait: 4000 });
        if (!isActive || !event?.content) return;
        const metadata = JSON.parse(event.content) as {
          name?: string;
          display_name?: string;
          picture?: string;
        };
        const nextName = metadata.display_name || metadata.name || null;
        const nextPicture = metadata.picture || null;
        setProfileName(nextName);
        setProfilePicture(nextPicture);
      } catch {
        if (!isActive) return;
        setProfileName(null);
        setProfilePicture(null);
      } finally {
        pool.close(relays);
      }
    })();
    return () => {
      isActive = false;
      pool.close(relays);
    };
  }, [pubkey]);

  useEffect(() => {
    if (!inviteOpen || !activeWorkspaceId) return;
    loadWorkspaceMembers(activeWorkspaceId);
  }, [inviteOpen, activeWorkspaceId]);

  useEffect(() => {
    const activeOrganizationRole = organizations.find((org) => org.id === activeOrganizationId)?.role;
    const effectiveOrganizationMembers =
      pubkey &&
      activeOrganizationRole &&
      !organizationMembers.some((member) => member.pubkey === pubkey)
        ? [
            {
              pubkey,
              role: activeOrganizationRole,
              created_at: Date.now(),
            },
            ...organizationMembers,
          ]
        : organizationMembers;
    const visibleMemberPubkeys = Array.from(
      new Set(
        [...workspaceMembers, ...effectiveOrganizationMembers]
          .map((member) => member.pubkey)
          .filter(Boolean)
      )
    );
    const unresolved = visibleMemberPubkeys.filter((memberPubkey) => !memberProfiles[memberPubkey]);
    if (unresolved.length === 0) return;
    let isActive = true;
    const pool = new SimplePool();
    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];
    (async () => {
      try {
        const events = await Promise.all(
          unresolved.map((memberPubkey) =>
            pool.get(relays, { kinds: [0], authors: [memberPubkey] }, { maxWait: 4000 })
          )
        );
        if (!isActive) return;
        const nextProfiles: Record<string, MemberProfile> = {};
        unresolved.forEach((memberPubkey, index) => {
          const event = events[index];
          if (!event?.content) {
            nextProfiles[memberPubkey] = { name: null, picture: null };
            return;
          }
          try {
            const metadata = JSON.parse(event.content) as {
              name?: string;
              display_name?: string;
              picture?: string;
            };
            nextProfiles[memberPubkey] = {
              name: metadata.display_name || metadata.name || null,
              picture: metadata.picture || null,
            };
          } catch {
            nextProfiles[memberPubkey] = { name: null, picture: null };
          }
        });
        setMemberProfiles((prev) => ({ ...prev, ...nextProfiles }));
      } finally {
        pool.close(relays);
      }
    })();
    return () => {
      isActive = false;
      pool.close(relays);
    };
  }, [activeOrganizationId, memberProfiles, organizationMembers, organizations, pubkey, workspaceMembers]);

  useEffect(() => {
    if (!orgInviteOpen || !activeOrganizationId) return;
    void loadOrganizationMembers(activeOrganizationId);
  }, [orgInviteOpen, activeOrganizationId]);

  const loadWorkspaceMembers = async (workspaceId: string) => {
    setWorkspaceMembersLoading(true);
    setWorkspaceMembersError(null);
    const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
      credentials: 'include',
    });
    if (!response.ok) {
      setWorkspaceMembersError(await readApiError(response, 'Unable to load workspace members.'));
      setWorkspaceMembersLoading(false);
      return;
    }
    const data = (await response.json()) as {
      members?: Array<{ pubkey: string; role: string; created_at: number }>;
    };
    setWorkspaceMembers(data.members ?? []);
    setWorkspaceMembersLoading(false);
  };

  const loadOrganizationMembers = async (organizationId: string) => {
    setOrganizationMembersLoading(true);
    setOrganizationMembersError(null);
    const response = await fetch(`/api/organizations/${organizationId}/members`, {
      credentials: 'include',
    });
    if (!response.ok) {
      setOrganizationMembersError(
        await readApiError(response, 'Unable to load organisation members.')
      );
      setOrganizationMembersLoading(false);
      return;
    }
    const data = (await response.json()) as {
      members?: Array<{ pubkey: string; role: string; created_at: number }>;
    };
    setOrganizationMembers(data.members ?? []);
    setOrganizationMembersLoading(false);
  };

  const handleInvite = async () => {
    if (!activeWorkspaceId) return;
    const payload = inviteValue.trim();
    if (!payload) return;
    setError(null);
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}/invite`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: payload }),
    });
    if (!response.ok) {
      setWorkspaceMembersError(await readApiError(response, 'Unable to invite workspace member.'));
      return;
    }
    const data = (await response.json()) as {
      members?: Array<{ pubkey: string; role: string; created_at: number }>;
    };
    setWorkspaceMembers(data.members ?? []);
    setInviteValue('');
  };

  const handleOrganizationInvite = async () => {
    if (!activeOrganizationId) return;
    const payload = orgInviteValue.trim();
    if (!payload) return;
    setError(null);
    const response = await fetch(`/api/organizations/${activeOrganizationId}/invite`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: payload }),
    });
    if (!response.ok) {
      setOrganizationMembersError(
        await readApiError(response, 'Unable to invite organisation member.')
      );
      return;
    }
    const data = (await response.json()) as {
      members?: Array<{ pubkey: string; role: string; created_at: number }>;
    };
    setOrganizationMembers(data.members ?? []);
    setOrgInviteValue('');
  };

  const openOrganizationMembers = () => {
    setOrgInviteOpen(true);
    setOrganizationMembers([]);
    setOrganizationMembersError(null);
    if (activeOrganizationId) {
      void loadOrganizationMembers(activeOrganizationId);
    }
  };

  const openAdminSettings = async () => {
    if (!activeOrganizationId) return;
    setAdminSettingsOpen(true);
    setAdminSettingsLoading(true);
    setAdminSettingsError(null);
    try {
      const response = await fetch(`/api/organizations/${activeOrganizationId}/settings`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to load admin settings.'));
      }
      const data = (await response.json()) as OrganizationSettingsResponse;
      setAdminOrganizationName(data.organization.name);
      setAdminAiEnabled(data.settings.aiEnabled);
      setAdminAiDefaultModel(data.settings.aiDefaultModel ?? '');
      setAdminBrandLogoUrl(data.settings.brandLogoUrl ?? '');
      setAdminBrandPrimaryColor(data.settings.brandPrimaryColor ?? '#4f46e5');
      setAdminBrandBackgroundColor(data.settings.brandBackgroundColor ?? '#f5f6fa');
      setAdminBrandTextColor(data.settings.brandTextColor ?? '#1f2937');
      setOpenRouterConfigured(data.integrations.openRouterConfigured);
    } catch (err) {
      setAdminSettingsError(err instanceof Error ? err.message : 'Unable to load admin settings.');
    } finally {
      setAdminSettingsLoading(false);
    }
  };

  const handleSaveAdminSettings = async () => {
    if (!activeOrganizationId) return;
    setAdminSettingsSaving(true);
    setAdminSettingsError(null);
    try {
      const response = await fetch(`/api/organizations/${activeOrganizationId}/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminOrganizationName,
          aiEnabled: adminAiEnabled,
          aiDefaultModel: adminAiDefaultModel,
          brandLogoUrl: adminBrandLogoUrl,
          brandPrimaryColor: adminBrandPrimaryColor,
          brandBackgroundColor: adminBrandBackgroundColor,
          brandTextColor: adminBrandTextColor,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to save admin settings.'));
      }
      const data = (await response.json()) as OrganizationSettingsResponse;
      setOrganizations((prev) =>
        prev.map((organization) =>
          organization.id === activeOrganizationId
            ? { ...organization, name: data.organization.name }
            : organization
        )
      );
      setAdminOrganizationName(data.organization.name);
      setAdminAiEnabled(data.settings.aiEnabled);
      setAdminAiDefaultModel(data.settings.aiDefaultModel ?? '');
      setAdminBrandLogoUrl(data.settings.brandLogoUrl ?? '');
      setAdminBrandPrimaryColor(data.settings.brandPrimaryColor ?? '#4f46e5');
      setAdminBrandBackgroundColor(data.settings.brandBackgroundColor ?? '#f5f6fa');
      setAdminBrandTextColor(data.settings.brandTextColor ?? '#1f2937');
      setOpenRouterConfigured(data.integrations.openRouterConfigured);
    } catch (err) {
      setAdminSettingsError(err instanceof Error ? err.message : 'Unable to save admin settings.');
    } finally {
      setAdminSettingsSaving(false);
    }
  };

  const handleCreateOrganization = async () => {
    const trimmed = orgName.trim();
    if (!trimmed) {
      setOrgError('Organisation name is required.');
      return;
    }
    const response = await fetch('/api/organizations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok) {
      setOrgError(data.error ?? `Unable to create organisation (${response.status}).`);
      return;
    }
    if (data.id) {
      const newOrg: OrganizationItem = {
        id: data.id,
        name: trimmed,
        role: 'owner',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      setOrganizations((prev) => [...prev, newOrg]);
      setActiveOrganization(data.id);
      setOrgName('');
      setOrgError(null);
      setOrgModalOpen(false);
    }
  };


  const avatarLabel = pubkey ? pubkey.slice(0, 2).toUpperCase() : 'OF';
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const workspaceLabel = activeWorkspace?.name ?? 'Workspace';
  const activeWorkspaceRole = activeWorkspace?.role ?? null;
  const isWorkspaceOwner = activeWorkspaceRole === 'owner';
  const activeOrganization = organizations.find((org) => org.id === activeOrganizationId);
  const organizationLabel = activeOrganization?.name ?? 'Add new organisation';
  const isOrganizationOwner = activeOrganization?.role === 'owner';
  const visibleOrganizationMembers = useMemo(() => {
    if (!pubkey || !activeOrganization?.role) {
      return organizationMembers;
    }
    if (organizationMembers.some((member) => member.pubkey === pubkey)) {
      return organizationMembers;
    }
    return [
      {
        pubkey,
        role: activeOrganization.role,
        created_at: Date.now(),
      },
      ...organizationMembers,
    ];
  }, [activeOrganization?.role, organizationMembers, pubkey]);
  const shortNpub = npub ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : null;

  const handleCopyNpub = async () => {
    if (!npub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const setActiveWorkspace = (nextId: string | null) => {
    setActiveWorkspaceId(nextId);
    if (activeOrganizationId) {
      const storageKey = `census.activeWorkspaceId.${activeOrganizationId}`;
      if (nextId) {
        localStorage.setItem(storageKey, nextId);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  };

  const setActiveOrganization = (nextId: string | null) => {
    setActiveOrganizationId(nextId);
    if (nextId) {
      localStorage.setItem('census.activeOrganizationId', nextId);
    } else {
      localStorage.removeItem('census.activeOrganizationId');
    }
    setActiveWorkspaceId(null);
    setWorkspaces([]);
  };

  const handleRenameWorkspace = async () => {
    if (!activeWorkspaceId) return;
    const trimmed = workspaceRenameValue.trim();
    if (!trimmed) return;
    setError(null);
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!response.ok) {
      setError(await readApiError(response, 'Unable to rename workspace.'));
      return;
    }
    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === activeWorkspaceId ? { ...workspace, name: trimmed } : workspace
      )
    );
    setRenameWorkspaceOpen(false);
  };

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspaceId) return;
    setError(null);
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}/leave`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      setError(await readApiError(response, 'Unable to leave workspace.'));
      return;
    }
    setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== activeWorkspaceId));
    const nextId = workspaces.find((workspace) => workspace.id !== activeWorkspaceId)?.id ?? null;
    setActiveWorkspace(nextId);
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId) return;
    setError(null);
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      setError(await readApiError(response, 'Unable to delete workspace.'));
      return;
    }
    setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== activeWorkspaceId));
    const nextId = workspaces.find((workspace) => workspace.id !== activeWorkspaceId)?.id ?? null;
    setActiveWorkspace(nextId);
    setDeleteWorkspaceOpen(false);
  };

  const handleDeleteForm = async () => {
    if (!deleteFormTarget) return;
    setError(null);
    const response = await fetch(`/api/forms/${deleteFormTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      setError(await readApiError(response, 'Unable to delete form.'));
      return;
    }
    setForms((prev) => prev.filter((form) => form.id !== deleteFormTarget.id));
    setDeleteFormTarget(null);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/forms" className="text-[20px] text-gray-800 of-logo-text hover:text-gray-600 transition">
            Census
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="h-9 w-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-semibold overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  avatarLabel
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={8}
                align="end"
                className="w-64 rounded-xl bg-white p-4 shadow-xl border border-gray-100"
              >
                <div className="text-sm font-semibold text-gray-800">Profile</div>
                <div className="text-sm font-semibold text-gray-800 mt-2">
                  {profileName ?? 'Unknown user'}
                </div>
                <button
                  type="button"
                  className="text-xs text-gray-500 mt-1 break-all hover:text-gray-700"
                  onClick={handleCopyNpub}
                >
                  {shortNpub ?? (pubkey ? `${pubkey.slice(0, 12)}…` : 'Unknown user')}
                  {copied ? ' • Copied' : ''}
                </button>
                {activeWorkspace && (
                  <div className="text-xs text-gray-400 mt-3">
                    Workspace: <span className="text-gray-600">{activeWorkspace.name}</span>
                  </div>
                )}
                <button
                  className="mt-4 w-full text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl px-3 py-2"
                  onClick={() => {
                    fetch('/api/auth/logout', { method: 'POST' }).finally(() => window.location.reload());
                  }}
                >
                  Log out
                </button>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="flex-1 px-6 pb-6 flex" style={{ paddingTop: '0px' }}>
        <div
          className="rounded-2xl overflow-hidden flex-1 flex"
          style={{ backgroundColor: '#f7f7f8' }}
        >
          <div className="flex flex-1">
            <aside className="w-72 p-5 flex flex-col gap-4 border-r-2 border-white h-full">
              <button
                type="button"
                className="w-full h-[30px] text-[12px] leading-none flex items-center justify-center rounded-xl border bg-[#177767] border-[#177767] text-white transition hover:bg-[#146957] hover:border-[#146957]"
                onClick={() => {
                  if (!activeWorkspaceId) {
                    setWorkspaceModalOpen(true);
                    return;
                  }
                  navigate(`/forms/new/edit?workspaceId=${activeWorkspaceId}`);
                }}
              >
                + Create a new form
              </button>
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Workspaces</span>
                  </div>
                  <Dialog.Root open={workspaceModalOpen} onOpenChange={setWorkspaceModalOpen}>
                    <Dialog.Trigger asChild>
                      <button className="h-8 w-8 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center">
                        <Plus className="h-4 w-4" />
                      </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                      <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <Dialog.Title className="text-lg font-semibold text-gray-900">
                              New workspace
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-gray-500 mt-1">
                              Create a workspace to organize your forms.
                            </Dialog.Description>
                          </div>
                          <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-xl border border-gray-200">
                            Close
                          </Dialog.Close>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label htmlFor="workspace-name" className="text-xs text-gray-500">
                              Workspace name
                            </label>
                            <input
                              id="workspace-name"
                              type="text"
                              value={workspaceName}
                              onChange={(event) => setWorkspaceName(event.target.value)}
                              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g. Product team"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                              Cancel
                            </Dialog.Close>
                            <button
                              type="button"
                              className="px-4 py-2 rounded-xl bg-[#177767] text-white text-sm hover:bg-[#146957] transition"
                              onClick={async () => {
                                const trimmed = workspaceName.trim();
                                if (!trimmed || !activeOrganizationId) return;
                                setError(null);
                                const response = await fetch('/api/workspaces', {
                                  method: 'POST',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: trimmed, orgId: activeOrganizationId }),
                                });
                                if (!response.ok) {
                                  setError(await readApiError(response, 'Unable to create workspace.'));
                                  return;
                                }
                                const data = (await response.json()) as { id?: string };
                                if (data.id) {
                                  const newWorkspace: WorkspaceItem = {
                                    id: data.id,
                                    name: trimmed,
                                    role: 'owner',
                                    created_at: Date.now(),
                                    updated_at: Date.now(),
                                  };
                                  setWorkspaces((prev) => [...prev, newWorkspace]);
                                  setActiveWorkspace(data.id);
                                }
                                setWorkspaceName('');
                                setWorkspaceModalOpen(false);
                              }}
                            >
                              Create workspace
                            </button>
                          </div>
                        </div>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                </div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                  onClick={() => setWorkspacesOpen((prev) => !prev)}
                >
                  <span>Private</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${workspacesOpen ? '' : '-rotate-90'}`}
                  />
                </button>
                {workspacesOpen &&
                  workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                      workspace.id === activeWorkspaceId
                        ? 'text-gray-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    style={workspace.id === activeWorkspaceId ? { backgroundColor: '#ededee' } : undefined}
                      onClick={() => {
                        setActiveWorkspace(workspace.id);
                      }}
                    >
                      <span>{workspace.name}</span>
                    </button>
                  ))}
              </div>

              <div className="mt-auto pt-4">
                <DropdownMenu.Root open={orgMenuOpen} onOpenChange={setOrgMenuOpen}>
                  <DropdownMenu.Trigger asChild>
                    <button className="w-full flex items-center justify-between text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-700/80 text-white text-xs font-semibold flex items-center justify-center">
                          OS
                        </div>
                        <div className="text-sm font-medium text-gray-700">{organizationLabel}</div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${
                          orgMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      sideOffset={10}
                      side="top"
                      align="start"
                      className="w-64 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden"
                    >
                      <div className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">
                        Organisations
                      </div>
                      {organizations.map((org) => (
                        <DropdownMenu.Item
                          key={org.id}
                          className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${
                            org.id === activeOrganizationId
                              ? 'bg-gray-100 text-gray-800'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          onSelect={() => setActiveOrganization(org.id)}
                        >
                          <span>{org.name}</span>
                          {org.id === activeOrganizationId && <span className="text-xs">✓</span>}
                        </DropdownMenu.Item>
                      ))}
                      <DropdownMenu.Separator className="h-px bg-gray-100" />
                      <DropdownMenu.Item
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        onSelect={() => setOrgModalOpen(true)}
                      >
                        Create organisation
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="h-px bg-gray-100" />
                      <DropdownMenu.Item
                        className={`px-4 py-2 text-sm ${
                          isOrganizationOwner
                            ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        onSelect={(event) => {
                          if (!isOrganizationOwner) {
                            event.preventDefault();
                            return;
                          }
                          void openAdminSettings();
                        }}
                      >
                        Admin settings
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        onSelect={openOrganizationMembers}
                      >
                        Organisation members
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </aside>

            <main className="flex-1 flex flex-col">
              <div className="px-6 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">{workspaceLabel}</h2>
                    <DropdownMenu.Root open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
                      <DropdownMenu.Trigger asChild>
                        <button className="text-gray-400 hover:text-gray-600">···</button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          sideOffset={8}
                          align="start"
                          className="w-40 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden"
                        >
                          <DropdownMenu.Item
                            className={`px-4 py-2 text-sm ${
                              isWorkspaceOwner
                                ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onSelect={() => {
                              if (!isWorkspaceOwner) return;
                              setWorkspaceRenameValue(activeWorkspace?.name ?? '');
                              setRenameWorkspaceOpen(true);
                            }}
                          >
                            Rename
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onSelect={handleLeaveWorkspace}
                          >
                            Leave
                          </DropdownMenu.Item>
                          {isWorkspaceOwner && (
                            <DropdownMenu.Item
                              className="px-4 py-2 text-sm text-red-600 hover:bg-gray-100 cursor-pointer"
                              onSelect={() => setDeleteWorkspaceOpen(true)}
                            >
                              Delete
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                  <div className="flex items-center gap-3">
                    {isWorkspaceOwner && (
                      <button
                        className="h-[30px] text-xs text-gray-600 border border-gray-200 rounded-xl px-3 inline-flex items-center gap-2 bg-white hover:bg-[#ededee] transition"
                        onClick={() => setInviteOpen(true)}
                      >
                        <UserPlus className="h-3.5 w-3.5 text-gray-500" />
                        Invite
                      </button>
                    )}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="h-[30px] text-xs text-gray-600 border border-gray-200 rounded-xl px-3 inline-flex items-center gap-2 bg-white hover:bg-[#ededee] transition">
                          <Calendar className="h-3.5 w-3.5 text-gray-500" />
                          {sortLabel}
                          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          sideOffset={6}
                          align="end"
                          className="w-44 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden"
                        >
                          <DropdownMenu.Item
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onSelect={() => applySort('created')}
                            onClick={() => applySort('created')}
                          >
                            Date created
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onSelect={() => applySort('updated')}
                            onClick={() => applySort('updated')}
                          >
                            Last updated
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onSelect={() => applySort('alpha')}
                            onClick={() => applySort('alpha')}
                          >
                            Alphabetical
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3"
                      style={{ height: '30px', backgroundColor: '#f0f0f0', border: '1px solid #f0f0f0' }}
                    >
                      <Search className="h-3.5 w-3.5 text-gray-400" />
                      <input
                        id="search"
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-40 bg-transparent text-sm leading-none text-gray-600 focus:outline-none"
                        placeholder="Search"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="-ml-72 w-[calc(100%+18rem)] h-0.5 bg-white/80 mb-4" />

              {activeWorkspaceId && (
                <>

                  <div className="px-6 py-2">
                    <div className="grid grid-cols-[1fr_120px_120px_140px_80px] text-xs text-gray-400 text-left items-center px-4">
                      <div>Forms</div>
                      <div className="flex items-center justify-center">Responses</div>
                      <div className="flex items-center justify-center">Completion</div>
                      <div className="text-center">Updated</div>
                      <div className="text-right">Actions</div>
                    </div>
                  </div>

                  {loading && <div className="text-gray-500 px-6 py-6">Loading...</div>}
                  {error && <div className="text-red-600 px-6 py-6">{error}</div>}

                  {!loading && !error && (
                    <div className="space-y-3 px-6 pb-6">
                      {sortedForms.length === 0 && (
                        <div className="text-gray-500 px-2 py-6">No forms found.</div>
                      )}
                      {sortedForms.map((form) => {
                        const funnel = funnelStats[form.id];
                        const completionRate = funnel?.totalStarts
                          ? Math.round((funnel.completions / funnel.totalStarts) * 100)
                          : 0;
                        return (
                          <div
                            key={form.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/forms/${form.id}/edit`)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                navigate(`/forms/${form.id}/edit`);
                              }
                            }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 grid grid-cols-[1fr_120px_120px_140px_80px] items-center hover:border-primary/40 hover:shadow-sm transition cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-8 w-8 rounded-lg bg-emerald-700/80 text-white text-[11px] font-semibold flex items-center justify-center">
                                OF
                              </div>
                              <div>
                                <div className="flex items-center gap-4">
                                  <div className="text-[14px] font-semibold text-gray-800 leading-tight">
                                    {form.title}
                                  </div>
                                  <span
                                    className={`of-badge-sm ${
                                      form.published
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {form.published ? 'Published' : 'Draft'}
                                  </span>
                                  <span className="of-pill-sm">
                                    {form.responses_count ?? 0} responses
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 text-center">
                              {form.responses_count ?? 0}
                            </div>
                            <div className="text-sm text-gray-600 text-center">{completionRate}%</div>
                            <div className="text-sm text-gray-600 text-center">
                              {new Date(form.updated_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center justify-end">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="text-gray-400 hover:text-gray-600"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    ···
                                  </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    sideOffset={6}
                                    align="end"
                                    className="w-40 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden"
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                  >
                                    <DropdownMenu.Item
                                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        navigate(`/forms/${form.id}/edit`);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        navigate(`/forms/${form.id}/analytics`);
                                      }}
                                    >
                                      Analytics
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        navigator.clipboard.writeText(
                                          `${window.location.origin}/f/${form.id}`
                                        );
                                      }}
                                    >
                                      Share
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="px-4 py-2 text-sm text-red-600 hover:bg-gray-100 cursor-pointer"
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        setDeleteFormTarget(form);
                                      }}
                                    >
                                      Delete
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {!loading && !error && !activeOrganizationId && (
                <div className="px-6 pb-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="text-base font-semibold text-gray-800">
                      Create your first organisation
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Organisations group workspaces and members.
                    </div>
                    <button
                      type="button"
                      className="mt-4 inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:border-gray-300"
                      onClick={() => setOrgModalOpen(true)}
                    >
                      Create organisation
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && activeOrganizationId && !activeWorkspaceId && (
                <div className="px-6 pb-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="text-base font-semibold text-gray-800">
                      Create your first workspace
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      Workspaces keep forms and responses organized.
                    </div>
                    <button
                      type="button"
                      className="mt-4 inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:border-gray-300"
                      onClick={() => setWorkspaceModalOpen(true)}
                    >
                      Create workspace
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      <Dialog.Root open={renameWorkspaceOpen} onOpenChange={setRenameWorkspaceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Rename workspace
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mt-2">
              Update the workspace name.
            </Dialog.Description>
            <input
              type="text"
              value={workspaceRenameValue}
              onChange={(event) => setWorkspaceRenameValue(event.target.value)}
              className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-[#177767] text-white text-sm hover:bg-[#146957] transition"
                onClick={handleRenameWorkspace}
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteWorkspaceOpen} onOpenChange={setDeleteWorkspaceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Delete workspace
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mt-2">
              This removes the workspace and unassigns its forms.
            </Dialog.Description>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700 transition"
                onClick={handleDeleteWorkspace}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={inviteOpen} onOpenChange={setInviteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Invite to workspace
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mt-2">
                  Add members to {workspaceLabel}.
                </Dialog.Description>
              </div>
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1">
                ✕
              </Dialog.Close>
            </div>

            <div className="mt-6">
              <label className="text-xs uppercase tracking-wide text-gray-400">
                Nostr npub or pubkey
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="text"
                  value={inviteValue}
                  onChange={(event) => setInviteValue(event.target.value)}
                  placeholder="npub1... or 64-char pubkey"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  className="h-[40px] px-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleInvite}
                >
                  Invite
                </button>
              </div>
            </div>

            <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                <span>Members</span>
                <span>{workspaceMembers.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {workspaceMembersLoading && (
                  <div className="px-4 py-4 text-sm text-gray-500">Loading members...</div>
                )}
                {workspaceMembersError && (
                  <div className="px-4 py-4 text-sm text-red-600">{workspaceMembersError}</div>
                )}
                {!workspaceMembersLoading &&
                  !workspaceMembersError &&
                  workspaceMembers.map((member) => {
                  const npub =
                    member.pubkey && member.pubkey.length === 64
                      ? nip19.npubEncode(member.pubkey)
                      : member.pubkey;
                  const shortNpub = npub ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : 'Unknown';
                  const profile = memberProfiles[member.pubkey];
                  const label = profile?.name || shortNpub;
                  return (
                    <div key={member.pubkey} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-700">{label}</div>
                        {profile?.name && (
                          <div className="text-xs text-gray-400 mt-0.5">{shortNpub}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        {member.role}
                      </div>
                    </div>
                  );
                })}
                {!workspaceMembersLoading && !workspaceMembersError && workspaceMembers.length === 0 && (
                  <div className="px-4 py-4 text-sm text-gray-500">No members yet.</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800">
                Close
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={orgInviteOpen} onOpenChange={setOrgInviteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Organisation members
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mt-2">
                  Manage members for {organizationLabel}.
                </Dialog.Description>
              </div>
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1">
                ✕
              </Dialog.Close>
            </div>

            <div className="mt-6">
              <label className="text-xs uppercase tracking-wide text-gray-400">
                Nostr npub or pubkey
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="text"
                  value={orgInviteValue}
                  onChange={(event) => setOrgInviteValue(event.target.value)}
                  placeholder="npub1... or 64-char pubkey"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={!isOrganizationOwner}
                />
                <button
                  type="button"
                  className="h-[40px] px-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleOrganizationInvite}
                  disabled={!isOrganizationOwner}
                >
                  Invite
                </button>
              </div>
              {!isOrganizationOwner && (
                <div className="mt-2 text-xs text-gray-500">
                  Only organisation owners can invite members.
                </div>
              )}
            </div>

            <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                <span>Members</span>
                <span>{visibleOrganizationMembers.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {organizationMembersLoading && (
                  <div className="px-4 py-4 text-sm text-gray-500">Loading members...</div>
                )}
                {organizationMembersError && (
                  <div className="px-4 py-4 text-sm text-red-600">{organizationMembersError}</div>
                )}
                {!organizationMembersLoading &&
                  !organizationMembersError &&
                  visibleOrganizationMembers.map((member) => {
                  const npub =
                    member.pubkey && member.pubkey.length === 64
                      ? nip19.npubEncode(member.pubkey)
                      : member.pubkey;
                  const shortNpub = npub ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : 'Unknown';
                  const profile = memberProfiles[member.pubkey];
                  const label = profile?.name || shortNpub;
                  return (
                    <div key={member.pubkey} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-700">{label}</div>
                        {profile?.name && (
                          <div className="text-xs text-gray-400 mt-0.5">{shortNpub}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        {member.role}
                      </div>
                    </div>
                  );
                })}
                {!organizationMembersLoading &&
                  !organizationMembersError &&
                  visibleOrganizationMembers.length === 0 && (
                  <div className="px-4 py-4 text-sm text-gray-500">No members yet.</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800">
                Close
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={adminSettingsOpen} onOpenChange={setAdminSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl focus:outline-none sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Admin settings
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-gray-500">
                  Manage organisation-level AI defaults and branding without exposing secrets.
                </Dialog.Description>
              </div>
              <Dialog.Close className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800">
                ✕
              </Dialog.Close>
            </div>

            {adminSettingsLoading ? (
              <div className="mt-8 text-sm text-gray-500">Loading admin settings...</div>
            ) : (
              <div className="mt-6 space-y-6">
                {adminSettingsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {adminSettingsError}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Organisation
                  </h3>
                  <div className="mt-4">
                    <label className="text-xs uppercase tracking-wide text-gray-400">
                      Organisation name
                    </label>
                    <input
                      type="text"
                      value={adminOrganizationName}
                      onChange={(event) => setAdminOrganizationName(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={!isOrganizationOwner}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        AI settings
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Control whether AI generation is available and which default model Census uses.
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        openRouterConfigured
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {openRouterConfigured ? 'OpenRouter connected' : 'OpenRouter not configured'}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-800">Enable AI generation</div>
                      <div className="mt-1 text-sm text-gray-500">
                        Disable this to block AI form generation for this organisation.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => isOrganizationOwner && setAdminAiEnabled((current) => !current)}
                      className={`inline-flex h-7 w-12 items-center rounded-full transition ${
                        adminAiEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                      } ${isOrganizationOwner ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <span
                        className={`ml-1 inline-block h-5 w-5 rounded-full bg-white transition ${
                          adminAiEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs uppercase tracking-wide text-gray-400">
                      Default AI model
                    </label>
                    <input
                      type="text"
                      value={adminAiDefaultModel}
                      onChange={(event) => setAdminAiDefaultModel(event.target.value)}
                      placeholder="openai/gpt-4.1-mini"
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={!isOrganizationOwner}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                      Secrets stay server-side. This only controls the default model name.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Branding defaults
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Set organization-level defaults that can later be applied to forms.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Logo URL
                      </label>
                      <input
                        type="text"
                        value={adminBrandLogoUrl}
                        onChange={(event) => setAdminBrandLogoUrl(event.target.value)}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!isOrganizationOwner}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Primary color
                      </label>
                      <input
                        type="text"
                        value={adminBrandPrimaryColor}
                        onChange={(event) => setAdminBrandPrimaryColor(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!isOrganizationOwner}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Background color
                      </label>
                      <input
                        type="text"
                        value={adminBrandBackgroundColor}
                        onChange={(event) => setAdminBrandBackgroundColor(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!isOrganizationOwner}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Text color
                      </label>
                      <input
                        type="text"
                        value={adminBrandTextColor}
                        onChange={(event) => setAdminBrandTextColor(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!isOrganizationOwner}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800">
                Close
              </Dialog.Close>
              <button
                type="button"
                className="rounded-xl bg-[#2f2b34] px-4 py-2 text-sm font-medium text-white hover:bg-[#27222a] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleSaveAdminSettings()}
                disabled={!isOrganizationOwner || adminSettingsLoading || adminSettingsSaving}
              >
                {adminSettingsSaving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={orgModalOpen}
        onOpenChange={(open) => {
          setOrgModalOpen(open);
          if (!open) {
            setOrgError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  New organisation
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mt-1">
                  Create an organisation to group workspaces.
                </Dialog.Description>
              </div>
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-xl border border-gray-200">
                Close
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              {orgError && <div className="text-sm text-red-600">{orgError}</div>}
              <div>
                <label htmlFor="org-name" className="text-xs text-gray-500">
                  Organisation name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Other Stuff"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                  Cancel
                </Dialog.Close>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-[#177767] text-white text-sm hover:bg-[#146957] transition"
                  onClick={handleCreateOrganization}
                >
                  Create
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(deleteFormTarget)} onOpenChange={(open) => {
        if (!open) {
          setDeleteFormTarget(null);
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between">
              <Dialog.Title className="text-2xl font-semibold text-gray-900">
                Delete this form?
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                ×
              </Dialog.Close>
            </div>
            <div className="mt-4 text-sm text-gray-600 leading-relaxed">
              You're about to delete{' '}
              <span className="text-gray-900 font-semibold">
                {deleteFormTarget?.title ?? 'this form'}
              </span>
              . It will be{' '}
              <span className="text-red-600 font-semibold">gone forever</span> and we won't be able
              to recover it.
            </div>
            <div className="mt-8 flex items-center justify-end gap-3">
              <Dialog.Close className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm hover:bg-gray-300">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700"
                onClick={handleDeleteForm}
              >
                Yes, delete it
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default Forms;
