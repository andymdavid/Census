import aiDisruptionForm from './forms/ai-disruption.json';
import { FormSchemaV0, LoadedFormSchema } from '../types/formSchema';

export const loadForm = (): LoadedFormSchema => {
  const form = aiDisruptionForm as FormSchemaV0;
  const totalScore = form.questions.reduce((sum, question) => sum + question.weight, 0);

  return {
    ...form,
    totalScore
  };
};
