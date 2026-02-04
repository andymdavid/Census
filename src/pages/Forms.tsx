import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  { key: 'mc', label: 'Multiple Choice', questionText: 'Multiple choice question', category: 'Multiple Choice' },
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
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

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
        setShowModal(false);
        navigate(`/forms/${data.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create form.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-72 border-r border-gray-200 p-6 flex flex-col gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Workspace</div>
          <div className="text-xl font-semibold text-gray-800">My workspace</div>
        </div>
        <button
          type="button"
          className="typeform-button"
          onClick={() => setShowModal(true)}
        >
          Create new form
        </button>
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
      </aside>

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-gray-400">Forms</div>
            <h2 className="text-2xl font-semibold text-gray-800">My forms</h2>
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
                className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="text-lg font-medium text-gray-800">{form.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Updated {new Date(form.updated_at).toLocaleDateString()} ·{' '}
                    {form.published ? 'Published' : 'Draft'} ·{' '}
                    {form.responses_count ?? 0} responses
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">Create new form</h3>
                <p className="text-sm text-gray-500">Pick a template or question type.</p>
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-600 mb-3">Templates</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {templateSchemas.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    className="border border-gray-200 rounded-md p-4 text-left hover:border-primary transition"
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
                    className="border border-gray-200 rounded-md p-3 text-left hover:border-primary transition"
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
        </div>
      )}
    </div>
  );
};

export default Forms;
