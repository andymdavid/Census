import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Questions from './Questions';
import type { FormQuestionSettings, FormSchemaV0 } from '../types/formSchema';
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
  ListChecks,
  Mail,
  MessageSquareText,
  MoreVertical,
  Palette,
  Text,
  TextCursorInput,
  ToggleLeft,
} from 'lucide-react';

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
    questions: overrides.questions ?? [],
    results: overrides.results ?? baseResults,
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
];

const validateSchema = (schema: FormSchemaV0) => {
  const errors: string[] = [];
  const ids = schema.questions.map((question) => question.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push('Question IDs must be unique.');
  }
  schema.questions.forEach((question) => {
    if (!question.text.trim()) {
      errors.push(`Question ${question.id} is missing text.`);
    }
    if (!question.category.trim()) {
      errors.push(`Question ${question.id} is missing a category.`);
    }
    if (!Number.isFinite(question.weight)) {
      errors.push(`Question ${question.id} has an invalid weight.`);
    }
    const branching = question.branching;
    if (branching?.next !== undefined && !uniqueIds.has(branching.next)) {
      errors.push(`Question ${question.id} has an invalid default next target.`);
    }
    branching?.conditions?.forEach((condition, index) => {
      if (!uniqueIds.has(condition.next)) {
        errors.push(`Question ${question.id} condition ${index + 1} has an invalid next target.`);
      }
    });
  });

  schema.results.forEach((result, index) => {
    if (!result.label.trim()) {
      errors.push(`Result ${index + 1} is missing a label.`);
    }
    if (!result.description.trim()) {
      errors.push(`Result ${index + 1} is missing a description.`);
    }
    if (
      result.minScore !== undefined &&
      result.maxScore !== undefined &&
      result.minScore > result.maxScore
    ) {
      errors.push(`Result ${index + 1} has min score greater than max score.`);
    }
  });

  return errors;
};

const getTotalScore = (schema: FormSchemaV0) =>
  schema.questions.reduce((sum, question) => sum + question.weight, 0);

const getNextId = (schema: FormSchemaV0, id: number) => {
  const index = schema.questions.findIndex((question) => question.id === id);
  if (index === -1) return schema.questions[0]?.id ?? id;
  return schema.questions[index + 1]?.id ?? schema.questions[index]?.id ?? id;
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
  const [activeTab, setActiveTab] = useState<
    'form' | 'question' | 'branching' | 'theme' | 'results' | 'share'
  >('question');
  const [previewStep, setPreviewStep] = useState<'intro' | 'questions'>('intro');
  const [showShare, setShowShare] = useState(false);
  const [creating, setCreating] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const publicLink = id ? `${origin}/f/${id}` : `${origin}/f/:id`;
  const inlineEmbed = `<iframe src="${publicLink}" style="width:100%;height:700px;border:0;" loading="lazy"></iframe>`;
  const fullscreenEmbed = `<iframe src="${publicLink}" style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;"></iframe>`;
  const embedScript = `<script src="${origin}/embed.js"></script>\n<div data-census data-form-id="${id ?? ':id'}" data-mode="inline" data-height="700px"></div>`;
  const embedScriptFullscreen = `<script src="${origin}/embed.js"></script>\n<div data-census data-form-id="${id ?? ':id'}" data-mode="fullscreen"></div>`;

  const validationErrors = useMemo(() => validateSchema(schema), [schema]);
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
  const questionTitleRef = useRef<HTMLTextAreaElement | null>(null);
  const questionTitleMeasureRef = useRef<HTMLSpanElement | null>(null);
  const questionTitleContainerRef = useRef<HTMLDivElement | null>(null);
  const [questionTitleWidth, setQuestionTitleWidth] = useState<number | null>(null);

  const selectedQuestion = schema.questions.find((question) => question.id === selectedQuestionId);
  const questionOptions = schema.questions.map((question) => question.id);
  const resultOptions = schema.results;
  const isSelectedWelcome = selectedQuestion?.category === 'Welcome Screen';
  const isSelectedEnd = selectedQuestion?.category === 'End Screen';
  const isSelectedGroup = selectedQuestion?.category === 'Question Group';
  const selectedSettings = selectedQuestion?.settings ?? {};
  const inferredAnswerType =
    selectedSettings.answerType ??
    (selectedQuestion?.category === 'Multiple Choice'
      ? 'multiple'
      : selectedQuestion?.category === 'Yes/No'
        ? 'yesno'
        : selectedQuestion?.category === 'Text'
          ? 'long'
        : selectedQuestion?.category === 'Short Text'
            ? 'long'
            : selectedQuestion?.category === 'Email'
              ? 'email'
            : selectedQuestion?.category === 'Number'
                ? 'number'
                : selectedQuestion?.category === 'Date'
                  ? 'date'
                  : 'short');

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
        throw new Error('Failed to create form.');
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

  const addQuestionFromTemplate = (template: (typeof questionTypeTemplates)[number]) => {
    const nextId =
      schema.questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;
    const nextQuestion = {
      id: nextId,
      text: template.questionText,
      weight: 0,
      category: template.category,
      settings: {
        kind:
          template.key === 'welcome'
            ? 'welcome'
            : template.key === 'end'
              ? 'end'
              : template.key === 'group'
                ? 'group'
                : template.key === 'yesno'
                  ? 'yesno'
                : template.key === 'mc'
                  ? 'multiple'
                  : template.key === 'short'
                    ? 'short'
                    : template.key === 'long'
                      ? 'long'
                      : template.key === 'email'
                        ? 'email'
                        : template.key === 'number'
                          ? 'number'
                          : template.key === 'date'
                            ? 'date'
                            : undefined,
        answerType:
          template.key === 'mc'
            ? 'multiple'
            : template.key === 'yesno'
              ? 'yesno'
              : template.key === 'long'
                ? 'long'
                : template.key === 'email'
                  ? 'email'
                  : template.key === 'number'
                    ? 'number'
                    : template.key === 'date'
                      ? 'date'
                      : 'short',
        buttonLabel: template.key === 'welcome' ? 'Start' : template.key === 'end' ? 'Finish' : undefined,
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
    const nextQuestion = {
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
      const payload = {
        title: title.trim(),
        schema: {
          ...schema,
          title: title.trim(),
        },
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
          throw new Error('Failed to create form.');
        }

        const data = (await response.json()) as { id?: string };
        if (data.id) {
          setSchema((prev) => ({ ...prev, id: data.id }));
          navigate(`/forms/${data.id}/edit`);
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
          throw new Error('Failed to update form.');
        }
      }

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

    try {
      const response = await fetch(`/api/forms/${id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to publish form.');
      }
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
      <div className="h-14 px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-[260px]">
          <div className="text-[20px] text-gray-800 of-logo-text">Census</div>
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
            <Tabs.Trigger className="of-tabs-trigger" value="theme">
              Design
            </Tabs.Trigger>
            <Tabs.Trigger className="of-tabs-trigger" value="results">
              Results
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
            disabled={isNew || published || status === 'saving'}
          >
            {published ? 'Published' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => setShowShare((prev) => !prev)}
            className="h-[30px] text-xs text-gray-600 border border-gray-200 rounded-xl px-3 inline-flex items-center bg-white hover:bg-[#ededee] transition"
          >
            Share
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

      {showShare && (
        <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
          <div className="max-w-5xl space-y-3">
            <div className="text-sm text-gray-600">
              Public link: <span className="font-medium text-gray-800">{publicLink}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>
      )}

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
              const label = isWelcome ? 'Start screen' : isEnd ? 'End screen' : `Q${question.id}`;
              return (
              <button
                key={question.id}
                type="button"
                onClick={() => {
                  setSelectedQuestionId(question.id);
                  setActiveTab('question');
                }}
                className={`w-full text-left rounded-xl px-3 py-2 transition ${
                  question.id === selectedQuestionId
                    ? 'bg-[#ededee] text-gray-900'
                    : 'bg-white/70 text-gray-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{label}</div>
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
              </button>
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
                {schema.questions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">No questions yet</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                      Add a question on the left to see the live preview.
                    </p>
                  </div>
                ) : isSelectedWelcome || isSelectedEnd ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
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
                        {isSelectedEnd && !selectedSettings.showTimeToComplete && !selectedSettings.showSubmissionCount && (
                          <div>Thanks for taking part</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : selectedQuestion && !isSelectedWelcome && !isSelectedEnd ? (
                  <div className="h-full flex flex-col justify-center px-16 py-12">
                    <div
                      className={`w-full flex ${
                        inferredAnswerType === 'long'
                          ? 'justify-start'
                          : selectedSettings.verticalAlignment === 'center'
                            ? 'justify-center'
                            : 'justify-start'
                      }`}
                    >
                      <div
                        className={`w-full grid grid-cols-[36px_1fr] gap-3 ${
                          inferredAnswerType === 'long' ? 'max-w-none' : 'max-w-[400px]'
                        }`}
                      >
                        <div className="text-sm text-blue-600 font-medium leading-snug flex items-center gap-2 self-start mt-[6px]">
                          <span className="whitespace-nowrap">{selectedQuestion.id}</span>
                          <span className="whitespace-nowrap">→</span>
                      </div>
                      <div className="flex flex-col items-start text-left">
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

                      {selectedSettings.mediaUrl && (
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
                        <div className="mt-6 flex items-center gap-3">
                          <button
                            type="button"
                            className="px-6 py-3 rounded-md bg-[#1f3bb3] text-white text-xl font-semibold"
                          >
                            {selectedSettings.buttonLabel ?? 'Continue'}
                          </button>
                          <span className="text-sm text-gray-600">press Enter ↵</span>
                        </div>
                      ) : inferredAnswerType === 'multiple' ? (
                        <div className="flex flex-col gap-3 w-full items-start">
                          {[
                            ...(selectedSettings.choices ?? ['Choice A']),
                            ...(selectedSettings.otherOption ? ['Other'] : []),
                          ].map((choice, idx) => (
                            <div
                              key={`preview-choice-${idx}`}
                              className="flex items-center gap-3 w-full"
                            >
                              <div className="h-8 w-8 rounded-md border border-blue-300 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <input
                                type="text"
                                value={choice}
                                onChange={(event) =>
                                  updateSelectedChoices((choices) =>
                                    choices.map((item, itemIdx) =>
                                      itemIdx === idx ? event.target.value : item
                                    )
                                  )
                                }
                                className="min-w-[260px] rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
                                disabled={
                                  selectedSettings.otherOption &&
                                  idx === (selectedSettings.choices ?? ['Choice A']).length
                                }
                              />
                            </div>
                          ))}
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
                          <textarea
                            rows={1}
                            value=""
                            readOnly
                            className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none resize-none pointer-events-none p-0 leading-[1.1] h-[44px]"
                            style={{ fontSize: '28px' }}
                            placeholder="Type your answer here..."
                          />
                          <div className="text-sm text-blue-700" style={{ marginTop: '2px' }}>
                            <span className="font-medium">Shift</span> + Enter ↵ to make a line break
                          </div>
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
                                      <div className="text-[36px] text-blue-200 border-b border-blue-400 pb-2">{part}</div>
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
                            className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                            placeholder="name@example.com"
                          />
                        </div>
                      ) : inferredAnswerType === 'number' ? (
                        <div className="w-full">
                          <input
                            type="text"
                            value=""
                            readOnly
                            className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                            placeholder="Type your answer here..."
                          />
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
                            question.category === 'End Screen'
                              ? 'General'
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
                        category: nextType === 'welcome' ? 'Welcome Screen' : 'End Screen',
                        settings: {
                          ...(question.settings ?? {}),
                          kind: nextType === 'welcome' ? 'welcome' : 'end',
                          buttonLabel:
                            (question.settings ?? {}).buttonLabel ??
                            (nextType === 'welcome' ? 'Start' : 'Finish'),
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
                            onChange={(event) =>
                              updateSelectedQuestionSettings((settings) => ({
                                ...settings,
                                answerType: event.target.value as NonNullable<
                                  FormSchemaV0['questions'][number]['settings']
                                >['answerType'],
                              }))
                            }
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
                          <div className="space-y-2">
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
                          <div className="space-y-2">
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
                            conditions: [
                              { when: { answer: true }, next: nextId },
                              { when: { answer: false }, next: nextId },
                            ],
                          },
                        }));
                      }}
                    >
                      <Switch.Thumb className="of-switch-thumb" />
                    </Switch.Root>
                  </div>

                  {selectedQuestion.branching && (
                    <div className="space-y-3">
                      <div>
                        <label className="of-label">Yes →</label>
                        <select
                          value={
                            selectedQuestion.branching.conditions?.find((c) => c.when.answer)?.next ??
                            ''
                          }
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            updateQuestion(selectedQuestion.id, (question) => ({
                              ...question,
                              branching: {
                                ...(question.branching ?? {}),
                                conditions: [
                                  { when: { answer: true }, next: nextValue },
                                  {
                                    when: { answer: false },
                                    next:
                                      question.branching?.conditions?.find((c) => !c.when.answer)
                                        ?.next ?? nextValue,
                                  },
                                ],
                              },
                            }));
                          }}
                          className="of-input"
                        >
                          {questionOptions.map((option) => (
                            <option key={`yes-${option}`} value={option}>
                              Question {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="of-label">No →</label>
                        <select
                          value={
                            selectedQuestion.branching.conditions?.find((c) => !c.when.answer)?.next ??
                            ''
                          }
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            updateQuestion(selectedQuestion.id, (question) => ({
                              ...question,
                              branching: {
                                ...(question.branching ?? {}),
                                conditions: [
                                  {
                                    when: { answer: true },
                                    next:
                                      question.branching?.conditions?.find((c) => c.when.answer)
                                        ?.next ?? nextValue,
                                  },
                                  { when: { answer: false }, next: nextValue },
                                ],
                              },
                            }));
                          }}
                          className="of-input"
                        >
                          {questionOptions.map((option) => (
                            <option key={`no-${option}`} value={option}>
                              Question {option}
                            </option>
                          ))}
                        </select>
                      </div>

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
                            <option key={`next-${option}`} value={option}>
                              Question {option}
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

            <Tabs.Content value="theme">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-600">Design</div>
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
          </div>
        </div>
      </div>
    </Tabs.Root>
  );
};

export default Builder;
