import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Questions from './Questions';
import type { FormSchemaV0 } from '../types/formSchema';
import type { LoadedFormSchema } from '../types/formSchema';
import * as Tabs from '@radix-ui/react-tabs';
import * as Switch from '@radix-ui/react-switch';

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
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [schema, setSchema] = useState<FormSchemaV0>(emptySchema);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [previewStep, setPreviewStep] = useState<'intro' | 'questions'>('intro');
  const [showShare, setShowShare] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const publicLink = id ? `${origin}/f/${id}` : `${origin}/f/:id`;
  const inlineEmbed = `<iframe src="${publicLink}" style="width:100%;height:700px;border:0;" loading="lazy"></iframe>`;
  const fullscreenEmbed = `<iframe src="${publicLink}" style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;"></iframe>`;
  const embedScript = `<script src="${origin}/embed.js"></script>\n<div data-outform data-form-id="${id ?? ':id'}" data-mode="inline" data-height="700px"></div>`;
  const embedScriptFullscreen = `<script src="${origin}/embed.js"></script>\n<div data-outform data-form-id="${id ?? ':id'}" data-mode="fullscreen"></div>`;

  const validationErrors = useMemo(() => validateSchema(schema), [schema]);
  const previewForm: LoadedFormSchema = useMemo(
    () => ({ ...schema, totalScore: getTotalScore(schema) }),
    [schema]
  );

  const selectedQuestion = schema.questions.find((question) => question.id === selectedQuestionId);
  const questionOptions = schema.questions.map((question) => question.id);
  const resultOptions = schema.results;

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

  const addQuestion = () => {
    const nextId = schema.questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;
    const nextQuestion = {
      id: nextId,
      text: 'New question',
      weight: 0,
      category: 'General',
    };
    setSchema((prev) => ({ ...prev, questions: [...prev.questions, nextQuestion] }));
    setSelectedQuestionId(nextId);
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
    <div className="min-h-screen flex flex-col bg-white">
      <div className="border-b border-gray-200 px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-gray-400">Builder</div>
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSchema((prev) => ({ ...prev, title: event.target.value }));
            }}
            className="text-2xl font-semibold text-gray-800 focus:outline-none"
            placeholder="Untitled form"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-500">
            Status: {published ? 'Published' : 'Draft'}
          </div>
          <button
            type="button"
            onClick={handlePublish}
            className="text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-400"
            disabled={isNew || published || status === 'saving'}
          >
            {published ? 'Published' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => setShowShare((prev) => !prev)}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="typeform-button"
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

      <div className="flex flex-1 min-h-0">
        <aside className="w-72 border-r border-gray-200 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Questions</div>
            <button
              type="button"
              className="text-xs text-primary hover:text-primary/80"
              onClick={addQuestion}
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {schema.questions.length === 0 && (
              <div className="text-sm text-gray-500">No questions yet.</div>
            )}
            {schema.questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setSelectedQuestionId(question.id)}
                className={`w-full text-left border rounded-md p-3 transition ${
                  question.id === selectedQuestionId
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-800">Q{question.id}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <button
                      type="button"
                      className="hover:text-gray-600"
                      disabled={index === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveQuestion(index, index - 1);
                      }}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="hover:text-gray-600"
                      disabled={index === schema.questions.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveQuestion(index, index + 1);
                      }}
                    >
                      Down
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">{question.text}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden" style={themeStyles}>
            {schema.questions.length === 0 ? (
              <div className="min-h-[520px] flex flex-col items-center justify-center text-center px-6 py-12">
                <h3 className="text-xl font-semibold mb-2 text-gray-800">No questions yet</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Add a question on the left to see the live preview.
                </p>
              </div>
            ) : schema.description?.trim() && previewStep === 'intro' ? (
              <div className="min-h-[520px] flex flex-col items-center justify-center text-center px-6 py-12">
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
              <div className="min-h-[520px]">
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
          <Tabs.Root defaultValue="form" className="of-tabs">
            <Tabs.List className="of-tabs-list">
              <Tabs.Trigger className="of-tabs-trigger" value="form">
                Form
              </Tabs.Trigger>
              <Tabs.Trigger className="of-tabs-trigger" value="question">
                Question
              </Tabs.Trigger>
              <Tabs.Trigger className="of-tabs-trigger" value="branching">
                Branching
              </Tabs.Trigger>
              <Tabs.Trigger className="of-tabs-trigger" value="theme">
                Theme
              </Tabs.Trigger>
              <Tabs.Trigger className="of-tabs-trigger" value="results">
                Results
              </Tabs.Trigger>
              <Tabs.Trigger className="of-tabs-trigger" value="share">
                Share
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="form">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">Form settings</div>
                  <label className="of-label">Description</label>
                  <textarea
                    value={schema.description ?? ''}
                    onChange={(event) =>
                      setSchema((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={3}
                    className="of-textarea"
                  />
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="question">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-600">Question properties</div>
                {selectedQuestion ? (
                  <div className="space-y-3">
                    <div>
                      <label className="of-label">Question text</label>
                      <input
                        type="text"
                        value={selectedQuestion.text}
                        onChange={(event) =>
                          updateQuestion(selectedQuestion.id, (question) => ({
                            ...question,
                            text: event.target.value,
                          }))
                        }
                        className="of-input"
                      />
                    </div>
                    <div>
                      <label className="of-label">Category</label>
                      <input
                        type="text"
                        value={selectedQuestion.category}
                        onChange={(event) =>
                          updateQuestion(selectedQuestion.id, (question) => ({
                            ...question,
                            category: event.target.value,
                          }))
                        }
                        className="of-input"
                      />
                    </div>
                    <div>
                      <label className="of-label">Weight</label>
                      <input
                        type="number"
                        value={selectedQuestion.weight}
                        onChange={(event) =>
                          updateQuestion(selectedQuestion.id, (question) => ({
                            ...question,
                            weight: Number(event.target.value),
                          }))
                        }
                        className="of-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-800"
                      onClick={() => removeQuestion(selectedQuestion.id)}
                    >
                      Remove question
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Select a question to edit.</div>
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
                <div className="text-sm font-medium text-gray-600">Theme</div>
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
          </Tabs.Root>
        </aside>
      </div>
    </div>
  );
};

export default Builder;
