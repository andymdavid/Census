export interface FormBranchCondition {
  when: {
    answer: boolean;
  };
  next: number;
}

export interface FormBranching {
  next?: number;
  conditions?: FormBranchCondition[];
}

export interface FormQuestion {
  id: number;
  text: string;
  weight: number;
  category: string;
  branching?: FormBranching;
}

export interface FormResultThreshold {
  label: string;
  description: string;
  minScore?: number;
  maxScore?: number;
}

export interface FormTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  logoUrl?: string;
}

export interface FormSchemaV0 {
  version: 'v0';
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
  results: FormResultThreshold[];
  theme?: FormTheme;
}

export type LoadedFormSchema = FormSchemaV0 & {
  totalScore: number;
};
