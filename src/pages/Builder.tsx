import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const Builder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [schemaText, setSchemaText] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const parsedSchema = useMemo(() => {
    try {
      return schemaText ? JSON.parse(schemaText) : null;
    } catch {
      return null;
    }
  }, [schemaText]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (isNew || !id) {
        return;
      }

      try {
        const response = await fetch(`/api/forms/${id}`);
        if (!response.ok) {
          throw new Error('Failed to load form.');
        }
        const data = (await response.json()) as { title?: string; schema?: unknown };
        if (isMounted) {
          setTitle(data.title ?? '');
          setSchemaText(JSON.stringify(data.schema ?? {}, null, 2));
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setStatus('error');
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [id, isNew]);

  const handleSave = async () => {
    setStatus('saving');
    setError(null);

    if (!title.trim()) {
      setStatus('error');
      setError('Title is required.');
      return;
    }

    if (!schemaText.trim()) {
      setStatus('error');
      setError('Schema JSON is required.');
      return;
    }

    if (!parsedSchema) {
      setStatus('error');
      setError('Schema JSON is invalid.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        schema: parsedSchema,
      };

      if (isNew) {
        const response = await fetch('/api/forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to create form.');
        }

        const data = (await response.json()) as { id?: string };
        if (data.id) {
          navigate(`/forms/${data.id}/edit`);
        }
      } else if (id) {
        const response = await fetch(`/api/forms/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to update form.');
        }
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="typeform-fullscreen">
      <div className="typeform-content">
        <div className="flex flex-col items-center w-full">
          <div className="text-sm text-gray-400 mb-4 font-medium">Builder</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            {isNew ? 'Create Form' : 'Edit Form'}
          </h2>

          <div className="w-full max-w-3xl">
            <div className="mb-6">
              <label htmlFor="title" className="block text-sm font-medium text-gray-600 mb-2">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="schema" className="block text-sm font-medium text-gray-600 mb-2">
                Schema JSON
              </label>
              <textarea
                id="schema"
                value={schemaText}
                onChange={(event) => setSchemaText(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                rows={14}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                className="typeform-button"
                disabled={status === 'saving'}
              >
                {status === 'saving' ? 'Saving...' : 'Save'}
              </button>
              {status === 'success' && (
                <span className="text-sm text-green-600">Saved.</span>
              )}
              {status === 'error' && error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builder;
