export type FormBranchOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'not_empty';

export interface FormBranchCondition {
  when: {
    answer?: boolean;
    operator?: FormBranchOperator;
    value?: string | number | boolean;
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
  settings?: FormQuestionSettings;
}

export interface FormQuestionSettings {
  kind?: 'welcome' | 'end' | 'group' | 'yesno' | 'multiple' | 'short' | 'long' | 'email' | 'number' | 'date';
  answerType?: 'multiple' | 'yesno' | 'short' | 'long' | 'email' | 'number' | 'date';
  choices?: string[];
  description?: string;
  required?: boolean;
  multipleSelection?: boolean;
  otherOption?: boolean;
  verticalAlignment?: 'left' | 'center';
  mediaType?: 'image' | 'video';
  showTimeToComplete?: boolean;
  showSubmissionCount?: boolean;
  buttonLabel?: string;
  mediaUrl?: string;
  maxCharactersEnabled?: boolean;
  maxCharacters?: number;
  dateFormat?: 'MMDDYYYY' | 'DDMMYYYY' | 'YYYYMMDD';
  dateSeparator?: '/' | '-' | '.';
  minNumberEnabled?: boolean;
  minNumber?: number;
  maxNumberEnabled?: boolean;
  maxNumber?: number;
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
