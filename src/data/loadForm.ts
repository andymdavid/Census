import aiDisruptionForm from './forms/ai-disruption.json';
import { FormSchema, LoadedFormSchema } from './formSchema';

export const loadForm = (): LoadedFormSchema => {
  const form = aiDisruptionForm as FormSchema;
  const totalScore = form.questions.reduce((sum, question) => sum + question.weight, 0);

  return {
    ...form,
    totalScore
  };
};
