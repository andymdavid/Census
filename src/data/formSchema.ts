export interface FormQuestion {
  id: number;
  text: string;
  weight: number;
  category: string;
}

export interface FormResultThreshold {
  label: string;
  description: string;
  minScore?: number;
  maxScore?: number;
}

export interface FormSchema {
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
  results: FormResultThreshold[];
}

export type LoadedFormSchema = FormSchema & {
  totalScore: number;
};
