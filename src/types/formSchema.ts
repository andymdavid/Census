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
  kind?: 'welcome' | 'end' | 'group' | 'details' | 'yesno' | 'multiple' | 'short' | 'long' | 'email' | 'number' | 'date';
  answerType?: 'multiple' | 'yesno' | 'short' | 'long' | 'email' | 'number' | 'date';
  choices?: string[];
  choiceKeyStyle?: 'letters' | 'numbers';
  description?: string;
  required?: boolean;
  multipleSelection?: boolean;
  otherOption?: boolean;
  verticalAlignment?: 'left' | 'center';
  mediaType?: 'image' | 'video';
  mediaSize?: 'xsmall' | 'small' | 'medium' | 'large';
  mediaPosition?: 'above' | 'below';
  showTimeToComplete?: boolean;
  showSubmissionCount?: boolean;
  footerText?: string;
  buttonLabel?: string;
  mediaUrl?: string;
  maxCharactersEnabled?: boolean;
  maxCharacters?: number;
  longTextFormat?: 'paragraph' | 'steps' | 'numbered';
  dateFormat?: 'MMDDYYYY' | 'DDMMYYYY' | 'YYYYMMDD';
  dateSeparator?: '/' | '-' | '.';
  minNumberEnabled?: boolean;
  minNumber?: number;
  maxNumberEnabled?: boolean;
  maxNumber?: number;
  numberUnitChoices?: string[];
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

export interface FormRepeatLoop {
  id: string;
  label: string;
  pluralLabel?: string;
  startQuestionId: number;
  endQuestionId: number;
  exitQuestionId?: number;
  titleQuestionId?: number;
  addAnotherLabel?: string;
  continueLabel?: string;
  minRepeats?: number;
  maxRepeats?: number;
}

export interface FormSchemaV0 {
  version: 'v0';
  id: string;
  title: string;
  description?: string;
  scoringEnabled?: boolean;
  questions: FormQuestion[];
  repeatLoops?: FormRepeatLoop[];
  results: FormResultThreshold[];
  theme?: FormTheme;
}

export type LoadedFormSchema = FormSchemaV0 & {
  totalScore: number;
};
