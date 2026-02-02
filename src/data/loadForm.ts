import aiDisruptionForm from './forms/ai-disruption.json';
import { FormSchemaV0, LoadedFormSchema } from '../types/formSchema';

export const loadForm = (): LoadedFormSchema => {
  // TODO: Fetch schema from API instead of local JSON once backend wiring is ready.
  const form = aiDisruptionForm as FormSchemaV0;
  const totalScore = form.questions.reduce((sum, question) => sum + question.weight, 0);

  return {
    ...form,
    totalScore
  };
};

export const loadFormFromApi = async (id: string): Promise<FormSchemaV0 | null> => {
  try {
    const response = await fetch(`/api/forms/${id}`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { schema?: FormSchemaV0 };
    return data.schema ?? null;
  } catch {
    return null;
  }
};

export const loadFormWithFallback = async (id: string): Promise<LoadedFormSchema> => {
  const apiForm = await loadFormFromApi(id);
  if (apiForm) {
    const totalScore = apiForm.questions.reduce((sum, question) => sum + question.weight, 0);
    return { ...apiForm, totalScore };
  }

  return loadForm();
};
