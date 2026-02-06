import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LayoutGrid, Plus, Search } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import type { FormSchemaV0 } from '../types/formSchema';

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
  created_at: number;
  updated_at: number;
}

const defaultTheme = {
  primaryColor: '#4f46e5',
  backgroundColor: '#f5f6fa',
  textColor: '#1f2937',
  fontFamily: 'Inter, sans-serif',
  logoUrl: '',
};

const baseResults = [
  {
    label: 'Low',
    description: 'Low risk or low score.',
    maxScore: 50,
  },
  {
    label: 'High',
    description: 'High risk or high score.',
    minScore: 50,
  },
];

const createSchema = (overrides: Partial<FormSchemaV0> = {}): FormSchemaV0 => {
  return {
    version: 'v0',
    id: 'new-form',
    title: overrides.title ?? 'Untitled Form',
    description: overrides.description ?? '',
    questions: overrides.questions ?? [],
    results: overrides.results ?? baseResults,
    theme: overrides.theme ?? defaultTheme,
  };
};

const templateSchemas = [
  {
    key: 'blank',
    label: 'Blank Form',
    schema: createSchema({ title: 'Blank Form' }),
  },
  {
    key: 'assessment',
    label: 'Assessment',
    schema: createSchema({
      title: 'Assessment',
      description: 'Answer a few quick questions to get your score.',
      questions: [
        { id: 1, text: 'Is this a yes/no assessment question?', weight: 10, category: 'Assessment' },
      ],
      results: [
        {
          label: 'Low Score',
          description: 'Your score indicates low risk or impact.',
          maxScore: 50,
        },
        {
          label: 'High Score',
          description: 'Your score indicates higher risk or impact.',
          minScore: 50,
        },
      ],
    }),
  },
  {
    key: 'lead',
    label: 'Lead Capture',
    schema: createSchema({
      title: 'Lead Capture',
      description: 'Collect quick lead details.',
      questions: [
        { id: 1, text: 'Would you like a demo?', weight: 0, category: 'Lead' },
      ],
    }),
  },
];

const questionTypeTemplates = [
  { key: 'yesno', label: 'Yes/No', questionText: 'Yes/No question', category: 'Yes/No' },
  {
    key: 'mc',
    label: 'Multiple Choice',
    questionText: 'Multiple choice question',
    category: 'Multiple Choice',
  },
  { key: 'short', label: 'Short Text', questionText: 'Short answer question', category: 'Short Text' },
  { key: 'long', label: 'Long Text', questionText: 'Long answer question', category: 'Long Text' },
  { key: 'email', label: 'Email', questionText: 'Email address', category: 'Email' },
  { key: 'number', label: 'Number', questionText: 'Number question', category: 'Number' },
  { key: 'date', label: 'Date', questionText: 'Date question', category: 'Date' },
];

const Forms: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [funnelStats, setFunnelStats] = useState<Record<string, FunnelStats>>({});
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [npub, setNpub] = useState<string | null>(null);
  const [workspacesOpen, setWorkspacesOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [meResponse, workspacesResponse] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/workspaces', { credentials: 'include' }),
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
        if (!workspacesResponse.ok) {
          throw new Error('Failed to load workspaces.');
        }
        const workspaceData = (await workspacesResponse.json()) as { workspaces?: WorkspaceItem[] };
        if (isMounted) {
          const list = workspaceData.workspaces ?? [];
          setWorkspaces(list);
          const storedWorkspaceId = localStorage.getItem('outform.activeWorkspaceId');
          const fallbackId = list[0]?.id ?? null;
          const nextId = storedWorkspaceId && workspaceData.workspaces?.some((w) => w.id === storedWorkspaceId)
            ? storedWorkspaceId
            : fallbackId;
          setActiveWorkspaceId(nextId);
          if (nextId) {
            localStorage.setItem('outform.activeWorkspaceId', nextId);
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

  const createForm = async (schema: FormSchemaV0, title: string) => {
    setCreating(true);
    try {
      if (!activeWorkspaceId) {
        throw new Error('Select a workspace first.');
      }
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          schema: {
            ...schema,
            title,
          },
          workspaceId: activeWorkspaceId,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create form.');
      }
      const data = (await response.json()) as { id?: string };
      if (data.id) {
        setModalOpen(false);
        navigate(`/forms/${data.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create form.');
    } finally {
      setCreating(false);
    }
  };

  const avatarLabel = pubkey ? pubkey.slice(0, 2).toUpperCase() : 'OF';
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const workspaceLabel = activeWorkspace?.name ?? 'Workspace';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">
            OS
          </div>
          <div className="text-sm font-medium text-gray-700">{workspaceLabel}</div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="h-9 w-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-semibold">
                {avatarLabel}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={8}
                align="end"
                className="w-64 rounded-xl bg-white p-4 shadow-xl border border-gray-100"
              >
                <div className="text-sm font-semibold text-gray-800">Profile</div>
                <div className="text-xs text-gray-500 mt-1 break-all">
                  {npub ?? (pubkey ? `${pubkey.slice(0, 12)}…` : 'Unknown user')}
                </div>
                {activeWorkspace && (
                  <div className="text-xs text-gray-400 mt-3">
                    Workspace: <span className="text-gray-600">{activeWorkspace.name}</span>
                  </div>
                )}
                <button
                  className="mt-4 w-full text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-2"
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
              <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="w-full h-[30px] text-[12px] leading-none flex items-center justify-center rounded-xl border bg-[#177767] border-[#177767] text-white transition hover:bg-[#146957] hover:border-[#146957]"
                  >
                    + Create a new form
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-7 shadow-2xl focus:outline-none">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <Dialog.Title className="text-2xl font-semibold text-gray-900">
                          Create new form
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-gray-500 mt-1">
                          Pick a template or question type.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-full border border-gray-200">
                        Close
                      </Dialog.Close>
                    </div>

                    <div className="space-y-7">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
                          Templates
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {templateSchemas.map((template) => (
                            <button
                              key={template.key}
                              type="button"
                              className="of-card p-4 text-left hover:border-primary/60 hover:shadow-md transition"
                              onClick={() => createForm(template.schema, template.schema.title)}
                              disabled={creating}
                            >
                              <div className="text-sm font-medium text-gray-800">{template.label}</div>
                              <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                Start with {template.label.toLowerCase()}.
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
                          Question types
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {questionTypeTemplates.map((template) => (
                            <button
                              key={template.key}
                              type="button"
                              className="of-card p-3 text-left hover:border-primary/60 hover:shadow-md transition"
                              onClick={() =>
                                createForm(
                                  createSchema({
                                    title: template.label,
                                    questions: [
                                      {
                                        id: 1,
                                        text: template.questionText,
                                        weight: 0,
                                        category: template.category,
                                      },
                                    ],
                                  }),
                                  template.label
                                )
                              }
                              disabled={creating}
                            >
                              <div className="text-sm font-medium text-gray-800">{template.label}</div>
                              <div className="text-xs text-gray-500 mt-1">Add a starter question.</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {creating && <div className="text-sm text-gray-500">Creating form...</div>}
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Workspaces</span>
                  </div>
                  <Dialog.Root open={workspaceModalOpen} onOpenChange={setWorkspaceModalOpen}>
                    <Dialog.Trigger asChild>
                      <button className="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center">
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
                          <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-full border border-gray-200">
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
                                if (!trimmed) return;
                                const response = await fetch('/api/workspaces', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: trimmed }),
                                });
                                if (!response.ok) return;
                                const data = (await response.json()) as { id?: string };
                                if (data.id) {
                                  const newWorkspace: WorkspaceItem = {
                                    id: data.id,
                                    name: trimmed,
                                    created_at: Date.now(),
                                    updated_at: Date.now(),
                                  };
                                  setWorkspaces((prev) => [...prev, newWorkspace]);
                                  setActiveWorkspaceId(data.id);
                                  localStorage.setItem('outform.activeWorkspaceId', data.id);
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
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
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
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      workspace.id === activeWorkspaceId
                        ? 'text-gray-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    style={workspace.id === activeWorkspaceId ? { backgroundColor: '#ededee' } : undefined}
                      onClick={() => {
                        setActiveWorkspaceId(workspace.id);
                        localStorage.setItem('outform.activeWorkspaceId', workspace.id);
                      }}
                    >
                      <span>{workspace.name}</span>
                    </button>
                  ))}
              </div>

            </aside>

            <main className="flex-1 flex flex-col">
              <div className="px-6 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">{workspaceLabel}</h2>
                    <button className="text-gray-400 hover:text-gray-600">···</button>
                    <button className="text-xs text-gray-600 border border-gray-200 rounded-full px-3 py-1">
                      Invite
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="text-xs text-gray-600 border border-gray-200 rounded-md px-3 py-1">
                      Date created
                    </button>
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

                  <div className="grid grid-cols-[1fr_120px_120px_140px_80px] text-xs text-gray-400 px-6 py-2">
                    <div>Forms</div>
                    <div>Responses</div>
                    <div>Completion</div>
                    <div>Updated</div>
                    <div className="text-right">Actions</div>
                  </div>

                  {loading && <div className="text-gray-500 px-6 py-6">Loading...</div>}
                  {error && <div className="text-red-600 px-6 py-6">{error}</div>}

                  {!loading && !error && (
                    <div className="space-y-3 px-6 pb-6">
                      {filteredForms.length === 0 && (
                        <div className="text-gray-500 px-2 py-6">No forms found.</div>
                      )}
                      {filteredForms.map((form) => {
                        const funnel = funnelStats[form.id];
                        const completionRate = funnel?.totalStarts
                          ? Math.round((funnel.completions / funnel.totalStarts) * 100)
                          : 0;
                        return (
                          <div
                            key={form.id}
                            className="bg-white border border-gray-200 rounded-xl px-4 py-3 grid grid-cols-[1fr_120px_120px_140px_80px] items-center hover:border-primary/40 hover:shadow-sm transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-emerald-700/80 text-white text-xs font-semibold flex items-center justify-center">
                                OF
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">{form.title}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span
                                    className={`of-badge ${
                                      form.published
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {form.published ? 'Published' : 'Draft'}
                                  </span>
                                  <span className="of-pill">{form.responses_count ?? 0} responses</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">{form.responses_count ?? 0}</div>
                            <div className="text-sm text-gray-600">{completionRate}%</div>
                            <div className="text-sm text-gray-600">
                              {new Date(form.updated_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center justify-end gap-3 text-sm">
                              <Link
                                to={`/forms/${form.id}/edit`}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Edit
                              </Link>
                              <Link
                                to={`/forms/${form.id}/analytics`}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Analytics
                              </Link>
                              <Link
                                to={`/f/${form.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Share
                              </Link>
                              <button className="text-gray-400 hover:text-gray-600">···</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {!loading && !error && !activeWorkspaceId && (
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
                      className="mt-4 inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:border-gray-300"
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
    </div>
  );
};

export default Forms;
