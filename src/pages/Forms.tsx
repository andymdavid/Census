import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import type { FormSchemaV0 } from '../types/formSchema';

interface FormListItem {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  published: number;
  responses_count?: number;
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

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch('/api/forms');
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

  const filteredForms = useMemo(() => {
    if (!query.trim()) return forms;
    const lowered = query.toLowerCase();
    return forms.filter((form) => form.title.toLowerCase().includes(lowered));
  }, [forms, query]);

  const createForm = async (schema: FormSchemaV0, title: string) => {
    setCreating(true);
    try {
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-72 border-r border-gray-200 bg-white p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
            OF
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Workspace</div>
            <div className="text-lg font-semibold text-gray-800">Other Stuff</div>
          </div>
        </div>

        <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="typeform-button w-full">
              Create new form
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg focus:outline-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Dialog.Title className="text-xl font-semibold text-gray-800">
                    Create new form
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-gray-500">
                    Pick a template or question type.
                  </Dialog.Description>
                </div>
                <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800">
                  Close
                </Dialog.Close>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-3">Templates</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {templateSchemas.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        className="of-card p-4 text-left hover:border-primary transition"
                        onClick={() => createForm(template.schema, template.schema.title)}
                        disabled={creating}
                      >
                        <div className="text-sm font-medium text-gray-800">{template.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Start with {template.label.toLowerCase()}.
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 mb-3">Question types</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {questionTypeTemplates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        className="of-card p-3 text-left hover:border-primary transition"
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

        <div>
          <label htmlFor="search" className="block text-xs text-gray-400 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            placeholder="Search forms"
          />
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
          Single workspace · 1 member
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Forms</div>
            <h2 className="of-heading">My forms</h2>
          </div>
        </div>

        {loading && <div className="text-gray-500">Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="space-y-3">
            {filteredForms.length === 0 && (
              <div className="text-gray-500">No forms found.</div>
            )}
            {filteredForms.map((form) => (
              <div
                key={form.id}
                className="of-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-primary/40 hover:shadow-md transition"
              >
                <div>
                  <div className="text-lg font-medium text-gray-800">{form.title}</div>
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
                    <span>Updated {new Date(form.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Link
                    to={`/forms/${form.id}/edit`}
                    className="text-primary font-medium hover:text-primary/80"
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
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Forms;
