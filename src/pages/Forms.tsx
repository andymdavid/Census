import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface FormListItem {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  published: number;
}

const Forms: React.FC = () => {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="typeform-fullscreen">
      <div className="typeform-content">
        <div className="flex flex-col items-center w-full">
          <div className="text-sm text-gray-400 mb-4 font-medium">Forms</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Form Builder</h2>

          <div className="w-full max-w-2xl mb-6 flex justify-end">
            <Link to="/forms/new/edit" className="typeform-button">
              New Form
            </Link>
          </div>

          {loading && <div className="text-gray-500">Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {!loading && !error && (
            <div className="w-full max-w-2xl space-y-3">
              {forms.length === 0 && (
                <div className="text-gray-500 text-center">No forms yet.</div>
              )}
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="border border-gray-200 rounded-md p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-800">{form.title}</div>
                    <div className="text-xs text-gray-500">
                      Updated {new Date(form.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Link
                    to={`/forms/${form.id}/edit`}
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Forms;
