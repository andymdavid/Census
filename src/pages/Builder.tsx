import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FormBuilder from '../components/FormBuilder';
import type { FormSchemaV0 } from '../types/formSchema';

const emptySchema: FormSchemaV0 = {
  version: 'v0',
  id: 'new-form',
  title: '',
  description: '',
  questions: [],
  results: [],
};

const validateSchema = (schema: FormSchemaV0) => {
  const errors: string[] = [];
  const ids = schema.questions.map((question) => question.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push('Question IDs must be unique.');
  }
  schema.questions.forEach((question) => {
    if (!question.text.trim()) {
      errors.push(`Question ${question.id} is missing text.`);
    }
    if (!Number.isFinite(question.weight)) {
      errors.push(`Question ${question.id} has an invalid weight.`);
    }
    const branching = question.branching;
    if (branching?.next !== undefined && !uniqueIds.has(branching.next)) {
      errors.push(`Question ${question.id} has an invalid default next target.`);
    }
    branching?.conditions?.forEach((condition, index) => {
      if (!uniqueIds.has(condition.next)) {
        errors.push(`Question ${question.id} condition ${index + 1} has an invalid next target.`);
      }
    });
  });

  schema.results.forEach((result, index) => {
    if (!result.label.trim()) {
      errors.push(`Result ${index + 1} is missing a label.`);
    }
    if (!result.description.trim()) {
      errors.push(`Result ${index + 1} is missing a description.`);
    }
    if (
      result.minScore !== undefined &&
      result.maxScore !== undefined &&
      result.minScore > result.maxScore
    ) {
      errors.push(`Result ${index + 1} has min score greater than max score.`);
    }
  });

  return errors;
};

const Builder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [schema, setSchema] = useState<FormSchemaV0>(emptySchema);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const validationErrors = useMemo(() => validateSchema(schema), [schema]);
  const jsonPreview = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

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
        const data = (await response.json()) as {
          title?: string;
          schema?: FormSchemaV0;
          published?: number;
        };
        if (isMounted) {
          setTitle(data.title ?? '');
          setSchema(data.schema ?? emptySchema);
          setPublished(data.published === 1);
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

    if (validationErrors.length > 0) {
      setStatus('error');
      setError('Fix schema errors before saving.');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        schema: {
          ...schema,
          title: title.trim(),
        },
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

  const handlePublish = async () => {
    if (!id || isNew) return;
    setStatus('saving');
    setError(null);

    try {
      const response = await fetch(`/api/forms/${id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to publish form.');
      }
      setPublished(true);
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

          <div className="w-full max-w-4xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Status: {published ? 'Published' : 'Draft'}
              </div>
              <button
                type="button"
                onClick={handlePublish}
                className="text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-400"
                disabled={isNew || published || status === 'saving'}
              >
                {published ? 'Published' : 'Publish'}
              </button>
            </div>

            <div className="mb-6">
              <label htmlFor="title" className="block text-sm font-medium text-gray-600 mb-2">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSchema((prev) => ({ ...prev, title: event.target.value }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <FormBuilder schema={schema} onChange={setSchema} />

            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                className="typeform-button"
                disabled={status === 'saving'}
              >
                {status === 'saving' ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowJson((prev) => !prev)}
                className="text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                {showJson ? 'Hide JSON' : 'Show JSON'}
              </button>
              {status === 'success' && (
                <span className="text-sm text-green-600">Saved.</span>
              )}
              {status === 'error' && error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
            </div>

            {validationErrors.length > 0 && (
              <div className="mt-4 text-sm text-red-600 space-y-1">
                {validationErrors.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </div>
            )}

            {showJson && (
              <pre className="mt-6 text-xs bg-gray-900 text-gray-100 rounded-md p-4 overflow-auto">
{jsonPreview}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builder;
