import aiDisruptionForm from './forms/ai-disruption.json';
import { FormSchemaV0, LoadedFormSchema } from '../types/formSchema';

const toLoadedForm = (form: FormSchemaV0): LoadedFormSchema => {
  const totalScore = form.questions.reduce((sum, question) => sum + question.weight, 0);
  return { ...form, totalScore };
};

export const loadForm = (): LoadedFormSchema => {
  // TODO: Fetch schema from API instead of local JSON once backend wiring is ready.
  const form = aiDisruptionForm as FormSchemaV0;
  return toLoadedForm(form);
};

export const loadFormFromApi = async (
  id: string,
  options?: { publicOnly?: boolean }
): Promise<FormSchemaV0 | null> => {
  try {
    const path = options?.publicOnly ? `/api/forms/${id}/public` : `/api/forms/${id}`;
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { schema?: FormSchemaV0 };
    return data.schema ?? null;
  } catch {
    return null;
  }
};

export const loadFormWithFallback = async (
  id: string,
  publicOnly = false
): Promise<LoadedFormSchema> => {
  const apiForm = await loadFormFromApi(id, { publicOnly });
  if (apiForm) {
    return toLoadedForm(apiForm);
  }

  return loadForm();
};

export const loadRequiredFormFromApi = async (
  id: string,
  options?: { publicOnly?: boolean }
): Promise<LoadedFormSchema | null> => {
  const apiForm = await loadFormFromApi(id, options);
  if (!apiForm) {
    return null;
  }

  return toLoadedForm(apiForm);
};
