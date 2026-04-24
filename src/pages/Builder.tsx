import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Questions from './Questions';
import type {
  FormBranchCondition,
  FormBranchOperator,
  FormQuestion,
  FormQuestionSettings,
  FormSchemaV0,
} from '../types/formSchema';
import type { LoadedFormSchema } from '../types/formSchema';
import * as Tabs from '@radix-ui/react-tabs';
import * as Switch from '@radix-ui/react-switch';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  FormInput,
  GripVertical,
  ListChecks,
  Mail,
  MessageSquareText,
  MoreVertical,
  Palette,
  Text,
  TextCursorInput,
  ToggleLeft,
  Trash2,
  X,
} from 'lucide-react';
import { validateFormSchema } from '../../shared/formValidation';
import {
  getTotalScore,
  inferQuestionAnswerType,
  isAnswerableQuestion,
  isFlowQuestion,
  isScoringEnabled,
} from '../../shared/formFlow';

const defaultTheme = {
  primaryColor: '#4f46e5',
  backgroundColor: '#f5f6fa',
  textColor: '#1f2937',
  fontFamily: 'Inter, sans-serif',
  logoUrl: '',
};

const emptySchema: FormSchemaV0 = {
  version: 'v0',
  id: 'new-form',
  title: '',
  description: '',
  scoringEnabled: false,
  questions: [],
  results: [],
  theme: defaultTheme,
};

const baseResults = [
  {
    label: 'Low',
    description: 'Low risk or low score.',
    maxScore: 50,
  },
  {
    label: 'High',
    description: 'High risk or high score.',
    minScore: 50,
  },
];

const createSchema = (overrides: Partial<FormSchemaV0> = {}): FormSchemaV0 => {
  return {
    version: 'v0',
    id: 'new-form',
    title: overrides.title ?? 'Untitled Form',
    description: overrides.description ?? '',
    scoringEnabled: overrides.scoringEnabled ?? false,
    questions: overrides.questions ?? [],
    results: overrides.results ?? [],
    theme: overrides.theme ?? defaultTheme,
  };
};

const templateSchemas = [
  {
    key: 'blank',
    label: 'Blank Form',
    schema: createSchema({ title: 'Blank Form' }),
    icon: FormInput,
    iconClass: 'bg-blue-100 text-blue-600',
  },
  {
    key: 'assessment',
    label: 'Assessment',
    schema: createSchema({
      title: 'Assessment',
      description: 'Answer a few quick questions to get your score.',
      scoringEnabled: true,
      questions: [
        { id: 1, text: 'Is this a yes/no assessment question?', weight: 10, category: 'Assessment' },
      ],
      results: [
        {
          label: 'Low Score',
          description: 'Your score indicates low risk or impact.',
          maxScore: 50,
        },
        {
          label: 'High Score',
          description: 'Your score indicates higher risk or impact.',
          minScore: 50,
        },
      ],
    }),
    icon: ListChecks,
    iconClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    key: 'lead',
    label: 'Lead Capture',
    schema: createSchema({
      title: 'Lead Capture',
      description: 'Collect quick lead details.',
      scoringEnabled: false,
      questions: [
        { id: 1, text: 'Would you like a demo?', weight: 0, category: 'Lead' },
      ],
    }),
    icon: Mail,
    iconClass: 'bg-amber-100 text-amber-600',
  },
];

const questionTypeTemplates = [
  {
    key: 'yesno',
    label: 'Yes/No',
    questionText: 'Yes/No question',
    category: 'Yes/No',
    icon: ToggleLeft,
    iconClass: 'bg-violet-100 text-violet-600',
  },
  {
    key: 'mc',
    label: 'Multiple Choice',
    questionText: 'Multiple choice question',
    category: 'Multiple Choice',
    icon: ListChecks,
    iconClass: 'bg-indigo-100 text-indigo-600',
  },
  {
    key: 'numberedChoice',
    label: 'Numbered Choice',
    questionText: 'Numbered choice question',
    category: 'Multiple Choice',
    icon: ListChecks,
    iconClass: 'bg-cyan-100 text-cyan-700',
  },
  {
    key: 'long',
    label: 'Text',
    questionText: 'Text question',
    category: 'Text',
    icon: MessageSquareText,
    iconClass: 'bg-slate-100 text-slate-600',
  },
  {
    key: 'email',
    label: 'Email',
    questionText: 'Email address',
    category: 'Email',
    icon: Mail,
    iconClass: 'bg-rose-100 text-rose-600',
  },
  {
    key: 'number',
    label: 'Number',
    questionText: 'Number question',
    category: 'Number',
    icon: Text,
    iconClass: 'bg-orange-100 text-orange-600',
  },
  {
    key: 'date',
    label: 'Date',
    questionText: 'Date question',
    category: 'Date',
    icon: CalendarIcon,
    iconClass: 'bg-green-100 text-green-600',
  },
  {
    key: 'welcome',
    label: 'Welcome Screen',
    questionText: 'Welcome to the form',
    category: 'Welcome Screen',
    icon: CheckCircle,
    iconClass: 'bg-teal-100 text-teal-600',
  },
  {
    key: 'end',
    label: 'End Screen',
    questionText: 'Thanks for completing the form',
    category: 'End Screen',
    icon: Palette,
    iconClass: 'bg-purple-100 text-purple-600',
  },
  {
    key: 'group',
    label: 'Question Group',
    questionText: 'Section title',
    category: 'Question Group',
    icon: FormInput,
    iconClass: 'bg-sky-100 text-sky-600',
  },
  {
    key: 'details',
    label: 'Details Screen',
    questionText: 'Important details',
    category: 'Details Screen',
    icon: TextCursorInput,
    iconClass: 'bg-stone-100 text-stone-700',
  },
];

const getTemplateQuestionKind = (
  key: (typeof questionTypeTemplates)[number]['key']
): FormQuestionSettings['kind'] => {
  if (key === 'welcome') return 'welcome';
  if (key === 'end') return 'end';
  if (key === 'group') return 'group';
  if (key === 'details') return 'details';
  if (key === 'yesno') return 'yesno';
  if (key === 'mc' || key === 'numberedChoice') return 'multiple';
  if (key === 'long') return 'long';
  if (key === 'email') return 'email';
  if (key === 'number') return 'number';
  if (key === 'date') return 'date';
  return undefined;
};

const getTemplateAnswerType = (
  key: (typeof questionTypeTemplates)[number]['key']
): NonNullable<FormQuestionSettings['answerType']> => {
  if (key === 'mc' || key === 'numberedChoice') return 'multiple';
  if (key === 'yesno') return 'yesno';
  if (key === 'long') return 'long';
  if (key === 'email') return 'email';
  if (key === 'number') return 'number';
  if (key === 'date') return 'date';
  return 'short';
};

const getCategoryForAnswerType = (
  answerType: NonNullable<FormQuestionSettings['answerType']>
) => {
  if (answerType === 'multiple') return 'Multiple Choice';
  if (answerType === 'yesno') return 'Yes/No';
  if (answerType === 'long' || answerType === 'short') return 'Text';
  if (answerType === 'email') return 'Email';
  if (answerType === 'number') return 'Number';
  if (answerType === 'date') return 'Date';
  return 'General';
};

const answerTypeCategories = new Set([
  'General',
  'Multiple Choice',
  'Yes/No',
  'Text',
  'Short Text',
  'Email',
  'Number',
  'Date',
]);

const normalizeSchemaQuestionCategories = (schema: FormSchemaV0): FormSchemaV0 => ({
  ...schema,
  questions: schema.questions.map((question) => {
    if (
      question.settings?.kind === 'welcome' ||
      question.settings?.kind === 'end' ||
      question.settings?.kind === 'group' ||
      question.settings?.kind === 'details' ||
      !answerTypeCategories.has(question.category)
    ) {
      return question;
    }

    const answerType = inferQuestionAnswerType(question);
    return {
      ...question,
      category: getCategoryForAnswerType(answerType),
    };
  }),
});

const getQuestionDisplayLabel = (question: FormQuestion, index: number) => {
  const displayNumber = index + 1;
  if (question.category === 'Welcome Screen') return `${displayNumber}. Start screen`;
  if (question.category === 'End Screen') return `${displayNumber}. End screen`;
  if (question.settings?.kind === 'details' || question.category === 'Details Screen') {
    return `${displayNumber}. Details screen`;
  }
  if (question.settings?.kind === 'group' || question.category === 'Question Group') {
    return `${displayNumber}. Section screen`;
  }
  return `${displayNumber}. Question`;
};

const getNumberScaleOptions = (settings: FormQuestionSettings) => {
  if (!settings.minNumberEnabled || !settings.maxNumberEnabled) return [];
  const min = settings.minNumber;
  const max = settings.maxNumber;
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min === undefined ||
    max === undefined ||
    min > max ||
    max - min > 19
  ) {
    return [];
  }
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
};

const getNumberScaleLabel = (
  settings: FormQuestionSettings,
  option: number,
  index: number
) => {
  const label = settings.choices?.[index]?.trim();
  return label || String(option);
};

const getNumberUnitChoices = (settings: FormQuestionSettings) => {
  return (settings.numberUnitChoices ?? []).map((unit) => unit.trim()).filter(Boolean);
};

const getChoiceKey = (
  index: number,
  style: FormQuestionSettings['choiceKeyStyle'] = 'letters'
) => {
  return style === 'numbers' ? String(index + 1) : String.fromCharCode(65 + index);
};

const getBranchSelectionOptions = (question: FormQuestion) => {
  const answerType = inferQuestionAnswerType(question);
  if (answerType === 'multiple') {
    return [
      ...(question.settings?.choices ?? []),
      ...(question.settings?.otherOption ? ['Other'] : []),
    ];
  }

  if (answerType === 'number') {
    return getNumberScaleOptions(question.settings ?? {}).map(String);
  }

  return [];
};

const getBranchSelectionOperator = (question: FormQuestion): FormBranchOperator => {
  return question.settings?.multipleSelection ? 'contains' : 'equals';
};

const getNextId = (schema: FormSchemaV0, id: number) => {
  const index = schema.questions.findIndex((question) => question.id === id);
  if (index === -1) return schema.questions[0]?.id ?? id;
  return schema.questions[index + 1]?.id ?? schema.questions[index]?.id ?? id;
};

interface AiPreviewData {
  model: string;
  repaired?: boolean;
  spec: {
    title: string;
    description?: string;
    steps: Array<{ stepRef: string; title: string; kind: string }>;
    assumptions?: Array<{ type: 'assumption' | 'ambiguity'; message: string }>;
  };
  schema: {
    title: string;
    description?: string;
    questions: Array<{ id: number; category: string; text: string }>;
    results: Array<{ label: string; description: string }>;
    theme?: Record<string, string>;
  };
}

interface ResponseReviewListItem {
  id: string;
  submittedAt: number;
  score: number;
  completed: boolean;
  answerCount: number;
  submitterName: string;
  submitterEmail: string | null;
}

interface ResponseReviewDetail {
  id: string;
  submittedAt: number;
  score: number;
  completed: boolean;
  submitterName: string;
  submitterEmail: string | null;
  sections: Array<{
    title: string;
    answers: Array<{
      questionId: number;
      question: string;
      answer: string;
    }>;
  }>;
}

type ResponseStatusFilter = 'completed' | 'in_progress' | 'all';

const areResponseReviewRowsEqual = (
  left: ResponseReviewListItem[],
  right: ResponseReviewListItem[]
) => {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      item.id === other.id &&
      item.submittedAt === other.submittedAt &&
      item.score === other.score &&
      item.completed === other.completed &&
      item.answerCount === other.answerCount &&
      item.submitterName === other.submitterName &&
      item.submitterEmail === other.submitterEmail
    );
  });
};

const getBranchOperatorOptions = (question: FormQuestion) => {
  const answerType = inferQuestionAnswerType(question);

  if (answerType === 'yesno') {
    return [];
  }

  if (answerType === 'number') {
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Does not equal' },
      { value: 'greater_than', label: 'Greater than' },
      { value: 'greater_than_or_equal', label: 'Greater than or equal' },
      { value: 'less_than', label: 'Less than' },
      { value: 'less_than_or_equal', label: 'Less than or equal' },
      { value: 'is_empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' },
    ] satisfies Array<{ value: FormBranchOperator; label: string }>;
  }

  if (answerType === 'multiple') {
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Does not equal' },
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does not contain' },
      { value: 'is_empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' },
    ] satisfies Array<{ value: FormBranchOperator; label: string }>;
  }

  return [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'not_empty', label: 'Is not empty' },
  ] satisfies Array<{ value: FormBranchOperator; label: string }>;
};

const createDefaultBranchCondition = (question: FormQuestion, nextId: number): FormBranchCondition => {
  const answerType = inferQuestionAnswerType(question);

  if (answerType === 'yesno') {
    return { when: { answer: true }, next: nextId };
  }

  const selectionOptions = getBranchSelectionOptions(question);
  if (selectionOptions.length > 0) {
    return {
      when: {
        operator: getBranchSelectionOperator(question),
        value: selectionOptions[0],
      },
      next: nextId,
    };
  }

  if (answerType === 'number') {
    return { when: { operator: 'equals', value: 0 }, next: nextId };
  }

  const firstChoice = question.settings?.choices?.[0] ?? '';
  return { when: { operator: 'equals', value: firstChoice }, next: nextId };
};

const conditionNeedsValue = (condition: FormBranchCondition) => {
  const operator = condition.when.operator;
  if (!operator) {
    return false;
  }

  return operator !== 'is_empty' && operator !== 'not_empty';
};

const Builder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id || id === 'new';
  const [templateModalOpen, setTemplateModalOpen] = useState(isNew);

  const [title, setTitle] = useState('');
  const [schema, setSchema] = useState<FormSchemaV0>(emptySchema);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [draggedQuestionId, setDraggedQuestionId] = useState<number | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    'form' | 'question' | 'branching' | 'loops' | 'theme' | 'results' | 'responses' | 'share'
  >('question');
  const [previewStep, setPreviewStep] = useState<'intro' | 'questions'>('intro');
  const [creating, setCreating] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreviewData | null>(null);
  const [aiFileName, setAiFileName] = useState<string | null>(null);

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const data = (await response.json()) as { error?: string; details?: string[] };
      if (Array.isArray(data.details) && data.details.length > 0) {
        return data.details[0];
      }
      if (data.error) {
        return data.error;
      }
    } catch {
      // ignore parse errors and use the fallback message
    }
    return fallback;
  };

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const publicLink = id ? `${origin}/f/${id}` : `${origin}/f/:id`;
  const inlineEmbed = `<iframe src="${publicLink}" style="width:100%;height:700px;border:0;" loading="lazy"></iframe>`;
  const fullscreenEmbed = `<iframe src="${publicLink}" style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;"></iframe>`;
  const embedScript = `<script src="${origin}/embed.js"></script>\n<div data-census data-form-id="${id ?? ':id'}" data-mode="inline" data-height="700px"></div>`;
  const embedScriptFullscreen = `<script src="${origin}/embed.js"></script>\n<div data-census data-form-id="${id ?? ':id'}" data-mode="fullscreen"></div>`;

  const validationErrors = useMemo(() => validateFormSchema(schema), [schema]);
  const scoringEnabled = isScoringEnabled(schema);
  const previewForm: LoadedFormSchema = useMemo(
    () => ({ ...schema, totalScore: getTotalScore(schema) }),
    [schema]
  );
  const questionToggleSettings: { label: string; key: keyof FormQuestionSettings }[] = [
    { label: 'Required', key: 'required' },
    { label: 'Multiple selection', key: 'multipleSelection' },
    { label: '"Other" option', key: 'otherOption' },
  ];
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  const questionTitleRef = useRef<HTMLTextAreaElement | null>(null);
  const questionTitleMeasureRef = useRef<HTMLSpanElement | null>(null);
  const questionTitleContainerRef = useRef<HTMLDivElement | null>(null);
  const [questionTitleWidth, setQuestionTitleWidth] = useState<number | null>(null);
  const [responseRows, setResponseRows] = useState<ResponseReviewListItem[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [selectedResponseDetail, setSelectedResponseDetail] = useState<ResponseReviewDetail | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [responsesRefreshKey, setResponsesRefreshKey] = useState(0);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);
  const [responseStatusFilter, setResponseStatusFilter] = useState<ResponseStatusFilter>('all');

  const selectedQuestion = schema.questions.find((question) => question.id === selectedQuestionId);
  const questionOptions = schema.questions.map((question, index) => ({
    id: question.id,
    label: getQuestionDisplayLabel(question, index),
  }));
  const resultOptions = schema.results;
  const isSelectedWelcome = selectedQuestion?.category === 'Welcome Screen';
  const isSelectedEnd = selectedQuestion?.category === 'End Screen';
  const isSelectedGroup = selectedQuestion?.category === 'Question Group';
  const isSelectedDetails = selectedQuestion?.settings?.kind === 'details' || selectedQuestion?.category === 'Details Screen';
  const flowQuestions = schema.questions.filter(isFlowQuestion);
  const selectedQuestionPosition = selectedQuestion
    ? flowQuestions.findIndex((question) => question.id === selectedQuestion.id) + 1
    : null;
  const selectedSettings = selectedQuestion?.settings ?? {};
  const inferredAnswerType = selectedQuestion ? inferQuestionAnswerType(selectedQuestion) : 'short';
  const groupQuestions = schema.questions.filter((question) => question.category === 'Question Group');
  const selectedGroupIndex = isSelectedGroup && selectedQuestion
    ? groupQuestions.findIndex((question) => question.id === selectedQuestion.id)
    : -1;
  const selectedQuestionOrderIndex = selectedQuestion
    ? schema.questions.findIndex((question) => question.id === selectedQuestion.id)
    : -1;
  const nextGroupBoundaryIndex =
    selectedQuestionOrderIndex === -1
      ? -1
      : schema.questions.findIndex(
          (question, index) =>
            index > selectedQuestionOrderIndex &&
            (question.category === 'Question Group' || question.category === 'End Screen')
        );
  const selectedGroupQuestionCount =
    selectedQuestionOrderIndex === -1
      ? 0
      : schema.questions
          .slice(
            selectedQuestionOrderIndex + 1,
            nextGroupBoundaryIndex === -1 ? undefined : nextGroupBoundaryIndex
          )
          .filter(isAnswerableQuestion).length;
  const selectedGroupTitle =
    isSelectedGroup && selectedQuestion
      ? selectedQuestion.text.replace(/^section\s+\d+\s*:\s*/i, '').trim() || selectedQuestion.text
      : selectedQuestion?.text ?? '';
  const selectedGroupDescription = selectedSettings.description?.trim() ?? '';
  const selectedGroupDescriptionMatchesTitle =
    selectedGroupDescription.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ===
    selectedGroupTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const selectedGroupSummary =
    isSelectedGroup && selectedGroupDescription && !selectedGroupDescriptionMatchesTitle
      ? selectedGroupDescription
      : selectedGroupQuestionCount > 0
        ? `The next ${selectedGroupQuestionCount} ${
            selectedGroupQuestionCount === 1 ? 'question covers' : 'questions cover'
          } this topic area and the work captured in this part of the form.`
        : 'This section introduces the next part of the form.';
  const selectedGroupButtonLabel =
    selectedSettings.buttonLabel?.trim() &&
    selectedSettings.buttonLabel.trim().toLowerCase() !== 'continue'
      ? selectedSettings.buttonLabel
      : 'Start section';
  const selectedEndFooterText =
    isSelectedEnd && Object.prototype.hasOwnProperty.call(selectedSettings, 'footerText')
      ? selectedSettings.footerText ?? ''
      : 'Thanks for taking part';

  useEffect(() => {
    if (!selectedQuestion?.branching) return;

    const selectionOptions = getBranchSelectionOptions(selectedQuestion);
    if (selectionOptions.length === 0) return;

    const selectionOperator = getBranchSelectionOperator(selectedQuestion);
    const nextConditions = (selectedQuestion.branching.conditions ?? []).map((condition) => {
      const currentValue = String(condition.when.value ?? '');
      const nextValue = selectionOptions.includes(currentValue)
        ? currentValue
        : selectionOptions[0];
      if (condition.when.operator === selectionOperator && condition.when.value === nextValue) {
        return condition;
      }
      return {
        ...condition,
        when: {
          operator: selectionOperator,
          value: nextValue,
        },
      };
    });

    const changed = nextConditions.some(
      (condition, index) => condition !== selectedQuestion.branching?.conditions?.[index]
    );
    if (!changed) return;

    setSchema((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === selectedQuestion.id
          ? {
              ...question,
              branching: {
                ...(question.branching ?? {}),
                conditions: nextConditions,
              },
            }
          : question
      ),
    }));
  }, [selectedQuestion]);

  useEffect(() => {
    if (!scoringEnabled && activeTab === 'results') {
      setActiveTab('question');
    }
  }, [activeTab, scoringEnabled]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (isNew || !id) {
        return;
      }

      try {
        const response = await fetch(`/api/forms/${id}`);
        if (!response.ok) {
          throw new Error('Failed to load form.');
        }
        const data = (await response.json()) as {
          title?: string;
          schema?: FormSchemaV0;
          published?: number;
        };
        if (isMounted) {
          const loadedSchema = data.schema ?? emptySchema;
          setTitle(data.title ?? '');
          setSchema({
            ...loadedSchema,
            id: id,
            scoringEnabled: isScoringEnabled(loadedSchema),
            theme: {
              ...defaultTheme,
              ...(loadedSchema.theme ?? {}),
            },
          });
          setPublished(data.published === 1);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setStatus('error');
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) {
      setTemplateModalOpen(true);
    }
  }, [isNew]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | null = null;

    const loadResponses = async (background = false) => {
      if (activeTab !== 'responses' || isNew || !id) {
        return;
      }

      if (!background) {
        setResponsesLoading(true);
        setResponsesError(null);
      }
      try {
        const response = await fetch(
          `/api/forms/${id}/responses/review?status=${responseStatusFilter}`
        );
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Failed to load responses.'));
        }
        const data = (await response.json()) as { responses?: ResponseReviewListItem[] };
        if (isMounted) {
          const nextRows = data.responses ?? [];
          setResponseRows((current) =>
            areResponseReviewRowsEqual(current, nextRows) ? current : nextRows
          );
          setSelectedResponseId((current) =>
            current && nextRows.some((item) => item.id === current)
              ? current
              : nextRows[0]?.id ?? null
          );
          if (background) {
            setResponsesError(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (!background) {
            setResponsesError(err instanceof Error ? err.message : 'Unknown error');
            setResponseRows([]);
            setSelectedResponseId(null);
          }
        }
      } finally {
        if (isMounted && !background) {
          setResponsesLoading(false);
        }
      }
    };

    void loadResponses();

    if (activeTab === 'responses' && !isNew && id) {
      intervalId = window.setInterval(() => {
        void loadResponses(true);
      }, 5000);
    }

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [activeTab, id, isNew, responseStatusFilter, responsesRefreshKey]);

  useEffect(() => {
    let isMounted = true;

    const loadResponseDetail = async () => {
      if (activeTab !== 'responses' || isNew || !id || !selectedResponseId) {
        setSelectedResponseDetail(null);
        return;
      }

      try {
        const response = await fetch(`/api/forms/${id}/responses/review/${selectedResponseId}`);
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Failed to load response detail.'));
        }
        const data = (await response.json()) as { response?: ResponseReviewDetail };
        if (isMounted) {
          setSelectedResponseDetail(data.response ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setResponsesError(err instanceof Error ? err.message : 'Unknown error');
          setSelectedResponseDetail(null);
        }
      }
    };

    void loadResponseDetail();

    return () => {
      isMounted = false;
    };
  }, [activeTab, id, isNew, selectedResponseId]);

  const handleDeleteResponse = async (response: ResponseReviewListItem) => {
    if (!id || deletingResponseId) return;

    const confirmed = window.confirm(
      `Delete the response from ${response.submitterName}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingResponseId(response.id);
    setResponsesError(null);
    try {
      const result = await fetch(`/api/forms/${id}/responses/${response.id}`, {
        method: 'DELETE',
      });
      if (!result.ok) {
        throw new Error(await readApiError(result, 'Failed to delete response.'));
      }

      setResponseRows((current) => {
        const nextRows = current.filter((item) => item.id !== response.id);
        setSelectedResponseId((currentSelected) => {
          if (currentSelected !== response.id) return currentSelected;
          return nextRows[0]?.id ?? null;
        });
        return nextRows;
      });
      setSelectedResponseDetail((current) => (current?.id === response.id ? null : current));
    } catch (err) {
      setResponsesError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingResponseId(null);
    }
  };

  const createForm = async (schemaInput: FormSchemaV0, formTitle: string) => {
    const params = new URLSearchParams(location.search);
    const workspaceId = params.get('workspaceId');
    if (!workspaceId) {
      setError('Workspace is required to create a form.');
      setStatus('error');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formTitle,
          schema: { ...schemaInput, title: formTitle },
          workspaceId,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to create form.'));
      }
      const data = (await response.json()) as { id?: string };
      if (data.id) {
        setTemplateModalOpen(false);
        navigate(`/forms/${data.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create form.');
      setStatus('error');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateAiPreview = async () => {
    const brief = aiBrief.trim();
    const params = new URLSearchParams(location.search);
    const workspaceId = params.get('workspaceId');
    if (!brief) {
      setAiError('A markdown brief is required.');
      return;
    }

    setAiSubmitting(true);
    setAiError(null);
    setAiPreview(null);
    setError(null);

    try {
      const response = await fetch('/api/ai/forms/spec', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          model: aiModel.trim() || undefined,
          workspaceId: workspaceId || undefined,
        }),
      });

      if (!response.ok) {
        setAiError(await readApiError(response, 'Unable to generate AI draft.'));
        return;
      }

      const data = (await response.json()) as AiPreviewData;
      setAiPreview(data);
    } catch {
      setAiError('Unable to generate AI preview. Check your connection and try again.');
    } finally {
      setAiSubmitting(false);
    }
  };

  const handleCreateAiDraft = async () => {
    const params = new URLSearchParams(location.search);
    const workspaceId = params.get('workspaceId');
    if (!workspaceId) {
      setAiError('Workspace is required to create an AI draft.');
      return;
    }
    if (!aiPreview?.schema) {
      setAiError('Generate a preview before creating a draft.');
      return;
    }

    setAiSubmitting(true);
    setAiError(null);
    setError(null);

    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiPreview.schema.title,
          schema: aiPreview.schema,
          workspaceId,
        }),
      });

      if (!response.ok) {
        setAiError(await readApiError(response, 'Unable to create AI draft.'));
        return;
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        setAiError('AI draft creation did not return a form ID.');
        return;
      }

      setTemplateModalOpen(false);
      setAiDialogOpen(false);
      setAiBrief('');
      setAiModel('');
      setAiPreview(null);
      navigate(`/forms/${data.id}/edit`);
    } catch {
      setAiError('Unable to create AI draft. Check your connection and try again.');
    } finally {
      setAiSubmitting(false);
    }
  };

  const handleAiFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const contents = await file.text();
      setAiBrief(contents);
      setAiFileName(file.name);
      setAiError(null);
      setAiPreview(null);
    } catch {
      setAiError('Unable to read the uploaded markdown file.');
    } finally {
      event.target.value = '';
    }
  };

  const addQuestionFromTemplate = (template: (typeof questionTypeTemplates)[number]) => {
    const nextId =
      schema.questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;
    const nextQuestion: FormSchemaV0['questions'][number] = {
      id: nextId,
      text: template.questionText,
      weight: 0,
      category: template.category,
      settings: {
        kind: getTemplateQuestionKind(template.key),
        answerType:
          template.key === 'welcome' || template.key === 'end' || template.key === 'group' || template.key === 'details'
            ? undefined
            : getTemplateAnswerType(template.key),
        description:
          template.key === 'details'
            ? 'Add context, instructions, terms, or explanatory text here.'
            : undefined,
        minNumberEnabled: template.key === 'number' ? true : undefined,
        minNumber: template.key === 'number' ? 1 : undefined,
        maxNumberEnabled: template.key === 'number' ? true : undefined,
        maxNumber: template.key === 'number' ? 5 : undefined,
        choiceKeyStyle: template.key === 'numberedChoice' ? 'numbers' : undefined,
        buttonLabel:
          template.key === 'welcome'
            ? 'Start'
            : template.key === 'end'
              ? 'Finish'
              : template.key === 'details' || template.key === 'group'
                ? 'Continue'
                : undefined,
      },
    };
    setSchema((prev) => ({ ...prev, questions: [...prev.questions, nextQuestion] }));
    setSelectedQuestionId(nextId);
    setActiveTab('question');
    setTemplateModalOpen(false);
  };

  useEffect(() => {
    if (!schema.questions.length) {
      setSelectedQuestionId(null);
      return;
    }
    if (!selectedQuestionId || !schema.questions.some((q) => q.id === selectedQuestionId)) {
      setSelectedQuestionId(schema.questions[0].id);
    }
  }, [schema.questions, selectedQuestionId]);

  useEffect(() => {
    if (!schema.description?.trim()) {
      setPreviewStep('questions');
    }
  }, [schema.description]);

  useEffect(() => {
    if (questionTitleRef.current) {
      questionTitleRef.current.style.height = 'auto';
      questionTitleRef.current.style.height = `${questionTitleRef.current.scrollHeight}px`;
    }
  }, [selectedQuestion?.text, selectedQuestionId]);

  useEffect(() => {
    const updateWidth = () => {
      if (!questionTitleMeasureRef.current || !questionTitleContainerRef.current) return;
      const measured = questionTitleMeasureRef.current.offsetWidth;
      const containerWidth = questionTitleContainerRef.current.offsetWidth;
      if (measured && containerWidth) {
        setQuestionTitleWidth(Math.min(measured + 4, containerWidth));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [selectedQuestion?.text]);

  const updateQuestion = (
    questionId: number,
    updater: (question: FormSchemaV0['questions'][number]) => FormSchemaV0['questions'][number]
  ) => {
    setSchema((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? updater(question) : question
      ),
    }));
  };

  const updateSelectedQuestionSettings = (
    updater: (
      settings: NonNullable<FormSchemaV0['questions'][number]['settings']>
    ) => NonNullable<FormSchemaV0['questions'][number]['settings']>
  ) => {
    if (!selectedQuestion) return;
    updateQuestion(selectedQuestion.id, (question) => ({
      ...question,
      settings: updater(question.settings ?? {}),
    }));
  };

  const updateSelectedChoices = (updater: (choices: string[]) => string[]) => {
    updateSelectedQuestionSettings((settings) => ({
      ...settings,
      choices: updater(settings.choices ?? ['Choice A']),
    }));
  };

  const handleMediaUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      updateSelectedQuestionSettings((settings) => ({
        ...settings,
        mediaUrl: result,
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      }));
    };
    reader.readAsDataURL(file);
  };

  const addQuestion = () => {
    const nextId = schema.questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;
    const nextQuestion: FormSchemaV0['questions'][number] = {
      id: nextId,
      text: 'New question',
      weight: 0,
      category: 'General',
      settings: {
        answerType: 'short',
      },
    };
    setSchema((prev) => ({ ...prev, questions: [...prev.questions, nextQuestion] }));
    setSelectedQuestionId(nextId);
    setActiveTab('question');
  };

  const removeQuestion = (questionId: number) => {
    setSchema((prev) => ({
      ...prev,
      questions: prev.questions.filter((question) => question.id !== questionId),
    }));
    setSelectedQuestionId((current) => {
      if (current !== questionId) return current;
      const remaining = schema.questions.filter((question) => question.id !== questionId);
      return remaining[0]?.id ?? null;
    });
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    setSchema((prev) => {
      const nextQuestions = [...prev.questions];
      const [item] = nextQuestions.splice(fromIndex, 1);
      nextQuestions.splice(toIndex, 0, item);
      return { ...prev, questions: nextQuestions };
    });
  };

  const moveQuestionById = (questionId: number, toIndex: number) => {
    setSchema((prev) => {
      const fromIndex = prev.questions.findIndex((question) => question.id === questionId);
      if (fromIndex === -1 || fromIndex === toIndex) return prev;

      const nextQuestions = [...prev.questions];
      const [item] = nextQuestions.splice(fromIndex, 1);
      const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      nextQuestions.splice(adjustedToIndex, 0, item);
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleSave = async () => {
    setStatus('saving');
    setError(null);

    if (!title.trim()) {
      setStatus('error');
      setError('Title is required.');
      return;
    }

    if (validationErrors.length > 0) {
      setStatus('error');
      setError('Fix schema errors before saving.');
      return;
    }

    try {
      const normalizedSchema = normalizeSchemaQuestionCategories({
        ...schema,
        title: title.trim(),
      });
      const payload = {
        title: title.trim(),
        schema: normalizedSchema,
      };

      if (isNew) {
        const response = await fetch('/api/forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, 'Failed to create form.'));
        }

        const data = (await response.json()) as { id?: string };
        if (data.id) {
          const newId = data.id;
          setSchema((prev) => ({ ...prev, id: newId }));
          navigate(`/forms/${newId}/edit`);
        }
      } else if (id) {
        const response = await fetch(`/api/forms/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, 'Failed to update form.'));
        }
      }

      setSchema(normalizedSchema);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handlePublish = async () => {
    if (!id || isNew) return;
    setStatus('saving');
    setError(null);

    if (!title.trim()) {
      setStatus('error');
      setError('Title is required.');
      return;
    }

    if (validationErrors.length > 0) {
      setStatus('error');
      setError('Fix schema errors before publishing.');
      return;
    }

    try {
      const normalizedSchema = normalizeSchemaQuestionCategories({
        ...schema,
        title: title.trim(),
      });
      const payload = {
        title: title.trim(),
        schema: normalizedSchema,
      };

      const saveResponse = await fetch(`/api/forms/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!saveResponse.ok) {
        throw new Error(await readApiError(saveResponse, 'Failed to update form before publishing.'));
      }

      const response = await fetch(`/api/forms/${id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to publish form.'));
      }
      setSchema(normalizedSchema);
      setPublished(true);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const themeStyles = schema.theme
    ? ({
        '--color-primary': schema.theme.primaryColor,
        '--color-background': schema.theme.backgroundColor,
        '--color-text': schema.theme.textColor,
        fontFamily: schema.theme.fontFamily,
      } as React.CSSProperties)
    : undefined;

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="h-screen flex flex-col bg-white overflow-hidden"
    >
      <Dialog.Root open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-7 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between mb-5">
              <div>
                <Dialog.Title className="text-2xl font-semibold text-gray-900">
                  Create new form
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mt-1">
                  Pick a template or question type.
                </Dialog.Description>
              </div>
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-xl border border-gray-200">
                Close
              </Dialog.Close>
            </div>

            <div className="grid grid-cols-[220px_1fr] gap-8">
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Templates</div>
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary/60 hover:shadow-sm transition text-sm text-gray-700 flex items-center gap-3"
                    onClick={() => {
                      setAiError(null);
                      setAiDialogOpen(true);
                    }}
                    disabled={creating}
                  >
                    <span className="h-8 w-8 rounded-lg inline-flex items-center justify-center bg-emerald-100 text-emerald-700">
                      <MessageSquareText className="h-4 w-4" />
                    </span>
                    <span>Generate with AI</span>
                  </button>
                  {templateSchemas.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary/60 hover:shadow-sm transition text-sm text-gray-700 flex items-center gap-3"
                      onClick={() => createForm(template.schema, template.schema.title)}
                      disabled={creating}
                    >
                      <span
                        className={`h-8 w-8 rounded-lg inline-flex items-center justify-center ${template.iconClass}`}
                      >
                        <template.icon className="h-4 w-4" />
                      </span>
                      <span>{template.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
                  Types
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                  {questionTypeTemplates.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      className="text-left text-sm text-gray-700 hover:text-gray-900 inline-flex items-center gap-3"
                      onClick={() => {
                        if (isNew) {
                          createForm(
                            createSchema({
                              title: template.label,
                              questions: [
                                {
                                  id: 1,
                                  text: template.questionText,
                                  weight: 0,
                                  category: template.category,
                                  settings: {
                                    kind: getTemplateQuestionKind(template.key),
                                    answerType:
                                      template.key === 'welcome' ||
                                      template.key === 'end' ||
                                      template.key === 'group' ||
                                      template.key === 'details'
                                        ? undefined
                                        : getTemplateAnswerType(template.key),
                                    description:
                                      template.key === 'details'
                                        ? 'Add context, instructions, terms, or explanatory text here.'
                                        : undefined,
                                    minNumberEnabled: template.key === 'number' ? true : undefined,
                                    minNumber: template.key === 'number' ? 1 : undefined,
                                    maxNumberEnabled: template.key === 'number' ? true : undefined,
                                    maxNumber: template.key === 'number' ? 5 : undefined,
                                    buttonLabel:
                                      template.key === 'welcome'
                                        ? 'Start'
                                        : template.key === 'end'
                                          ? 'Finish'
                                          : template.key === 'details' || template.key === 'group'
                                            ? 'Continue'
                                            : undefined,
                                  },
                                },
                              ],
                            }),
                            template.label
                          );
                        } else {
                          addQuestionFromTemplate(template);
                        }
                      }}
                      disabled={creating}
                    >
                      <span
                        className={`h-7 w-7 rounded-md inline-flex items-center justify-center ${template.iconClass}`}
                      >
                        <template.icon className="h-4 w-4" />
                      </span>
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {creating && <div className="text-sm text-gray-500 mt-6">Creating form...</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={aiDialogOpen}
        onOpenChange={(open) => {
          setAiDialogOpen(open);
          if (!open) {
            setAiError(null);
            setAiSubmitting(false);
            setAiPreview(null);
            setAiFileName(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <Dialog.Content
              className="fixed left-1/2 top-[5vh] w-full max-w-2xl -translate-x-1/2 rounded-2xl bg-white shadow-2xl focus:outline-none flex flex-col overflow-hidden"
              style={{ maxHeight: '90vh', height: '90vh' }}
            >
            <div className="flex items-start justify-between p-6 pb-4 shrink-0">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Generate form with AI
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mt-1">
                  Paste a plain-English markdown brief and Census will create a draft form in the current workspace.
                </Dialog.Description>
              </div>
              <Dialog.Close className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-xl border border-gray-200">
                Close
              </Dialog.Close>
            </div>

            <div className="px-6 pb-6 space-y-4 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
              {aiError && <div className="text-sm text-red-600">{aiError}</div>}
              {aiPreview && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{aiPreview.spec.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Model: {aiPreview.model}
                        {aiPreview.repaired ? ' • repaired after validation feedback' : ''}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {aiPreview.spec.steps.length} steps • {aiPreview.schema.results.length} result bands
                    </div>
                  </div>

                  {aiPreview.spec.assumptions && aiPreview.spec.assumptions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                        Assumptions and ambiguities
                      </div>
                      <div className="space-y-2">
                        {aiPreview.spec.assumptions.map((item, index) => (
                          <div
                            key={`${item.type}-${index}`}
                            className={`rounded-lg px-3 py-2 text-sm ${
                              item.type === 'ambiguity'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-white text-gray-700 border border-gray-200'
                            }`}
                          >
                            <span className="font-medium capitalize">{item.type}:</span> {item.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                      Generated structure
                    </div>
                    <div className="space-y-2">
                      {aiPreview.spec.steps.map((step) => (
                        <div key={step.stepRef} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                          <div className="text-sm font-medium text-gray-800">{step.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {step.stepRef} • {step.kind}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="builder-ai-model" className="text-xs text-gray-500">
                  Model override
                </label>
                <input
                  id="builder-ai-model"
                  type="text"
                  value={aiModel}
                  onChange={(event) => setAiModel(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional. Leave blank to use the server default."
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="builder-ai-brief" className="text-xs text-gray-500">
                    Markdown brief
                  </label>
                  <div className="flex items-center gap-3">
                    {aiFileName && <div className="text-xs text-gray-500">{aiFileName}</div>}
                    <input
                      ref={aiFileInputRef}
                      type="file"
                      accept=".md,.markdown,text/markdown,text/plain"
                      className="hidden"
                      onChange={handleAiFileUpload}
                    />
                    <button
                      type="button"
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={() => aiFileInputRef.current?.click()}
                      disabled={aiSubmitting}
                    >
                      Upload markdown
                    </button>
                  </div>
                </div>
                <textarea
                  id="builder-ai-brief"
                  rows={14}
                  value={aiBrief}
                  onChange={(event) => {
                    setAiBrief(event.target.value);
                    if (aiFileName) {
                      setAiFileName(null);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`# Form brief

Build a qualification form for inbound B2B leads.

- Start with a short welcome screen
- Ask whether they have budget approval
- If yes, ask team size and timeline
- If no, end early
- Score higher for strong intent
- Add a short end screen`}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Dialog.Close className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                  Cancel
                </Dialog.Close>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50 transition disabled:bg-gray-100 disabled:text-gray-400"
                  onClick={handleGenerateAiPreview}
                  disabled={aiSubmitting}
                >
                  {aiSubmitting ? 'Generating...' : aiPreview ? 'Regenerate preview' : 'Generate preview'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-[#177767] text-white text-sm hover:bg-[#146957] transition disabled:bg-gray-300"
                  onClick={handleCreateAiDraft}
                  disabled={aiSubmitting || !aiPreview}
                >
                  {aiSubmitting && aiPreview ? 'Creating...' : 'Create draft'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="h-14 px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-[260px]">
          <Link to="/forms" className="text-[20px] text-gray-800 of-logo-text hover:text-gray-600 transition">
            Census
          </Link>
          <div className="text-sm text-gray-300">|</div>
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSchema((prev) => ({ ...prev, title: event.target.value }));
            }}
            className="text-base font-semibold text-gray-800 focus:outline-none"
            placeholder="Untitled form"
          />
        </div>
        <div className="flex-1 flex justify-center">
          <Tabs.List className="of-tabs-list">
            <Tabs.Trigger className="of-tabs-trigger" value="question">
              Question
            </Tabs.Trigger>
            <Tabs.Trigger className="of-tabs-trigger" value="branching">
              Branching
            </Tabs.Trigger>
            <Tabs.Trigger className="of-tabs-trigger" value="loops">
              Loops
            </Tabs.Trigger>
            <Tabs.Trigger className="of-tabs-trigger" value="theme">
              Design
            </Tabs.Trigger>
            {scoringEnabled && (
              <Tabs.Trigger className="of-tabs-trigger" value="results">
                Results
              </Tabs.Trigger>
            )}
            <Tabs.Trigger className="of-tabs-trigger" value="responses">
              Responses
            </Tabs.Trigger>
            <Tabs.Trigger className="of-tabs-trigger" value="share">
              Share
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Status: {published ? 'Published' : 'Draft'}
          </div>
          <button
            type="button"
            onClick={handlePublish}
            className="h-[30px] text-xs text-gray-600 border border-gray-200 rounded-xl px-3 inline-flex items-center bg-white hover:bg-[#ededee] transition disabled:text-gray-400"
            disabled={isNew || status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : published ? 'Republish' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-[30px] text-xs text-white rounded-xl px-3 inline-flex items-center bg-[#177767] hover:bg-[#146957] transition"
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 flex min-h-0" style={{ paddingTop: '0px' }}>
        <div className="rounded-2xl overflow-hidden flex-1 flex" style={{ backgroundColor: '#f7f7f8' }}>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <aside className="w-72 p-4 border-r-2 border-white overflow-y-auto">
              <button
                type="button"
                className="w-full h-[36px] rounded-xl bg-[#2f2b34] text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#27222a] transition"
                onClick={() => setTemplateModalOpen(true)}
              >
                <span className="text-lg leading-none">+</span>
                Add content
              </button>
              <div className="-mx-4 mt-4 h-0.5 bg-white/80" />
              <div className="flex items-center justify-between mt-4 mb-4">
                <div className="text-sm font-medium text-gray-600">Questions</div>
              </div>
              <div className="space-y-2">
            {schema.questions.length === 0 && (
              <div className="text-sm text-gray-500">No questions yet.</div>
            )}
            {schema.questions.map((question, index) => {
              const isWelcome = question.category === 'Welcome Screen';
              const isEnd = question.category === 'End Screen';
              const isDetails = question.settings?.kind === 'details' || question.category === 'Details Screen';
              const displayLabel = getQuestionDisplayLabel(question, index);
              const label = isWelcome
                ? 'Start screen'
                : isEnd
                  ? 'End screen'
                  : isDetails
                    ? 'Details screen'
                    : `Question`;
              return (
              <div
                key={question.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedQuestionId(question.id);
                  setActiveTab('question');
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedQuestionId(question.id);
                  setActiveTab('question');
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverQuestionId !== question.id) {
                    setDragOverQuestionId(question.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverQuestionId((current) => (current === question.id ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedQuestionId !== null) {
                    moveQuestionById(draggedQuestionId, index);
                  }
                  setDraggedQuestionId(null);
                  setDragOverQuestionId(null);
                }}
                className={`w-full text-left rounded-xl px-3 py-2 transition outline-none ${
                  question.id === selectedQuestionId
                    ? 'bg-[#ededee] text-gray-900'
                    : 'bg-white/70 text-gray-700 hover:bg-white'
                } ${dragOverQuestionId === question.id ? 'ring-2 ring-blue-300 bg-white' : ''} ${
                  draggedQuestionId === question.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                      draggable
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        setDraggedQuestionId(question.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(question.id));
                      }}
                      onDragEnd={() => {
                        setDraggedQuestionId(null);
                        setDragOverQuestionId(null);
                      }}
                      aria-label={`Drag ${label}`}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{displayLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <button
                      type="button"
                      className="hover:text-gray-600 disabled:text-gray-300"
                      disabled={index === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveQuestion(index, index - 1);
                      }}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="hover:text-gray-600 disabled:text-gray-300"
                      disabled={index === schema.questions.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveQuestion(index, index + 1);
                      }}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className="hover:text-gray-600"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[140px] rounded-xl border border-gray-200 bg-white p-1 shadow-xl text-sm"
                          sideOffset={8}
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="cursor-pointer rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeQuestion(question.id);
                            }}
                          >
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              </div>
            );
            })}
              </div>
            </aside>

            <section className="flex-1 p-6 overflow-y-auto border-r-2 border-white">
              <div
                className={`h-full ${isSelectedWelcome || isSelectedEnd ? '' : 'border border-gray-200 rounded-xl overflow-hidden'}`}
                style={{
                  ...themeStyles,
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                }}
              >
                {activeTab === 'responses' ? (
                  <div className="h-full overflow-y-auto bg-white text-gray-800">
                    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-5 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">Responses</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Review completed and in-progress submissions for this form.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
                            {([
                              ['completed', 'Completed'],
                              ['in_progress', 'In progress'],
                              ['all', 'All'],
                            ] as Array<[ResponseStatusFilter, string]>).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                                  responseStatusFilter === value
                                    ? 'bg-[#2f2b34] text-white'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  setResponseStatusFilter(value);
                                  setSelectedResponseId(null);
                                  setSelectedResponseDetail(null);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                            onClick={() => {
                              setSelectedResponseId(null);
                              setSelectedResponseDetail(null);
                              setResponsesRefreshKey((current) => current + 1);
                            }}
                            disabled={responsesLoading || isNew}
                          >
                            Refresh
                          </button>
                          {!isNew && (
                            <a
                              href={`/api/forms/${id}/responses/export`}
                              className="h-9 rounded-xl bg-[#2f2b34] px-3 text-sm font-medium text-white inline-flex items-center hover:bg-[#27222a]"
                            >
                              Download CSV
                            </a>
                          )}
                        </div>
                      </div>

                      {isNew ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
                          Save the form before reviewing responses.
                        </div>
                      ) : responsesError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {responsesError}
                        </div>
                      ) : responsesLoading ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
                          Loading responses...
                        </div>
                      ) : responseRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
                          <div className="text-sm font-medium text-gray-700">
                            {responseStatusFilter === 'completed'
                              ? 'No completed responses yet.'
                              : responseStatusFilter === 'in_progress'
                                ? 'No in-progress responses yet.'
                                : 'No responses yet.'}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {responseStatusFilter === 'completed'
                              ? 'Published form submissions will appear here once respondents finish the form.'
                              : responseStatusFilter === 'in_progress'
                                ? 'Draft responses will appear here as respondents move through the form.'
                                : 'Responses will appear here as respondents start and complete the form.'}
                          </div>
                        </div>
                      ) : (
                        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(460px,0.95fr)_minmax(0,1.35fr)] xl:grid-cols-[minmax(520px,1fr)_minmax(0,1.45fr)]">
                          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
                              Submissions ({responseRows.length})
                            </div>
                            <div className="max-h-[640px] overflow-y-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">Submitter</th>
                                    <th className="w-[132px] px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Submitted</th>
                                    <th className="px-4 py-3 font-medium text-right">Answers</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {responseRows.map((response) => (
                                    <tr
                                      key={response.id}
                                      className={`cursor-pointer hover:bg-gray-50 ${
                                        selectedResponseId === response.id ? 'bg-[#ededee]' : ''
                                      }`}
                                      onClick={() => setSelectedResponseId(response.id)}
                                    >
                                      <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{response.submitterName}</div>
                                        {response.submitterEmail && (
                                          <div className="text-xs text-gray-500">{response.submitterEmail}</div>
                                        )}
                                      </td>
                                      <td className="w-[132px] px-4 py-3">
                                        <span
                                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                                            response.completed
                                              ? 'bg-emerald-100 text-emerald-700'
                                              : 'bg-amber-100 text-amber-700'
                                          }`}
                                        >
                                          {response.completed ? 'Completed' : 'In progress'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-600">
                                        {response.completed ? 'Submitted ' : 'Last saved '}
                                        {new Date(response.submittedAt).toLocaleString()}
                                      </td>
                                      <td className="px-4 py-3 text-right text-gray-600">{response.answerCount}</td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          type="button"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                          aria-label={`Delete response from ${response.submitterName}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleDeleteResponse(response);
                                          }}
                                          disabled={deletingResponseId === response.id}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            {!selectedResponseDetail ? (
                              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">
                                Select a response to review its answers.
                              </div>
                            ) : (
                              <div className="h-full overflow-y-auto">
                                <div className="border-b border-gray-100 px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="text-lg font-semibold text-gray-900">
                                      {selectedResponseDetail.submitterName}
                                    </div>
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                        selectedResponseDetail.completed
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {selectedResponseDetail.completed ? 'Completed' : 'In progress'}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm text-gray-500">
                                    {selectedResponseDetail.completed ? 'Submitted ' : 'Last saved '}
                                    {new Date(selectedResponseDetail.submittedAt).toLocaleString()}
                                  </div>
                                </div>
                                <div className="space-y-5 p-4">
                                  {selectedResponseDetail.sections.length === 0 ? (
                                    <div className="text-sm text-gray-500">No answers were captured.</div>
                                  ) : (
                                    selectedResponseDetail.sections.map((section) => (
                                      <div key={section.title} className="rounded-xl border border-gray-100">
                                        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-left text-sm font-semibold text-gray-700">
                                          {section.title}
                                        </div>
                                        <div className="divide-y divide-gray-100 text-left">
                                          {section.answers.map((answer) => (
                                            <div
                                              key={`${section.title}-${answer.questionId}`}
                                              className="grid gap-3 px-3 py-3 text-left text-sm md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]"
                                            >
                                              <div className="text-left align-top font-medium leading-6 text-gray-600">
                                                {answer.question}
                                              </div>
                                              <div className="whitespace-pre-wrap break-words text-left leading-6 text-gray-900">
                                                {answer.answer}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : schema.questions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">No questions yet</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                      Add a question on the left to see the live preview.
                    </p>
                  </div>
                ) : isSelectedWelcome || isSelectedEnd ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                    {selectedSettings.mediaUrl && selectedSettings.mediaPosition === 'above' && (
                      <div className="mb-6">
                        {selectedSettings.mediaType === 'video' ? (
                          <video
                            src={selectedSettings.mediaUrl}
                            className={`rounded-xl shadow-sm ${
                              selectedSettings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                              selectedSettings.mediaSize === 'small' ? 'max-w-[200px]' :
                              selectedSettings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                            }`}
                            controls
                          />
                        ) : (
                          <img
                            src={selectedSettings.mediaUrl}
                            alt="Welcome media"
                            className={`rounded-xl shadow-sm ${
                              selectedSettings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                              selectedSettings.mediaSize === 'small' ? 'max-w-[200px]' :
                              selectedSettings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                            }`}
                          />
                        )}
                      </div>
                    )}
                    <input
                      type="text"
                      value={selectedQuestion?.text ?? ''}
                      onChange={(event) => {
                        if (!selectedQuestion) return;
                        updateQuestion(selectedQuestion.id, (question) => ({
                          ...question,
                          text: event.target.value,
                        }));
                      }}
                      className="w-full max-w-2xl text-3xl font-semibold text-gray-500 text-center bg-transparent focus:outline-none"
                      placeholder={isSelectedWelcome ? 'Welcome title' : 'End title'}
                    />
                    <input
                      type="text"
                      value={schema.description ?? ''}
                      onChange={(event) =>
                        setSchema((prev) => ({ ...prev, description: event.target.value }))
                      }
                      className="w-full max-w-xl text-lg text-gray-400 text-center bg-transparent focus:outline-none mt-6"
                      placeholder="Description (optional)"
                    />
                    {selectedSettings.mediaUrl && selectedSettings.mediaPosition !== 'above' && (
                      <div className="mt-6">
                        {selectedSettings.mediaType === 'video' ? (
                          <video
                            src={selectedSettings.mediaUrl}
                            className={`rounded-xl shadow-sm ${
                              selectedSettings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                              selectedSettings.mediaSize === 'small' ? 'max-w-[200px]' :
                              selectedSettings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                            }`}
                            controls
                          />
                        ) : (
                          <img
                            src={selectedSettings.mediaUrl}
                            alt="Welcome media"
                            className={`rounded-xl shadow-sm ${
                              selectedSettings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                              selectedSettings.mediaSize === 'small' ? 'max-w-[200px]' :
                              selectedSettings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                            }`}
                          />
                        )}
                      </div>
                    )}
                    <div className="mt-8 flex items-center gap-4">
                      <button
                        type="button"
                        className="px-6 py-3 rounded-md bg-[#1f3bb3] text-white text-xl font-semibold"
                      >
                        {selectedQuestion?.settings?.buttonLabel ??
                          (isSelectedWelcome ? 'Start' : 'Finish')}
                      </button>
                      <span className="text-sm text-gray-600">press Enter ↵</span>
                    </div>
                    {(selectedSettings.showTimeToComplete ||
                      selectedSettings.showSubmissionCount ||
                      isSelectedEnd) && (
                      <div className="mt-4 text-sm text-gray-600 text-center space-y-1">
                        {selectedSettings.showTimeToComplete && <div>Takes X minutes</div>}
                        {selectedSettings.showSubmissionCount && <div>X people have filled this out</div>}
                        {isSelectedEnd &&
                          !selectedSettings.showTimeToComplete &&
                          !selectedSettings.showSubmissionCount &&
                          selectedEndFooterText.trim().length > 0 && (
                          <div>{selectedEndFooterText}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : selectedQuestion && isSelectedDetails ? (
                  <div className="h-full flex flex-col justify-center px-16 py-12">
                    <div className="w-full max-w-3xl mx-auto rounded-2xl bg-white/80 border border-gray-100 shadow-sm px-10 py-9">
                      <input
                        type="text"
                        value={selectedQuestion.text}
                        onChange={(event) => {
                          updateQuestion(selectedQuestion.id, (question) => ({
                            ...question,
                            text: event.target.value,
                          }));
                        }}
                        className="w-full text-3xl font-semibold text-gray-800 bg-transparent focus:outline-none"
                        placeholder="Details title"
                      />
                      <textarea
                        rows={10}
                        value={selectedSettings.description ?? ''}
                        onChange={(event) => {
                          updateSelectedQuestionSettings((settings) => ({
                            ...settings,
                            description: event.target.value,
                          }));
                        }}
                        className="mt-6 w-full resize-y bg-transparent text-base leading-7 text-gray-700 focus:outline-none"
                        placeholder="Add longer context, instructions, terms, or explanatory text here..."
                      />
                      <div className="mt-8 flex items-center gap-4">
                        <button
                          type="button"
                          className="px-6 py-3 rounded-md bg-[#1f3bb3] text-white text-xl font-semibold"
                        >
                          {selectedSettings.buttonLabel ?? 'Continue'}
                        </button>
                        <span className="text-sm text-gray-600">press Enter ↵</span>
                      </div>
                    </div>
                  </div>
                ) : selectedQuestion && !isSelectedWelcome && !isSelectedEnd ? (
                  <div className="h-full flex flex-col justify-center px-16 py-12">
                  <div
                      className={`w-full flex ${
                        isSelectedGroup
                          ? 'justify-center'
                          : inferredAnswerType === 'long'
                          ? 'justify-start'
                          : selectedSettings.verticalAlignment === 'center'
                            ? 'justify-center'
                            : 'justify-start'
                      }`}
                    >
                      <div
                        className={`w-full ${
                          isSelectedGroup
                            ? 'max-w-5xl'
                            : `grid grid-cols-[36px_1fr] gap-3 ${
                          inferredAnswerType === 'long' || inferredAnswerType === 'number'
                            ? 'max-w-none'
                            : 'max-w-[400px]'
                        }`
                        }`}
                      >
                        {!isSelectedGroup && (
                          <div className="text-sm text-blue-600 font-medium leading-snug flex items-center gap-2 self-start mt-[6px]">
                            <span className="whitespace-nowrap">{selectedQuestionPosition}</span>
                            <span className="whitespace-nowrap">→</span>
                          </div>
                        )}
                      <div className={`flex flex-col ${isSelectedGroup ? 'items-center text-center' : 'items-start text-left'}`}>
                        {!isSelectedGroup && (
                          <>
                            <div
                              ref={questionTitleContainerRef}
                              className="text-sm text-blue-600 font-medium mb-2 flex items-start gap-2 w-full relative"
                            >
                              <textarea
                                ref={questionTitleRef}
                                rows={1}
                                value={selectedQuestion.text}
                                onChange={(event) => {
                                  updateQuestion(selectedQuestion.id, (question) => ({
                                    ...question,
                                    text: event.target.value,
                                  }));
                                  if (questionTitleRef.current) {
                                    questionTitleRef.current.style.height = 'auto';
                                    questionTitleRef.current.style.height = `${questionTitleRef.current.scrollHeight}px`;
                                  }
                                }}
                                className="text-gray-800 text-[20px] font-semibold bg-transparent focus:outline-none w-full min-w-0 resize-none leading-snug"
                                placeholder="Your question here. Recall information with @"
                                style={questionTitleWidth ? { width: questionTitleWidth } : undefined}
                              />
                              <span
                                ref={questionTitleMeasureRef}
                                className="text-gray-800 text-[20px] font-semibold leading-snug absolute opacity-0 pointer-events-none whitespace-pre -left-[9999px]"
                                aria-hidden
                              >
                                {selectedQuestion.text || 'Your question here. Recall information with @'}
                              </span>
                              {selectedSettings.required && (
                                <span className="text-red-500 font-semibold pt-1 flex-shrink-0">*</span>
                              )}
                            </div>
                            <textarea
                              rows={1}
                              value={selectedSettings.description ?? ''}
                              onChange={(event) => {
                                updateSelectedQuestionSettings((settings) => ({
                                  ...settings,
                                  description: event.target.value,
                                }));
                                if (event.currentTarget) {
                                  event.currentTarget.style.height = 'auto';
                                  event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                                }
                              }}
                              className="text-sm text-gray-400 italic bg-transparent focus:outline-none w-full mb-6 resize-none leading-snug"
                              placeholder="Description (optional)"
                            />
                          </>
                        )}
                      {selectedSettings.mediaUrl && !isSelectedGroup && (
                        <div className="mb-6">
                          {selectedSettings.mediaType === 'video' ? (
                            <video
                              src={selectedSettings.mediaUrl}
                              className="max-w-[520px] rounded-xl shadow-sm"
                              controls
                            />
                          ) : (
                            <img
                              src={selectedSettings.mediaUrl}
                              alt="Question media"
                              className="max-w-[520px] rounded-xl shadow-sm"
                            />
                          )}
                        </div>
                      )}

                      {isSelectedGroup ? (
                        <div className="mt-2 w-full max-w-4xl rounded-[32px] border border-slate-200/80 bg-white/85 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10">
                          <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-blue-700">
                                {groupQuestions.length > 0 && selectedGroupIndex >= 0
                                  ? `Section ${selectedGroupIndex + 1} of ${groupQuestions.length}`
                                  : 'Section'}
                              </span>
                              {selectedGroupQuestionCount > 0 && (
                                <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-emerald-700 sm:ml-auto">
                                  {selectedGroupQuestionCount}{' '}
                                  {selectedGroupQuestionCount === 1 ? 'question ahead' : 'questions ahead'}
                                </span>
                              )}
                            </div>
                            <div className="mx-auto max-w-3xl text-center">
                              <input
                                type="text"
                                value={selectedGroupTitle}
                                onChange={(event) => {
                                  updateQuestion(selectedQuestion.id, (question) => ({
                                    ...question,
                                    text: event.target.value,
                                  }));
                                }}
                                className="w-full bg-transparent text-center text-3xl font-semibold tracking-tight text-slate-900 focus:outline-none sm:text-5xl"
                                placeholder="Section title"
                              />
                              <textarea
                                rows={3}
                                value={selectedSettings.description ?? ''}
                                onChange={(event) => {
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    description: event.target.value,
                                  }));
                                }}
                                className="mx-auto mt-4 w-full max-w-2xl resize-none bg-transparent text-center text-base leading-7 text-slate-600 focus:outline-none sm:text-lg"
                                placeholder={selectedGroupSummary}
                              />
                            </div>
                            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-center text-sm leading-6 text-slate-600">
                              You’re moving into a new topic area. Continue when you’re ready to start this section.
                            </div>
                            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:items-center">
                              <button
                                type="button"
                                className="px-6 py-3 rounded-md bg-[#1f3bb3] text-white text-xl font-semibold"
                              >
                                {selectedGroupButtonLabel}
                              </button>
                              <span className="text-sm text-gray-600">press Enter ↵</span>
                            </div>
                          </div>
                        </div>
                      ) : inferredAnswerType === 'multiple' ? (
                        <div className="flex flex-col gap-3 w-full items-start">
                          {(() => {
                            const choices = selectedSettings.choices ?? ['Choice A'];
                            const rows = [
                              ...choices,
                              ...(selectedSettings.otherOption ? ['Other'] : []),
                            ];
                            return rows.map((choice, idx) => {
                              const isOtherRow = selectedSettings.otherOption && idx === choices.length;
                              return (
                                <div
                                  key={`preview-choice-${idx}`}
                                  className="flex items-center gap-3 w-full"
                                >
                                  <div className="h-8 w-8 rounded-md border border-blue-300 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                    {getChoiceKey(idx, selectedSettings.choiceKeyStyle)}
                                  </div>
                                  <input
                                    type="text"
                                    value={choice}
                                    onChange={(event) =>
                                      updateSelectedChoices((currentChoices) =>
                                        currentChoices.map((item, itemIdx) =>
                                          itemIdx === idx ? event.target.value : item
                                        )
                                      )
                                    }
                                    onBlur={() => {
                                      if (isOtherRow) return;
                                      updateSelectedChoices((currentChoices) => {
                                        if (currentChoices.length <= 1) return currentChoices;
                                        return currentChoices.filter(
                                          (item, itemIdx) => itemIdx !== idx || item.trim().length > 0
                                        );
                                      });
                                    }}
                                    className="min-w-[260px] rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
                                    disabled={isOtherRow}
                                  />
                                  {!isOtherRow && choices.length > 1 && (
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                      aria-label={`Remove choice ${idx + 1}`}
                                      onClick={() =>
                                        updateSelectedChoices((currentChoices) =>
                                          currentChoices.filter((_, itemIdx) => itemIdx !== idx)
                                        )
                                      }
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              );
                            });
                          })()}
                          <div className="w-full flex justify-start">
                            <button
                              type="button"
                              className="text-blue-600 text-sm font-medium underline underline-offset-2"
                              onClick={() =>
                                updateSelectedChoices((choices) => [
                                  ...choices,
                                  `Choice ${String.fromCharCode(65 + choices.length)}`,
                                ])
                              }
                            >
                              Add choice
                            </button>
                          </div>
                        </div>
                      ) : inferredAnswerType === 'yesno' ? (
                        <div className="flex flex-col gap-3 w-full items-start">
                          {['Yes', 'No'].map((choice) => (
                            <div key={choice} className="flex items-center gap-3 w-full">
                              <div className="h-8 w-8 rounded-md border border-blue-300 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                {choice === 'Yes' ? 'Y' : 'N'}
                              </div>
                              <div className="min-w-[260px] rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-gray-700">
                                {choice}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : inferredAnswerType === 'long' ? (
                        <div className="w-full">
                          {selectedSettings.longTextFormat === 'steps' ||
                          selectedSettings.longTextFormat === 'numbered' ? (
                            <div className="space-y-3">
                              {[1, 2, 3].map((item) => (
                                <div key={`preview-list-item-${item}`} className="flex items-center gap-3">
                                  <div className="w-16 text-sm font-medium text-blue-700">
                                    {selectedSettings.longTextFormat === 'steps' ? `Step ${item}` : `${item}.`}
                                  </div>
                                  <div className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-gray-400">
                                    {selectedSettings.longTextFormat === 'steps'
                                      ? 'Describe this step...'
                                      : 'Type an item...'}
                                  </div>
                                </div>
                              ))}
                              <div className="inline-flex rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700">
                                {selectedSettings.longTextFormat === 'steps'
                                  ? 'Add another step'
                                  : 'Add another item'}
                              </div>
                            </div>
                          ) : (
                            <>
                              <textarea
                                rows={1}
                                value=""
                                readOnly
                                className="w-full bg-transparent text-blue-700 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none resize-none pointer-events-none p-0 leading-[1.1] h-[44px]"
                                style={{ fontSize: '28px' }}
                                placeholder="Type your answer here..."
                              />
                              <div className="text-sm text-blue-700" style={{ marginTop: '2px' }}>
                                <span className="font-medium">Shift</span> + Enter ↵ to make a line break
                              </div>
                            </>
                          )}
                        </div>
                      ) : inferredAnswerType === 'date' ? (
                        <div className="w-full">
                          {(() => {
                            const format = selectedSettings.dateFormat ?? 'MMDDYYYY';
                            const separator = selectedSettings.dateSeparator ?? '/';
                            const parts = format === 'DDMMYYYY' ? ['DD', 'MM', 'YYYY'] : format === 'YYYYMMDD' ? ['YYYY', 'MM', 'DD'] : ['MM', 'DD', 'YYYY'];
                            const labels: Record<string, string> = { MM: 'Month', DD: 'Day', YYYY: 'Year' };
                            return (
                              <div className="flex items-end gap-6 text-blue-700 text-sm">
                                {parts.map((part, index) => (
                                  <React.Fragment key={part}>
                                    <div className="flex flex-col gap-2">
                                      <span>{labels[part]}</span>
                                      <div className="text-[36px] text-blue-700 border-b border-blue-400 pb-2">{part}</div>
                                    </div>
                                    {index < parts.length - 1 && (
                                      <div className="text-[36px] text-blue-700 pb-2">{separator}</div>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : inferredAnswerType === 'email' ? (
                        <div className="w-full">
                          <input
                            type="text"
                            value=""
                            readOnly
                            className="w-full bg-transparent text-blue-700 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                            placeholder="name@example.com"
                          />
                        </div>
                      ) : inferredAnswerType === 'number' ? (
                        <div className="w-full">
                          {getNumberScaleOptions(selectedSettings).length > 0 ? (
                            <div
                              className={
                                selectedSettings.choices?.length
                                  ? 'flex flex-col gap-3 w-full max-w-3xl'
                                  : 'flex flex-wrap gap-3'
                              }
                            >
                              {getNumberScaleOptions(selectedSettings).map((option, index) => {
                                const optionLabel = getNumberScaleLabel(selectedSettings, option, index);
                                const hasLabel = optionLabel !== String(option);
                                return (
                                <div
                                  key={`preview-number-${option}`}
                                  className={`flex min-h-12 items-center rounded-xl border border-blue-300 bg-white px-4 py-3 text-blue-700 shadow-sm ${
                                    hasLabel ? 'w-full gap-3 text-left' : 'min-w-12 justify-center text-lg font-semibold'
                                  }`}
                                >
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-current text-sm font-semibold">
                                    {option}
                                  </span>
                                  {hasLabel && (
                                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-gray-700">
                                      {optionLabel}
                                    </span>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="w-full max-w-3xl">
                              <input
                                type="text"
                                value=""
                                readOnly
                                className="block w-full bg-transparent text-blue-700 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                                placeholder="Type your answer here..."
                              />
                              {getNumberUnitChoices(selectedSettings).length > 0 && (
                                <div className="mt-5 flex flex-col gap-3 w-full items-start">
                                  {getNumberUnitChoices(selectedSettings).map((unit) => (
                                    <div
                                      key={`preview-number-unit-${unit}`}
                                      className="w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-blue-700 shadow-sm"
                                    >
                                      <span className="text-sm font-medium leading-snug text-gray-700">
                                        {unit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="min-w-[280px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400">
                          Answer
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                  </div>
                ) : schema.description?.trim() && previewStep === 'intro' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">{schema.title}</h3>
                    <p className="text-gray-600 max-w-md mb-6">{schema.description}</p>
                <button
                  type="button"
                  className="typeform-button"
                  onClick={() => setPreviewStep('questions')}
                >
                  Start preview
                </button>
              </div>
            ) : (
              <div className="h-full">
                <Questions
                  form={previewForm}
                  onComplete={() => setPreviewStep(schema.description?.trim() ? 'intro' : 'questions')}
                  previewMode
                />
              </div>
            )}
          </div>
        </section>

            {activeTab !== 'responses' && (
            <aside className="w-80 p-4 overflow-y-auto">
          <div className="of-tabs">
            <Tabs.Content value="question">
              <div className="space-y-4">
                <div>
                  <label className="of-label">Screen type</label>
                  <select
                    value={
                      selectedQuestion
                        ? isSelectedWelcome
                          ? 'welcome'
                          : isSelectedEnd
                            ? 'end'
                            : isSelectedDetails
                              ? 'details'
                              : 'question'
                        : ''
                    }
                    onChange={(event) => {
                      if (!selectedQuestion) return;
                      const nextType = event.target.value;
                      if (nextType === 'question') {
                        updateQuestion(selectedQuestion.id, (question) => ({
                          ...question,
                          category:
                            question.category === 'Welcome Screen' ||
                            question.category === 'End Screen' ||
                            question.category === 'Details Screen'
                              ? getCategoryForAnswerType(
                                  question.settings?.answerType ?? 'long'
                                )
                              : question.category,
                          settings: {
                            ...(question.settings ?? {}),
                            kind: undefined,
                          },
                        }));
                        return;
                      }
                      updateQuestion(selectedQuestion.id, (question) => ({
                        ...question,
                        category:
                          nextType === 'welcome'
                            ? 'Welcome Screen'
                            : nextType === 'details'
                              ? 'Details Screen'
                              : 'End Screen',
                        settings: {
                          ...(question.settings ?? {}),
                          kind:
                            nextType === 'welcome'
                              ? 'welcome'
                              : nextType === 'details'
                                ? 'details'
                                : 'end',
                          buttonLabel:
                            (question.settings ?? {}).buttonLabel ??
                            (nextType === 'welcome'
                              ? 'Start'
                              : nextType === 'details'
                                ? 'Continue'
                                : 'Finish'),
                        },
                      }));
                    }}
                    className="of-input"
                    disabled={!selectedQuestion}
                  >
                    {!selectedQuestion && <option value="">No screen selected</option>}
                    {selectedQuestion && (
                      <>
                        <option value="question">Question</option>
                        {schema.questions.some((q) => q.category === 'Welcome Screen') && (
                          <option value="welcome">Welcome Screen</option>
                        )}
                        <option value="details">Details Screen</option>
                        {schema.questions.some((q) => q.category === 'End Screen') && (
                          <option value="end">End Screen</option>
                        )}
                      </>
                    )}
                  </select>
                </div>

                <div className="-mx-4 h-0.5 bg-white/80" />

                {selectedQuestion && (
                  <>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        handleMediaUpload(file);
                      }}
                    />
                    <div className="text-sm font-medium text-gray-600">Question properties</div>

                    {isSelectedWelcome || isSelectedEnd ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-600">Time to complete</div>
                          </div>
                          <Switch.Root
                            className="of-switch"
                            checked={Boolean(selectedSettings.showTimeToComplete)}
                            onCheckedChange={(checked) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                showTimeToComplete: checked,
                              }))
                            }
                          >
                            <Switch.Thumb className="of-switch-thumb" />
                          </Switch.Root>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-600">Number of submissions</div>
                          </div>
                          <Switch.Root
                            className="of-switch"
                            checked={Boolean(selectedSettings.showSubmissionCount)}
                            onCheckedChange={(checked) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                showSubmissionCount: checked,
                              }))
                            }
                          >
                            <Switch.Thumb className="of-switch-thumb" />
                          </Switch.Root>
                        </div>

                        <div>
                          <label className="of-label">Button</label>
                          <input
                            type="text"
                            value={
                              selectedSettings.buttonLabel ??
                              (isSelectedWelcome ? 'Start' : 'Finish')
                            }
                            onChange={(event) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                buttonLabel: event.target.value,
                              }))
                            }
                            className="of-input"
                          />
                        </div>

                        {isSelectedEnd && (
                          <div>
                            <label className="of-label">Footer text</label>
                            <textarea
                              rows={3}
                              value={selectedEndFooterText}
                              onChange={(event) =>
                                updateSelectedQuestionSettings((settings) => ({
                                  ...settings,
                                  footerText: event.target.value,
                                }))
                              }
                              className="of-input min-h-[88px] resize-y"
                              placeholder="Add optional footer text"
                            />
                            <div className="mt-1 text-xs leading-5 text-gray-500">
                              Leave this blank to remove the text below the end-screen button/message.
                            </div>
                          </div>
                        )}

                      <div className="pt-2 border-t border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Image or video</div>
                          <div className="flex items-center gap-2">
                            {selectedSettings.mediaUrl && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:text-red-700"
                                onClick={() =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    mediaUrl: undefined,
                                    mediaType: undefined,
                                  }))
                                }
                              >
                                Remove
                              </button>
                            )}
                            <button
                              type="button"
                              className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                              onClick={() => mediaInputRef.current?.click()}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {selectedSettings.mediaUrl && (
                          <>
                            <div>
                              <label className="of-label">Size</label>
                              <select
                                value={selectedSettings.mediaSize ?? 'medium'}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    mediaSize: event.target.value as 'xsmall' | 'small' | 'medium' | 'large',
                                  }))
                                }
                                className="of-input"
                              >
                                <option value="xsmall">Extra Small</option>
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>
                            <div>
                              <label className="of-label">Position</label>
                              <select
                                value={selectedSettings.mediaPosition ?? 'below'}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    mediaPosition: event.target.value as 'above' | 'below',
                                  }))
                                }
                                className="of-input"
                              >
                                <option value="above">Above title</option>
                                <option value="below">Below description</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                      </div>
                    ) : isSelectedDetails ? (
                      <div className="space-y-4">
                        <div>
                          <label className="of-label">Body text</label>
                          <textarea
                            rows={8}
                            value={selectedSettings.description ?? ''}
                            onChange={(event) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                description: event.target.value,
                              }))
                            }
                            className="of-input min-h-[180px] resize-y leading-6"
                            placeholder="Add context, instructions, or longer explanatory text..."
                          />
                        </div>

                        <div>
                          <label className="of-label">Button</label>
                          <input
                            type="text"
                            value={selectedSettings.buttonLabel ?? 'Continue'}
                            onChange={(event) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                buttonLabel: event.target.value,
                              }))
                            }
                            className="of-input"
                          />
                        </div>
                      </div>
                    ) : isSelectedGroup ? (
                      <div className="space-y-4">
                        <div>
                          <label className="of-label">Button</label>
                          <input
                            type="text"
                            value={selectedSettings.buttonLabel ?? 'Continue'}
                            onChange={(event) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                buttonLabel: event.target.value,
                              }))
                            }
                            className="of-input"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="text-sm text-gray-600">Image or video</div>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                            onClick={() => mediaInputRef.current?.click()}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="of-label">Answer</label>
                          <select
                            value={inferredAnswerType ?? 'multiple'}
                            onChange={(event) => {
                              if (!selectedQuestion) return;
                              const answerType = event.target.value as NonNullable<
                                FormQuestionSettings['answerType']
                              >;
                              updateQuestion(selectedQuestion.id, (question) => {
                                const settings = question.settings ?? {};
                                return {
                                  ...question,
                                  category: getCategoryForAnswerType(answerType),
                                  settings: {
                                    ...settings,
                                    answerType,
                                    kind: answerType,
                                    minNumberEnabled:
                                      answerType === 'number'
                                        ? settings.minNumberEnabled ?? true
                                        : settings.minNumberEnabled,
                                    minNumber:
                                      answerType === 'number'
                                        ? settings.minNumber ?? 1
                                        : settings.minNumber,
                                    maxNumberEnabled:
                                      answerType === 'number'
                                        ? settings.maxNumberEnabled ?? true
                                        : settings.maxNumberEnabled,
                                    maxNumber:
                                      answerType === 'number'
                                        ? settings.maxNumber ?? 5
                                        : settings.maxNumber,
                                  },
                                };
                              });
                            }}
                            className="of-input"
                          >
                            <option value="multiple">Multiple Choice</option>
                            <option value="yesno">Yes/No</option>
                            <option value="long">Text</option>
                            <option value="email">Email</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                          </select>
                        </div>

                        {inferredAnswerType === 'multiple' && (
                          <div>
                            <label className="of-label">Choice numbering</label>
                            <select
                              value={selectedSettings.choiceKeyStyle ?? 'letters'}
                              onChange={(event) =>
                                updateSelectedQuestionSettings((settings) => ({
                                  ...settings,
                                  choiceKeyStyle: event.target.value as NonNullable<
                                    FormQuestionSettings['choiceKeyStyle']
                                  >,
                                }))
                              }
                              className="of-input"
                            >
                              <option value="letters">Letters (A, B, C)</option>
                              <option value="numbers">Numbers (1, 2, 3)</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-3">
                          {questionToggleSettings
                            .filter(({ key }) => {
                              if (inferredAnswerType === 'yesno') {
                                return key === 'required';
                              }
                              if (inferredAnswerType === 'multiple') {
                                return key === 'required' || key === 'multipleSelection' || key === 'otherOption';
                              }
                              if (inferredAnswerType === 'long') {
                                return key === 'required';
                              }
                              if (inferredAnswerType === 'date') {
                                return key === 'required';
                              }
                              return key === 'required';
                            })
                            .map(({ label, key }) => (
                              <div className="flex items-center justify-between" key={key}>
                                <div className="text-sm text-gray-600">{label}</div>
                                <Switch.Root
                                  className="of-switch"
                                  checked={Boolean(selectedSettings[key])}
                                  onCheckedChange={(checked) =>
                                    updateSelectedQuestionSettings((settings) => ({
                                      ...settings,
                                      [key]: checked,
                                    }))
                                  }
                                >
                                  <Switch.Thumb className="of-switch-thumb" />
                                </Switch.Root>
                              </div>
                          ))}
                        </div>

                        {inferredAnswerType === 'long' && (
                          <div className="space-y-4">
                            <div>
                              <label className="of-label">Text format</label>
                              <select
                                value={selectedSettings.longTextFormat ?? 'paragraph'}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    longTextFormat: event.target.value as NonNullable<
                                      FormQuestionSettings['longTextFormat']
                                    >,
                                  }))
                                }
                                className="of-input"
                              >
                                <option value="paragraph">Paragraph text</option>
                                <option value="steps">Step list</option>
                                <option value="numbered">Numbered list</option>
                              </select>
                              <div className="mt-1 text-xs leading-5 text-gray-500">
                                Step list is for ordered process steps. Numbered list is for collecting multiple separate responses.
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-600">Max characters</div>
                              <Switch.Root
                                className="of-switch"
                                checked={Boolean(selectedSettings.maxCharactersEnabled)}
                                onCheckedChange={(checked) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    maxCharactersEnabled: checked,
                                  }))
                                }
                              >
                                <Switch.Thumb className="of-switch-thumb" />
                              </Switch.Root>
                            </div>
                            {selectedSettings.maxCharactersEnabled && (
                              <input
                                type="number"
                                min={0}
                                value={selectedSettings.maxCharacters ?? 0}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    maxCharacters: Number(event.target.value),
                                  }))
                                }
                                className="of-input"
                                placeholder="0-9999999999"
                              />
                            )}
                          </div>
                        )}

                        {inferredAnswerType === 'date' && (
                          <div className="space-y-3">
                            <div>
                              <label className="of-label">Date format</label>
                              <div className="flex gap-2">
                                <select
                                  value={selectedSettings.dateFormat ?? 'MMDDYYYY'}
                                  onChange={(event) =>
                                    updateSelectedQuestionSettings((settings) => ({
                                      ...settings,
                                      dateFormat: event.target.value as NonNullable<
                                        FormQuestionSettings['dateFormat']
                                      >,
                                    }))
                                  }
                                  className="of-input"
                                >
                                  <option value="MMDDYYYY">MMDDYYYY</option>
                                  <option value="DDMMYYYY">DDMMYYYY</option>
                                  <option value="YYYYMMDD">YYYYMMDD</option>
                                </select>
                                <select
                                  value={selectedSettings.dateSeparator ?? '/'}
                                  onChange={(event) =>
                                    updateSelectedQuestionSettings((settings) => ({
                                      ...settings,
                                      dateSeparator: event.target.value as NonNullable<
                                        FormQuestionSettings['dateSeparator']
                                      >,
                                    }))
                                  }
                                  className="of-input w-16 text-center"
                                >
                                  <option value="/">/</option>
                                  <option value="-">-</option>
                                  <option value=".">.</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {inferredAnswerType === 'number' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-600">Min number</div>
                              <Switch.Root
                                className="of-switch"
                                checked={Boolean(selectedSettings.minNumberEnabled)}
                                onCheckedChange={(checked) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    minNumberEnabled: checked,
                                  }))
                                }
                              >
                                <Switch.Thumb className="of-switch-thumb" />
                              </Switch.Root>
                            </div>
                            {selectedSettings.minNumberEnabled && (
                              <input
                                type="number"
                                value={selectedSettings.minNumber ?? 0}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    minNumber: Number(event.target.value),
                                  }))
                                }
                                className="of-input"
                                placeholder="0"
                              />
                            )}

                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-600">Max number</div>
                              <Switch.Root
                                className="of-switch"
                                checked={Boolean(selectedSettings.maxNumberEnabled)}
                                onCheckedChange={(checked) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    maxNumberEnabled: checked,
                                  }))
                                }
                              >
                                <Switch.Thumb className="of-switch-thumb" />
                              </Switch.Root>
                            </div>
                            {selectedSettings.maxNumberEnabled && (
                              <input
                                type="number"
                                value={selectedSettings.maxNumber ?? 0}
                                onChange={(event) =>
                                  updateSelectedQuestionSettings((settings) => ({
                                    ...settings,
                                    maxNumber: Number(event.target.value),
                                  }))
                                }
                                className="of-input"
                                placeholder="0"
                              />
                            )}

                            {getNumberScaleOptions(selectedSettings).length > 0 && (
                              <div className="space-y-2 pt-2">
                                <div>
                                  <div className="text-sm font-medium text-gray-700">Scale labels</div>
                                  <div className="mt-1 text-xs leading-5 text-gray-500">
                                    Optional labels shown next to each numeric score. The saved answer remains the number.
                                  </div>
                                </div>
                                {getNumberScaleOptions(selectedSettings).map((option, index) => (
                                  <div key={`number-label-${option}`} className="flex items-center gap-3">
                                    <div className="h-8 w-8 shrink-0 rounded-md border border-blue-300 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                      {option}
                                    </div>
                                    <input
                                      type="text"
                                      value={selectedSettings.choices?.[index] ?? ''}
                                      onChange={(event) => {
                                        const nextLabel = event.target.value;
                                        updateSelectedQuestionSettings((settings) => {
                                          const optionCount = getNumberScaleOptions(settings).length;
                                          const labels = Array.from(
                                            { length: optionCount },
                                            (_, labelIndex) => settings.choices?.[labelIndex] ?? ''
                                          );
                                          labels[index] = nextLabel;
                                          return {
                                            ...settings,
                                            choices: labels,
                                          };
                                        });
                                      }}
                                      className="of-input"
                                      placeholder={`Label for ${option}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {getNumberScaleOptions(selectedSettings).length === 0 && (
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-gray-700">Unit choices</div>
                                    <div className="mt-1 text-xs leading-5 text-gray-500">
                                      Add optional units shown underneath the number input, such as days, weeks, or months.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                    onClick={() =>
                                      updateSelectedQuestionSettings((settings) => ({
                                        ...settings,
                                        numberUnitChoices: [...(settings.numberUnitChoices ?? []), ''],
                                      }))
                                    }
                                  >
                                    Add unit
                                  </button>
                                </div>
                                {(selectedSettings.numberUnitChoices ?? []).length > 0 && (
                                  <div className="space-y-2">
                                    {(selectedSettings.numberUnitChoices ?? []).map((unit, index) => (
                                      <div key={`number-unit-choice-${index}`} className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={unit}
                                          onChange={(event) =>
                                            updateSelectedQuestionSettings((settings) => ({
                                              ...settings,
                                              numberUnitChoices: (settings.numberUnitChoices ?? []).map(
                                                (item, itemIndex) =>
                                                  itemIndex === index ? event.target.value : item
                                              ),
                                            }))
                                          }
                                          className="of-input"
                                          placeholder={index === 0 ? 'Days' : 'Unit label'}
                                        />
                                        <button
                                          type="button"
                                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                                          onClick={() =>
                                            updateSelectedQuestionSettings((settings) => ({
                                              ...settings,
                                              numberUnitChoices: (settings.numberUnitChoices ?? []).filter(
                                                (_, itemIndex) => itemIndex !== index
                                              ),
                                            }))
                                          }
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {inferredAnswerType !== 'long' && (
                          <div>
                            <label className="of-label">Vertical alignment</label>
                            <select
                              value={selectedSettings.verticalAlignment ?? 'left'}
                              onChange={(event) =>
                                updateSelectedQuestionSettings((settings) => ({
                                  ...settings,
                                  verticalAlignment: event.target.value as NonNullable<
                                    FormQuestionSettings['verticalAlignment']
                                  >,
                                }))
                              }
                              className="of-input"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                            </select>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="text-sm text-gray-600">Image or video</div>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                            onClick={() => mediaInputRef.current?.click()}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Tabs.Content>

            <Tabs.Content value="branching">
              {selectedQuestion ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-600">Branching</div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="branching" className="text-sm text-gray-600">
                      Enable branching
                    </label>
                    <Switch.Root
                      id="branching"
                      className="of-switch"
                      checked={Boolean(selectedQuestion.branching)}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          updateQuestion(selectedQuestion.id, (question) => ({
                            ...question,
                            branching: undefined,
                          }));
                          return;
                        }
                        const nextId = getNextId(schema, selectedQuestion.id);
                        updateQuestion(selectedQuestion.id, (question) => ({
                          ...question,
                          branching: {
                            next: nextId,
                            conditions: [createDefaultBranchCondition(question, nextId)],
                          },
                        }));
                      }}
                    >
                      <Switch.Thumb className="of-switch-thumb" />
                    </Switch.Root>
                  </div>

                  {selectedQuestion.branching && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Conditions
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          onClick={() => {
                            const nextId = getNextId(schema, selectedQuestion.id);
                            updateQuestion(selectedQuestion.id, (question) => ({
                              ...question,
                              branching: {
                                ...(question.branching ?? {}),
                                conditions: [
                                  ...(question.branching?.conditions ?? []),
                                  createDefaultBranchCondition(question, nextId),
                                ],
                              },
                            }));
                          }}
                        >
                          Add condition
                        </button>
                      </div>

                      {(selectedQuestion.branching.conditions ?? []).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                          No conditions yet. Add one to route answers to a different step.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(selectedQuestion.branching.conditions ?? []).map((condition, index) => {
                            const answerType = inferQuestionAnswerType(selectedQuestion);
                            const operatorOptions = getBranchOperatorOptions(selectedQuestion);
                            const selectionOptions = getBranchSelectionOptions(selectedQuestion);
                            const usesSelectionBranching =
                              selectionOptions.length > 0 &&
                              (answerType === 'multiple' || answerType === 'number');
                            const selectionOperator = getBranchSelectionOperator(selectedQuestion);
                            const valueString =
                              typeof condition.when.value === 'number'
                                ? String(condition.when.value)
                                : typeof condition.when.value === 'boolean'
                                  ? condition.when.value
                                    ? 'true'
                                    : 'false'
                                  : (condition.when.value ?? '');

                            return (
                              <div
                                key={`branch-condition-${selectedQuestion.id}-${index}`}
                                className="space-y-3 rounded-2xl border border-gray-200 p-4"
                              >
                                <div className="space-y-3">
                                  <div>
                                    <label className="of-label">
                                      {usesSelectionBranching ? 'Answer option' : 'When'}
                                    </label>
                                    {answerType === 'yesno' ? (
                                      <select
                                        value={condition.when.answer ? 'yes' : 'no'}
                                        onChange={(event) => {
                                          const nextAnswer = event.target.value === 'yes';
                                          updateQuestion(selectedQuestion.id, (question) => ({
                                            ...question,
                                            branching: {
                                              ...(question.branching ?? {}),
                                              conditions: (question.branching?.conditions ?? []).map(
                                                (entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? { ...entry, when: { answer: nextAnswer } }
                                                    : entry
                                              ),
                                            },
                                          }));
                                        }}
                                        className="of-input"
                                      >
                                        <option value="yes">Answer is Yes</option>
                                        <option value="no">Answer is No</option>
                                      </select>
                                    ) : usesSelectionBranching ? (
                                      <select
                                        value={selectionOptions.includes(valueString) ? valueString : selectionOptions[0]}
                                        onChange={(event) => {
                                          const nextValue = event.target.value;
                                          updateQuestion(selectedQuestion.id, (question) => ({
                                            ...question,
                                            branching: {
                                              ...(question.branching ?? {}),
                                              conditions: (question.branching?.conditions ?? []).map(
                                                (entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? {
                                                        ...entry,
                                                        when: {
                                                          operator: getBranchSelectionOperator(question),
                                                          value: nextValue,
                                                        },
                                                      }
                                                    : entry
                                              ),
                                            },
                                          }));
                                        }}
                                        className="of-input"
                                      >
                                        {selectionOptions.map((option) => (
                                          <option key={`${selectedQuestion.id}-${option}`} value={option}>
                                            {selectionOperator === 'contains'
                                              ? `Selection includes ${option}`
                                              : option}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <select
                                        value={condition.when.operator ?? 'equals'}
                                        onChange={(event) => {
                                          const operator = event.target.value as FormBranchOperator;
                                          updateQuestion(selectedQuestion.id, (question) => ({
                                            ...question,
                                            branching: {
                                              ...(question.branching ?? {}),
                                              conditions: (question.branching?.conditions ?? []).map(
                                                (entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? {
                                                        ...entry,
                                                        when: {
                                                          operator,
                                                          value:
                                                            operator === 'is_empty' ||
                                                            operator === 'not_empty'
                                                              ? undefined
                                                              : entry.when.value ??
                                                                (answerType === 'number'
                                                                  ? 0
                                                                  : question.settings?.choices?.[0] ??
                                                                    ''),
                                                        },
                                                      }
                                                    : entry
                                              ),
                                            },
                                          }));
                                        }}
                                        className="of-input"
                                      >
                                        {operatorOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>

                                  {!usesSelectionBranching && (
                                  <div>
                                    <label className="of-label">Value</label>
                                    {answerType === 'yesno' ? (
                                      <div className="of-input flex items-center text-gray-400">
                                        Not required
                                      </div>
                                    ) : !conditionNeedsValue(condition) ? (
                                      <div className="of-input flex items-center text-gray-400">
                                        Not required
                                      </div>
                                    ) : answerType === 'number' ? (
                                      <input
                                        type="number"
                                        value={valueString}
                                        onChange={(event) => {
                                          const nextValue = Number(event.target.value);
                                          updateQuestion(selectedQuestion.id, (question) => ({
                                            ...question,
                                            branching: {
                                              ...(question.branching ?? {}),
                                              conditions: (question.branching?.conditions ?? []).map(
                                                (entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? {
                                                        ...entry,
                                                        when: {
                                                          ...entry.when,
                                                          value: Number.isFinite(nextValue)
                                                            ? nextValue
                                                            : 0,
                                                        },
                                                      }
                                                    : entry
                                              ),
                                            },
                                          }));
                                        }}
                                        className="of-input"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={valueString}
                                        onChange={(event) => {
                                          const nextValue = event.target.value;
                                          updateQuestion(selectedQuestion.id, (question) => ({
                                            ...question,
                                            branching: {
                                              ...(question.branching ?? {}),
                                              conditions: (question.branching?.conditions ?? []).map(
                                                (entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? {
                                                        ...entry,
                                                        when: { ...entry.when, value: nextValue },
                                                      }
                                                    : entry
                                              ),
                                            },
                                          }));
                                        }}
                                        className="of-input"
                                        placeholder="Comparison value"
                                      />
                                    )}
                                  </div>
                                  )}

                                  <div>
                                    <label className="of-label">Go to</label>
                                    <select
                                      value={condition.next}
                                      onChange={(event) => {
                                        const nextValue = Number(event.target.value);
                                        updateQuestion(selectedQuestion.id, (question) => ({
                                          ...question,
                                          branching: {
                                            ...(question.branching ?? {}),
                                            conditions: (question.branching?.conditions ?? []).map(
                                              (entry, entryIndex) =>
                                                entryIndex === index
                                                  ? { ...entry, next: nextValue }
                                                  : entry
                                            ),
                                          },
                                        }));
                                      }}
                                      className="of-input"
                                    >
                                      {questionOptions.map((option) => (
                                        <option key={`condition-next-${index}-${option.id}`} value={option.id}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        updateQuestion(selectedQuestion.id, (question) => ({
                                          ...question,
                                          branching: {
                                            ...(question.branching ?? {}),
                                            conditions: (question.branching?.conditions ?? []).filter(
                                              (_, entryIndex) => entryIndex !== index
                                            ),
                                          },
                                        }));
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div>
                        <label className="of-label">Default next</label>
                        <select
                          value={selectedQuestion.branching.next ?? ''}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            updateQuestion(selectedQuestion.id, (question) => ({
                              ...question,
                              branching: {
                                ...(question.branching ?? {}),
                                next: nextValue,
                              },
                            }));
                          }}
                          className="of-input"
                        >
                          {questionOptions.map((option) => (
                            <option key={`next-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Select a question to configure branching.</div>
              )}
            </Tabs.Content>

            <Tabs.Content value="loops">
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-medium text-gray-700">Repeat loops</div>
                  <div className="mt-1 text-xs leading-5 text-gray-500">
                    Define a span of the form that can be repeated as a new answer instance, such as multiple processes in one submission.
                  </div>
                </div>

                {(schema.repeatLoops ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                    No repeat loops configured yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(schema.repeatLoops ?? []).map((loop, index) => (
                      <div key={loop.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-800">
                            {loop.label || `Loop ${index + 1}`}
                          </div>
                          <button
                            type="button"
                            className="text-sm text-red-600 hover:text-red-700"
                            onClick={() =>
                              setSchema((prev) => ({
                                ...prev,
                                repeatLoops: (prev.repeatLoops ?? []).filter((item) => item.id !== loop.id),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="of-label">Singular label</label>
                            <input
                              type="text"
                              value={loop.label}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id ? { ...item, label: event.target.value } : item
                                  ),
                                }))
                              }
                              className="of-input"
                              placeholder="Process"
                            />
                          </div>
                          <div>
                            <label className="of-label">Plural label</label>
                            <input
                              type="text"
                              value={loop.pluralLabel ?? ''}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id ? { ...item, pluralLabel: event.target.value } : item
                                  ),
                                }))
                              }
                              className="of-input"
                              placeholder="Processes"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="of-label">Loop starts at</label>
                            <select
                              value={loop.startQuestionId}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id
                                      ? { ...item, startQuestionId: Number(event.target.value) }
                                      : item
                                  ),
                                }))
                              }
                              className="of-input"
                            >
                              {questionOptions.map((option) => (
                                <option key={`loop-start-${loop.id}-${option.id}`} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="of-label">Loop ends after</label>
                            <select
                              value={loop.endQuestionId}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id ? { ...item, endQuestionId: Number(event.target.value) } : item
                                  ),
                                }))
                              }
                              className="of-input"
                            >
                              {questionOptions.map((option) => (
                                <option key={`loop-end-${loop.id}-${option.id}`} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="of-label">After loop continue to</label>
                            <select
                              value={loop.exitQuestionId ?? ''}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id
                                      ? {
                                          ...item,
                                          exitQuestionId: event.target.value ? Number(event.target.value) : undefined,
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="of-input"
                            >
                              <option value="">Next/end screen</option>
                              {questionOptions.map((option) => (
                                <option key={`loop-exit-${loop.id}-${option.id}`} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="of-label">Summary title answer</label>
                            <select
                              value={loop.titleQuestionId ?? ''}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id
                                      ? {
                                          ...item,
                                          titleQuestionId: event.target.value ? Number(event.target.value) : undefined,
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="of-input"
                            >
                              <option value="">Use Process 1, Process 2...</option>
                              {schema.questions
                                .filter((question) => inferQuestionAnswerType(question) !== 'yesno')
                                .map((question, questionIndex) => (
                                  <option key={`loop-title-${loop.id}-${question.id}`} value={question.id}>
                                    {getQuestionDisplayLabel(question, questionIndex)} - {question.text}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="of-label">Add another button</label>
                            <input
                              type="text"
                              value={loop.addAnotherLabel ?? ''}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id ? { ...item, addAnotherLabel: event.target.value } : item
                                  ),
                                }))
                              }
                              className="of-input"
                              placeholder={`Add another ${loop.label.toLowerCase() || 'item'}`}
                            />
                          </div>
                          <div>
                            <label className="of-label">Continue button</label>
                            <input
                              type="text"
                              value={loop.continueLabel ?? ''}
                              onChange={(event) =>
                                setSchema((prev) => ({
                                  ...prev,
                                  repeatLoops: (prev.repeatLoops ?? []).map((item) =>
                                    item.id === loop.id ? { ...item, continueLabel: event.target.value } : item
                                  ),
                                }))
                              }
                              className="of-input"
                              placeholder="Continue"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                  disabled={schema.questions.length < 2}
                  onClick={() => {
                    const firstFlow = schema.questions.find((question) => question.category !== 'Welcome Screen');
                    const lastFlow = [...schema.questions]
                      .reverse()
                      .find((question) => question.category !== 'End Screen');
                    if (!firstFlow || !lastFlow) return;
                    const id = `loop-${Date.now()}`;
                    setSchema((prev) => ({
                      ...prev,
                      repeatLoops: [
                        ...(prev.repeatLoops ?? []),
                        {
                          id,
                          label: 'Process',
                          pluralLabel: 'Processes',
                          startQuestionId: firstFlow.id,
                          endQuestionId: lastFlow.id,
                          addAnotherLabel: 'Add another process',
                          continueLabel: 'Continue',
                        },
                      ],
                    }));
                  }}
                >
                  Add repeat loop
                </button>
              </div>
            </Tabs.Content>

            <Tabs.Content value="theme">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-600">Design</div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Scoring framework</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        Enable weighted answers and score-based result bands for assessment forms.
                      </div>
                    </div>
                    <Switch.Root
                      className="of-switch"
                      checked={scoringEnabled}
                      onCheckedChange={(checked) =>
                        setSchema((prev) => ({
                          ...prev,
                          scoringEnabled: checked,
                          results:
                            checked && prev.results.length === 0
                              ? baseResults
                              : prev.results,
                        }))
                      }
                    >
                      <Switch.Thumb className="of-switch-thumb" />
                    </Switch.Root>
                  </div>
                </div>
                <div>
                  <label className="of-label">Primary color</label>
                  <input
                    type="color"
                    value={schema.theme?.primaryColor ?? defaultTheme.primaryColor}
                    onChange={(event) =>
                      setSchema((prev) => ({
                        ...prev,
                        theme: {
                          ...defaultTheme,
                          ...(prev.theme ?? {}),
                          primaryColor: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-full border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="of-label">Background color</label>
                  <input
                    type="color"
                    value={schema.theme?.backgroundColor ?? defaultTheme.backgroundColor}
                    onChange={(event) =>
                      setSchema((prev) => ({
                        ...prev,
                        theme: {
                          ...defaultTheme,
                          ...(prev.theme ?? {}),
                          backgroundColor: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-full border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="of-label">Text color</label>
                  <input
                    type="color"
                    value={schema.theme?.textColor ?? defaultTheme.textColor}
                    onChange={(event) =>
                      setSchema((prev) => ({
                        ...prev,
                        theme: {
                          ...defaultTheme,
                          ...(prev.theme ?? {}),
                          textColor: event.target.value,
                        },
                      }))
                    }
                    className="h-10 w-full border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="of-label">Font family</label>
                  <input
                    type="text"
                    value={schema.theme?.fontFamily ?? defaultTheme.fontFamily}
                    onChange={(event) =>
                      setSchema((prev) => ({
                        ...prev,
                        theme: {
                          ...defaultTheme,
                          ...(prev.theme ?? {}),
                          fontFamily: event.target.value,
                        },
                      }))
                    }
                    className="of-input"
                  />
                </div>
                <div>
                  <label className="of-label">Logo URL (optional)</label>
                  <input
                    type="text"
                    value={schema.theme?.logoUrl ?? ''}
                    onChange={(event) =>
                      setSchema((prev) => ({
                        ...prev,
                        theme: {
                          ...defaultTheme,
                          ...(prev.theme ?? {}),
                          logoUrl: event.target.value,
                        },
                      }))
                    }
                    className="of-input"
                  />
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="results">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-600">Results</div>
                {resultOptions.length === 0 && (
                  <div className="text-sm text-gray-500">No results yet.</div>
                )}
                {resultOptions.map((result, index) => (
                  <div key={`${result.label}-${index}`} className="border border-gray-200 rounded-md p-3 space-y-2">
                    <div className="text-xs text-gray-500">Result {index + 1}</div>
                    <input
                      type="text"
                      value={result.label}
                      onChange={(event) => {
                        const nextResults = schema.results.map((entry, idx) =>
                          idx === index ? { ...entry, label: event.target.value } : entry
                        );
                        setSchema((prev) => ({ ...prev, results: nextResults }));
                      }}
                      className="of-input"
                      placeholder="Label"
                    />
                    <textarea
                      value={result.description}
                      onChange={(event) => {
                        const nextResults = schema.results.map((entry, idx) =>
                          idx === index ? { ...entry, description: event.target.value } : entry
                        );
                        setSchema((prev) => ({ ...prev, results: nextResults }));
                      }}
                      rows={3}
                      className="of-textarea"
                      placeholder="Description"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={result.minScore ?? ''}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          const nextResults = schema.results.map((entry, idx) =>
                            idx === index ? { ...entry, minScore: nextValue } : entry
                          );
                          setSchema((prev) => ({ ...prev, results: nextResults }));
                        }}
                        className="of-input"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        value={result.maxScore ?? ''}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          const nextResults = schema.results.map((entry, idx) =>
                            idx === index ? { ...entry, maxScore: nextValue } : entry
                          );
                          setSchema((prev) => ({ ...prev, results: nextResults }));
                        }}
                        className="of-input"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Tabs.Content>

            <Tabs.Content value="share">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-600">Share</div>
                <div className="text-sm text-gray-600">
                  Public link: <span className="font-medium text-gray-800">{publicLink}</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Embed script (inline)</div>
                  <pre className="text-xs bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto">
{embedScript}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Embed script (fullscreen)</div>
                  <pre className="text-xs bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto">
{embedScriptFullscreen}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Inline iframe</div>
                  <pre className="text-xs bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto">
{inlineEmbed}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Fullscreen iframe</div>
                  <pre className="text-xs bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto">
{fullscreenEmbed}
                  </pre>
                </div>
              </div>
            </Tabs.Content>
          </div>
            </aside>
            )}
          </div>
        </div>
      </div>
    </Tabs.Root>
  );
};

export default Builder;
