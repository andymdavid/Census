import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Questions from './Questions';
import { loadFormWithFallback } from '../data/loadForm';
import type { LoadedFormSchema } from '../types/formSchema';

const PublicForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<LoadedFormSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!id) {
        setError('Missing form id.');
        return;
      }

      const loaded = await loadFormWithFallback(id, true);
      if (isMounted) {
        setForm(loaded);
      }
    };

    load().catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Unable to load form.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="typeform-fullscreen">
        <div className="typeform-content">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="typeform-fullscreen">
        <div className="typeform-content">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return <Questions form={form} formId={id} />;
};

export default PublicForm;
