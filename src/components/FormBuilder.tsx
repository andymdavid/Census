import React from 'react';
import type { FormBranchCondition, FormSchemaV0 } from '../types/formSchema';

interface FormBuilderProps {
  schema: FormSchemaV0;
  onChange: (schema: FormSchemaV0) => void;
}

const ensureNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const updateQuestion = (
  schema: FormSchemaV0,
  questionId: number,
  updater: (question: FormSchemaV0['questions'][number]) => FormSchemaV0['questions'][number]
) => {
  const questions = schema.questions.map((question) =>
    question.id === questionId ? updater(question) : question
  );
  return { ...schema, questions };
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const FormBuilder: React.FC<FormBuilderProps> = ({ schema, onChange }) => {
  const addQuestion = () => {
    const nextId = schema.questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;
    const nextQuestion = {
      id: nextId,
      text: '',
      weight: 0,
      category: '',
    };
    onChange({ ...schema, questions: [...schema.questions, nextQuestion] });
  };

  const removeQuestion = (id: number) => {
    onChange({ ...schema, questions: schema.questions.filter((question) => question.id !== id) });
  };

  const addCondition = (questionId: number) => {
    onChange(
      updateQuestion(schema, questionId, (question) => {
        const conditions = question.branching?.conditions ?? [];
        const nextCondition: FormBranchCondition = {
          when: { answer: true },
          next: question.id,
        };
        return {
          ...question,
          branching: {
            ...(question.branching ?? {}),
            conditions: [...conditions, nextCondition],
          },
        };
      })
    );
  };

  const removeCondition = (questionId: number, index: number) => {
    onChange(
      updateQuestion(schema, questionId, (question) => {
        const conditions = question.branching?.conditions ?? [];
        const nextConditions = conditions.filter((_, idx) => idx !== index);
        return {
          ...question,
          branching: {
            ...(question.branching ?? {}),
            conditions: nextConditions.length > 0 ? nextConditions : undefined,
          },
        };
      })
    );
  };

  const addResult = () => {
    const next = {
      label: '',
      description: '',
    };
    onChange({ ...schema, results: [...schema.results, next] });
  };

  const removeResult = (index: number) => {
    onChange({ ...schema, results: schema.results.filter((_, idx) => idx !== index) });
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="text-sm text-gray-400 mb-3 font-medium">Questions</div>
        <div className="space-y-6">
          {schema.questions.map((question, index) => (
            <div key={question.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">Question {index + 1} (ID {question.id})</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-800"
                    disabled={index === 0}
                    onClick={() =>
                      onChange({
                        ...schema,
                        questions: moveItem(schema.questions, index, index - 1),
                      })
                    }
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-800"
                    disabled={index === schema.questions.length - 1}
                    onClick={() =>
                      onChange({
                        ...schema,
                        questions: moveItem(schema.questions, index, index + 1),
                      })
                    }
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-800"
                    onClick={() => removeQuestion(question.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Text</label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(event) =>
                      onChange(
                        updateQuestion(schema, question.id, (current) => ({
                          ...current,
                          text: event.target.value,
                        }))
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Category</label>
                    <input
                      type="text"
                      value={question.category}
                      onChange={(event) =>
                        onChange(
                          updateQuestion(schema, question.id, (current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Weight</label>
                    <input
                      type="number"
                      value={question.weight}
                      onChange={(event) =>
                        onChange(
                          updateQuestion(schema, question.id, (current) => ({
                            ...current,
                            weight: Number(event.target.value),
                          }))
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Next (default)</label>
                    <input
                      type="number"
                      value={question.branching?.next ?? ''}
                      onChange={(event) =>
                        onChange(
                          updateQuestion(schema, question.id, (current) => ({
                            ...current,
                            branching: {
                              ...(current.branching ?? {}),
                              next: ensureNumber(event.target.value),
                            },
                          }))
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-600">Branching conditions</div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:text-primary/80"
                      onClick={() => addCondition(question.id)}
                    >
                      Add condition
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(question.branching?.conditions ?? []).length === 0 && (
                      <div className="text-xs text-gray-400">No conditions.</div>
                    )}
                    {(question.branching?.conditions ?? []).map((condition, conditionIndex) => (
                      <div
                        key={`${question.id}-condition-${conditionIndex}`}
                        className="flex flex-col md:flex-row md:items-center gap-2"
                      >
                        <select
                          value={condition.when.answer ? 'yes' : 'no'}
                          onChange={(event) => {
                            const answerValue = event.target.value === 'yes';
                            onChange(
                              updateQuestion(schema, question.id, (current) => {
                                const conditions = current.branching?.conditions ?? [];
                                const nextConditions = conditions.map((entry, idx) =>
                                  idx === conditionIndex
                                    ? { ...entry, when: { answer: answerValue } }
                                    : entry
                                );
                                return {
                                  ...current,
                                  branching: {
                                    ...(current.branching ?? {}),
                                    conditions: nextConditions,
                                  },
                                };
                              })
                            );
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                        <input
                          type="number"
                          value={condition.next}
                          onChange={(event) => {
                            const nextValue = ensureNumber(event.target.value) ?? 0;
                            onChange(
                              updateQuestion(schema, question.id, (current) => {
                                const conditions = current.branching?.conditions ?? [];
                                const nextConditions = conditions.map((entry, idx) =>
                                  idx === conditionIndex
                                    ? { ...entry, next: nextValue }
                                    : entry
                                );
                                return {
                                  ...current,
                                  branching: {
                                    ...(current.branching ?? {}),
                                    conditions: nextConditions,
                                  },
                                };
                              })
                            );
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Next question ID"
                        />
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:text-red-800"
                          onClick={() => removeCondition(question.id, conditionIndex)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="mt-4 text-sm font-medium text-primary hover:text-primary/80"
        >
          Add question
        </button>
      </div>

      <div>
        <div className="text-sm text-gray-400 mb-3 font-medium">Results thresholds</div>
        <div className="space-y-6">
          {schema.results.map((result, index) => (
            <div key={`result-${index}`} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">Result {index + 1}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-800"
                    disabled={index === 0}
                    onClick={() =>
                      onChange({
                        ...schema,
                        results: moveItem(schema.results, index, index - 1),
                      })
                    }
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-800"
                    disabled={index === schema.results.length - 1}
                    onClick={() =>
                      onChange({
                        ...schema,
                        results: moveItem(schema.results, index, index + 1),
                      })
                    }
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-800"
                    onClick={() => removeResult(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Label</label>
                  <input
                    type="text"
                    value={result.label}
                    onChange={(event) => {
                      const nextResults = schema.results.map((entry, idx) =>
                        idx === index ? { ...entry, label: event.target.value } : entry
                      );
                      onChange({ ...schema, results: nextResults });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Min score</label>
                    <input
                      type="number"
                      value={result.minScore ?? ''}
                      onChange={(event) => {
                        const nextValue = ensureNumber(event.target.value);
                        const nextResults = schema.results.map((entry, idx) =>
                          idx === index ? { ...entry, minScore: nextValue } : entry
                        );
                        onChange({ ...schema, results: nextResults });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Max score</label>
                    <input
                      type="number"
                      value={result.maxScore ?? ''}
                      onChange={(event) => {
                        const nextValue = ensureNumber(event.target.value);
                        const nextResults = schema.results.map((entry, idx) =>
                          idx === index ? { ...entry, maxScore: nextValue } : entry
                        );
                        onChange({ ...schema, results: nextResults });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
                  <textarea
                    value={result.description}
                    onChange={(event) => {
                      const nextResults = schema.results.map((entry, idx) =>
                        idx === index ? { ...entry, description: event.target.value } : entry
                      );
                      onChange({ ...schema, results: nextResults });
                    }}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addResult}
          className="mt-4 text-sm font-medium text-primary hover:text-primary/80"
        >
          Add result threshold
        </button>
      </div>
    </div>
  );
};

export default FormBuilder;
