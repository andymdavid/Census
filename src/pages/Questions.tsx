import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loadForm } from '../data/loadForm';
import type { LoadedFormSchema } from '../types/formSchema';
import {
  getFirstFlowQuestionId,
  getQuestionRangeIds,
  getRepeatLoopAfterQuestion,
  getRepeatLoopExitQuestionId,
  getRepeatLoopForQuestion,
  inferQuestionAnswerType,
  getNextQuestionId as getFormNextQuestionId,
  isAnswerableQuestion,
  isFlowQuestion,
  isScoringEnabled,
  type FormAnswerValue,
  type ResponsePathMeta,
} from '../../shared/formFlow';

type AnswerMap = Record<number, boolean | string | string[]>;
type RepeatInstanceMap = Record<string, AnswerMap[]>;

/**
 * Interface for Questions page props
 */
interface QuestionsProps {
  form?: LoadedFormSchema;
  formId?: string;
  onComplete?: (score: number) => void;
  previewMode?: boolean;
}

interface LocalDraftState {
  responseId: string | null;
  draftToken: string | null;
  currentQuestionId: number;
  answers: Record<number, boolean | string | string[]>;
  history: number[];
  showWelcome: boolean;
  repeatInstances: RepeatInstanceMap;
  loopSummaryId: string | null;
}

interface RemoteDraftState extends LocalDraftState {}

const getChoiceKey = (index: number, style: 'letters' | 'numbers' = 'letters') => {
  return style === 'numbers' ? String(index + 1) : String.fromCharCode(65 + index);
};

const isOtherAnswer = (value: string) => value.trim() === 'Other' || value.trim().startsWith('Other:');

const getOtherAnswerText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith('Other:') ? trimmed.slice('Other:'.length).trimStart() : '';
};

const normalizeChoiceForBranching = (value: string) => (isOtherAnswer(value) ? 'Other' : value);

const getNumberUnitChoices = (question: LoadedFormSchema['questions'][number] | undefined) => {
  return (question?.settings?.numberUnitChoices ?? []).map((unit) => unit.trim()).filter(Boolean);
};

const splitNumberAnswer = (
  question: LoadedFormSchema['questions'][number] | undefined,
  answer: boolean | string | string[] | undefined
) => {
  if (typeof answer !== 'string') {
    return { value: '', unit: '' };
  }
  const units = getNumberUnitChoices(question);
  const normalized = answer.trim();
  if (units.length === 0) {
    return { value: normalized, unit: '' };
  }
  const matchedUnit = [...units]
    .sort((left, right) => right.length - left.length)
    .find((unit) => normalized === unit || normalized.endsWith(` ${unit}`));
  if (!matchedUnit) {
    return { value: normalized, unit: '' };
  }
  return {
    value: normalized === matchedUnit
      ? ''
      : normalized.slice(0, normalized.length - matchedUnit.length).trim(),
    unit: matchedUnit,
  };
};

const composeNumberAnswer = (value: string, unit: string) => {
  const trimmedValue = value.trim();
  const trimmedUnit = unit.trim();
  if (!trimmedValue) return '';
  return trimmedUnit ? `${trimmedValue} ${trimmedUnit}` : trimmedValue;
};

const getDraftCookieName = (formId: string) => `census_draft_token_${formId}`;

const readDraftCookie = (formId: string) => {
  const cookieName = `${getDraftCookieName(formId)}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName));
  return match ? decodeURIComponent(match.slice(cookieName.length)) : null;
};

const writeDraftCookie = (formId: string, draftToken: string | null) => {
  const cookieName = getDraftCookieName(formId);
  if (!draftToken) {
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${cookieName}=${encodeURIComponent(draftToken)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
};

const serializeAnswerValue = (
  question: LoadedFormSchema['questions'][number] | undefined,
  answer: boolean | string | string[]
) => {
  if (Array.isArray(answer)) {
    if (
      question?.settings?.longTextFormat === 'steps' ||
      question?.settings?.longTextFormat === 'numbered' ||
      (question && inferQuestionAnswerType(question) === 'multiple')
    ) {
      return answer
        .map((item) => item.trim())
        .filter(Boolean)
        .join('\n');
    }
    return answer.join(', ');
  }
  if (typeof answer === 'string') return answer;
  return answer ? 'yes' : 'no';
};

/**
 * Questions page component
 * This page displays the assessment questions and collects user responses
 * with a Typeform-like aesthetic and animations
 */
const Questions: React.FC<QuestionsProps> = ({
  form: formOverride,
  formId,
  onComplete,
  previewMode = false,
}) => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();
  const form = formOverride ?? loadForm();
  const allQuestions = form.questions;
  const welcomeScreen = allQuestions.find((q) => q.category === 'Welcome Screen') ?? null;
  const endScreen = allQuestions.find((q) => q.category === 'End Screen') ?? null;
  const questions = allQuestions.filter(isAnswerableQuestion);
  const flowQuestions = allQuestions.filter(isFlowQuestion);
  const scoringEnabled = isScoringEnabled(form);
  const totalScore = scoringEnabled ? form.totalScore : 0;
  const logoUrl = form.theme?.logoUrl;
  const themeStyles = form.theme
    ? ({
        '--color-primary': form.theme.primaryColor,
        '--color-background': form.theme.backgroundColor,
        '--color-text': form.theme.textColor,
        fontFamily: form.theme.fontFamily,
      } as React.CSSProperties)
    : undefined;
  const questionMap = useMemo(
    () => new Map(allQuestions.map((question) => [question.id, question])),
    [allQuestions]
  );

  // State to track current question index
  const [currentQuestionId, setCurrentQuestionId] = useState(
    getFirstFlowQuestionId(form) ?? 0
  );
  // State to track user answers
  const [answers, setAnswers] = useState<Record<number, boolean | string | string[]>>({});
  const [responseId, setResponseId] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  // State to track history for branching
  const [history, setHistory] = useState<number[]>([]);
  // State to track direction of transition (forward/backward)
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  const [showWelcome, setShowWelcome] = useState(Boolean(welcomeScreen));
  const [showEnd, setShowEnd] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restoringDraft, setRestoringDraft] = useState(!previewMode && Boolean(formId));
  const [repeatInstances, setRepeatInstances] = useState<RepeatInstanceMap>({});
  const [loopSummaryId, setLoopSummaryId] = useState<string | null>(null);
  const draftStorageKey = formId ? `census.form-draft.${formId}` : null;
  const lastAutosaveSignatureRef = useRef<string | null>(null);

  const getLoopInstanceAnswers = (loopId: string, answersSnapshot: AnswerMap) => {
    const loop = form.repeatLoops?.find((item) => item.id === loopId);
    if (!loop) return {};
    const rangeIds = new Set(getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId));
    const instanceAnswers: AnswerMap = {};
    for (const [key, value] of Object.entries(answersSnapshot)) {
      const questionId = Number(key);
      if (rangeIds.has(questionId) && hasRecordedResponse(value)) {
        instanceAnswers[questionId] = value as boolean | string | string[];
      }
    }
    return instanceAnswers;
  };

  const getLoopInstanceTitle = (
    loopId: string,
    instanceAnswers: AnswerMap,
    fallbackIndex: number
  ) => {
    const loop = form.repeatLoops?.find((item) => item.id === loopId);
    const titleAnswer = loop?.titleQuestionId ? instanceAnswers[loop.titleQuestionId] : undefined;
    if (typeof titleAnswer === 'string' && titleAnswer.trim()) return titleAnswer.trim();
    if (Array.isArray(titleAnswer)) {
      const first = titleAnswer.find((item) => item.trim());
      if (first) return first.trim();
    }
    return `${loop?.label ?? 'Item'} ${fallbackIndex}`;
  };

  const getLoopSummaryInstances = (loopId: string, answersSnapshot = answers) => {
    const archived = repeatInstances[loopId] ?? [];
    const current = getLoopInstanceAnswers(loopId, answersSnapshot);
    return Object.keys(current).length > 0 ? [...archived, current] : archived;
  };

  const clearLoopAnswers = (loopId: string, answersSnapshot: AnswerMap) => {
    const loop = form.repeatLoops?.find((item) => item.id === loopId);
    if (!loop) return answersSnapshot;
    const rangeIds = new Set(getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId));
    const nextAnswers: AnswerMap = {};
    for (const [key, value] of Object.entries(answersSnapshot)) {
      if (!rangeIds.has(Number(key))) {
        nextAnswers[Number(key)] = value as boolean | string | string[];
      }
    }
    return nextAnswers;
  };

  const archiveLoopInstance = (loopId: string, answersSnapshot: AnswerMap) => {
    const instanceAnswers = getLoopInstanceAnswers(loopId, answersSnapshot);
    if (Object.keys(instanceAnswers).length === 0) {
      return repeatInstances[loopId] ?? [];
    }
    const nextInstances = [...(repeatInstances[loopId] ?? []), instanceAnswers];
    setRepeatInstances((prev) => ({ ...prev, [loopId]: nextInstances }));
    return nextInstances;
  };

  // Handle answer selection
  const hasAnswer = (value?: boolean | string | string[]) => {
    if (Array.isArray(value)) {
      return value.some((item) =>
        isOtherAnswer(item) ? getOtherAnswerText(item).trim().length > 0 : item.trim().length > 0
      );
    }
    if (typeof value === 'string') {
      return isOtherAnswer(value)
        ? getOtherAnswerText(value).trim().length > 0
        : value.trim().length > 0;
    }
    return Boolean(value);
  };

  const hasRecordedResponse = (value?: boolean | string | string[]) => {
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) {
      return value.some((item) =>
        isOtherAnswer(item) ? getOtherAnswerText(item).trim().length > 0 : item.trim().length > 0
      );
    }
    if (typeof value === 'string') {
      return isOtherAnswer(value)
        ? getOtherAnswerText(value).trim().length > 0
        : value.trim().length > 0;
    }
    return false;
  };

  const getNumberScaleOptions = (targetQuestion: LoadedFormSchema['questions'][number]) => {
    const settings = targetQuestion.settings;
    if (!settings?.minNumberEnabled || !settings.maxNumberEnabled) return [];
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
    targetQuestion: LoadedFormSchema['questions'][number],
    option: number,
    index: number
  ) => {
    const label = targetQuestion.settings?.choices?.[index]?.trim();
    return label || String(option);
  };

  const computeScore = (answersSnapshot: Record<number, boolean | string | string[]>) => {
    if (!scoringEnabled) return 0;
    const repeatedQuestionIds = new Set(
      (form.repeatLoops ?? []).flatMap((loop) =>
        getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId)
      )
    );
    const normalScore = questions.reduce((sum, question) => {
      if (repeatedQuestionIds.has(question.id)) return sum;
      return hasAnswer(answersSnapshot[question.id]) ? sum + question.weight : sum;
    }, 0);
    const repeatScore = (form.repeatLoops ?? []).reduce((loopSum, loop) => {
      return (
        loopSum +
        getLoopSummaryInstances(loop.id, answersSnapshot).reduce((instanceSum, instanceAnswers) => {
          return (
            instanceSum +
            questions.reduce((questionSum, question) => {
              return hasAnswer(instanceAnswers[question.id]) ? questionSum + question.weight : questionSum;
            }, 0)
          );
        }, 0)
      );
    }, 0);
    return normalScore + repeatScore;
  };

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
      // ignore parse errors and fall back to the generic message below
    }
    return fallback;
  };

  const submitResponse = async (
    answersSnapshot: Record<number, boolean | string | string[]>,
    finalScore: number,
    meta: ResponsePathMeta,
    completed: boolean,
    forcePersistEmptyDraft = false
  ) => {
    if (!formId) return;
    const nextDraftToken =
      !completed && (meta.draftToken?.trim() || draftToken || crypto.randomUUID());
    if (!completed && nextDraftToken && nextDraftToken !== draftToken) {
      setDraftToken(nextDraftToken);
    }

    const visitedIds = meta.visitedQuestionIds ?? [...history, currentQuestionId];
    const currentRepeatLoop =
      loopSummaryId !== null
        ? form.repeatLoops?.find((loop) => loop.id === loopSummaryId)
        : getRepeatLoopForQuestion(form, currentQuestionId);
    const repeatAnswerItems = (form.repeatLoops ?? []).flatMap((loop) => {
      const currentInstance = getLoopInstanceAnswers(loop.id, answersSnapshot);
      const instances = completed
        ? getLoopSummaryInstances(loop.id, answersSnapshot)
        : currentRepeatLoop?.id === loop.id && Object.keys(currentInstance).length > 0
          ? [currentInstance]
          : [];
      return instances.flatMap((instanceAnswers) =>
        getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId).flatMap((questionId) => {
          const answer = instanceAnswers[questionId];
          const answeredQuestion = questionMap.get(questionId);
          if (!hasRecordedResponse(answer) || !answeredQuestion || !isAnswerableQuestion(answeredQuestion)) {
            return [];
          }
          return [
            {
              questionId: String(questionId),
              answer: serializeAnswerValue(answeredQuestion, answer),
            },
          ];
        })
      );
    });
    const repeatedQuestionIds = new Set(
      (form.repeatLoops ?? []).flatMap((loop) =>
        getQuestionRangeIds(form, loop.startQuestionId, loop.endQuestionId)
      )
    );
    const repeatMeta =
      (form.repeatLoops ?? [])
        .map((loop) => {
          const currentInstance = getLoopInstanceAnswers(loop.id, answersSnapshot);
          const instances = completed
            ? getLoopSummaryInstances(loop.id, answersSnapshot)
            : currentRepeatLoop?.id === loop.id && Object.keys(currentInstance).length > 0
              ? [currentInstance]
              : [];
          return {
            loopId: loop.id,
            label: loop.label,
            instances: instances.map((instanceAnswers, index) => ({
              index: index + 1,
              title: getLoopInstanceTitle(loop.id, instanceAnswers, index + 1),
              questionIds: Object.keys(instanceAnswers).map(Number),
            })),
          };
        })
        .filter((loop) => loop.instances.length > 0);
    const payload = {
      responseId: responseId ?? undefined,
      answers: [
        ...repeatAnswerItems,
        ...visitedIds.flatMap((questionId) => {
        if (repeatedQuestionIds.has(questionId)) {
          return [];
        }
        const answer = answersSnapshot[questionId];
        const answeredQuestion = questionMap.get(questionId);
        if (!hasRecordedResponse(answer)) {
          return [];
        }
        return [
          {
            questionId: String(questionId),
            answer: serializeAnswerValue(answeredQuestion, answer),
          },
        ];
        }),
      ],
      score: finalScore,
      meta:
        repeatMeta.length > 0
          ? { ...meta, draftToken: nextDraftToken, repeatLoops: repeatMeta }
          : { ...meta, draftToken: nextDraftToken },
      completed,
    };

    if (payload.answers.length === 0 && !completed && !forcePersistEmptyDraft) {
      return { id: responseId, error: null };
    }

    try {
      const response = await fetch(`/api/forms/${formId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return {
          id: null,
          error: await readApiError(response, 'Unable to save your response.'),
        };
      }
      const data = (await response.json()) as { id?: string };
      const nextResponseId = data.id ?? null;
      if (nextResponseId) {
        setResponseId(nextResponseId);
      }
      return { id: nextResponseId, error: null };
    } catch {
      return {
        id: null,
        error: 'Unable to save your response. Check your connection and try again.',
      };
    }
  };

  const handleStartForm = async () => {
    if (!welcomeScreen || submitting) {
      return;
    }

    setSaveWarning(null);
    setSubmitting(true);
    const draftResult = await submitResponse(
      {},
      0,
      {
        visitedQuestionIds: [currentQuestionId],
        lastQuestionId: currentQuestionId,
        completed: false,
        draftToken: draftToken ?? crypto.randomUUID(),
      },
      false,
      true
    );
    setSubmitting(false);
    if (draftResult?.error) {
      setSaveWarning(
        `Progress was not saved. You can continue, but draft recovery may be incomplete. ${draftResult.error}`
      );
    }
    setShowWelcome(false);
  };

  const proceedToNext = async (
    answersSnapshot: Record<number, boolean | string | string[]>,
    branchAnswer: FormAnswerValue
  ) => {
    if (submitting) return;
    const updatedScore = computeScore(answersSnapshot);
    setDirection(1);
    setSaveWarning(null);
    setSubmitError(null);
    const nextId = getFormNextQuestionId(form, currentQuestionId, branchAnswer);
    const pathQuestionIds = [...history, currentQuestionId];
    const completedLoop = getRepeatLoopAfterQuestion(form, currentQuestionId);

    if (completedLoop) {
      setSubmitting(true);
      const draftResult = await submitResponse(
        answersSnapshot,
        updatedScore,
        {
          visitedQuestionIds: pathQuestionIds,
          lastQuestionId: currentQuestionId,
          completed: false,
        },
        false
      );
      setSubmitting(false);
      if (draftResult?.error) {
        setSaveWarning(
          `Progress was not saved. You can continue, but draft recovery may be incomplete. ${draftResult.error}`
        );
      }
      setLoopSummaryId(completedLoop.id);
      return;
    }

    if (nextId !== null && questionMap.has(nextId)) {
      setSubmitting(true);
      const draftResult = await submitResponse(
        answersSnapshot,
        updatedScore,
        {
          visitedQuestionIds: [...pathQuestionIds, nextId],
          lastQuestionId: nextId,
          completed: false,
        },
        false
      );
      setSubmitting(false);
      if (draftResult?.error) {
        setSaveWarning(
          `Progress was not saved. You can continue, but draft recovery may be incomplete. ${draftResult.error}`
        );
      }

      const nextHistory = pathQuestionIds;
      const retainedQuestionIds = new Set([...nextHistory, nextId]);
      const trimmedAnswers: Record<number, boolean | string | string[]> = {};
      for (const [key, value] of Object.entries(answersSnapshot)) {
        const numericKey = Number(key);
        if (retainedQuestionIds.has(numericKey)) {
          trimmedAnswers[numericKey] = value as boolean | string | string[];
        }
      }

      setHistory(nextHistory);
      setAnswers(trimmedAnswers);
      setCurrentQuestionId(nextId);
    } else {
      setSubmitting(true);
      const finalResult = await submitResponse(
        answersSnapshot,
        updatedScore,
        {
          visitedQuestionIds: pathQuestionIds,
          lastQuestionId: currentQuestionId,
          completed: true,
        },
        true
      );
      setSubmitting(false);
      if (finalResult?.error) {
        setSubmitError(finalResult.error);
        return;
      }
      const nextResponseId = finalResult?.id ?? null;
      if (!previewMode && draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      setResponseId(null);
      setDraftToken(null);
      if (onComplete) {
        onComplete(updatedScore);
      } else if (endScreen) {
        setShowEnd(true);
      } else {
        navigate('/results', { state: { score: updatedScore, form, formId, responseId: nextResponseId } });
      }
    }
  };

  const handleAddRepeatInstance = () => {
    if (!loopSummaryId) return;
    const loop = form.repeatLoops?.find((item) => item.id === loopSummaryId);
    if (!loop) return;
    archiveLoopInstance(loop.id, answers);
    setAnswers(clearLoopAnswers(loop.id, answers));
    setHistory([]);
    setCurrentQuestionId(loop.startQuestionId);
    setLoopSummaryId(null);
    setDirection(1);
  };

  const handleContinueFromRepeatLoop = async () => {
    if (!loopSummaryId || submitting) return;
    const loop = form.repeatLoops?.find((item) => item.id === loopSummaryId);
    if (!loop) return;
    const exitQuestionId = getRepeatLoopExitQuestionId(form, loop);
    const updatedScore = computeScore(answers);
    const pathQuestionIds = [...history, currentQuestionId];

    if (exitQuestionId !== null && questionMap.has(exitQuestionId)) {
      archiveLoopInstance(loop.id, answers);
      const nextAnswers = clearLoopAnswers(loop.id, answers);
      setAnswers(nextAnswers);
      setHistory(pathQuestionIds);
      setCurrentQuestionId(exitQuestionId);
      setLoopSummaryId(null);
      setDirection(1);
      return;
    }

    setSubmitting(true);
    const finalResult = await submitResponse(
      answers,
      updatedScore,
      {
        visitedQuestionIds: pathQuestionIds,
        lastQuestionId: currentQuestionId,
        completed: true,
      },
      true
    );
    setSubmitting(false);
    if (finalResult?.error) {
      setSubmitError(finalResult.error);
      return;
    }
    setLoopSummaryId(null);
    if (!previewMode && draftStorageKey) {
      window.localStorage.removeItem(draftStorageKey);
    }
    setResponseId(null);
    setDraftToken(null);
    if (onComplete) {
      onComplete(updatedScore);
    } else if (endScreen) {
      setShowEnd(true);
    } else {
      navigate('/results', { state: { score: updatedScore, form, formId, responseId: finalResult?.id ?? null } });
    }
  };

  const handleSkipActiveLoopToFinish = async () => {
    const activeLoop = getRepeatLoopForQuestion(form, currentQuestionId);
    if (!activeLoop || submitting) return;
    const nextAnswers = clearLoopAnswers(activeLoop.id, answers);
    const updatedScore = computeScore(nextAnswers);
    const pathQuestionIds = [...history, currentQuestionId];

    setSubmitting(true);
    const finalResult = await submitResponse(
      nextAnswers,
      updatedScore,
      {
        visitedQuestionIds: pathQuestionIds,
        lastQuestionId: currentQuestionId,
        completed: true,
      },
      true
    );
    setSubmitting(false);
    if (finalResult?.error) {
      setSubmitError(finalResult.error);
      return;
    }

    setAnswers(nextAnswers);
    setLoopSummaryId(null);
    if (!previewMode && draftStorageKey) {
      window.localStorage.removeItem(draftStorageKey);
    }
    setResponseId(null);
    setDraftToken(null);
    if (onComplete) {
      onComplete(updatedScore);
    } else if (endScreen) {
      setShowEnd(true);
    } else {
      navigate('/results', { state: { score: updatedScore, form, formId, responseId: finalResult?.id ?? null } });
    }
  };

  const handleAnswer = async (answer: boolean) => {
    const newAnswers = { ...answers, [currentQuestionId]: answer };
    setAnswers(newAnswers);
    await proceedToNext(newAnswers, answer);
  };

  // Handle going back to previous question
  const handlePrevious = () => {
    if (history.length > 0) {
      // Set direction to backward
      setDirection(-1);

      const previousId = history[history.length - 1];
      setHistory((prevHistory) => prevHistory.slice(0, -1));

      // Go to previous question
      setCurrentQuestionId(previousId);
    }
  };

  const handleMultipleSelect = (option: string) => {
    const current = answers[currentQuestionId];
    const currentQuestion = questionMap.get(currentQuestionId);
    const currentList = Array.isArray(current)
      ? current
      : typeof current === 'string'
        ? [current]
        : [];
    const allowMultiple = Boolean(currentQuestion?.settings?.multipleSelection);
    const optionValue = option === 'Other' ? 'Other: ' : option;
    const isSelected = currentList.some((item) => normalizeChoiceForBranching(item) === option);

    if (!allowMultiple && isSelected) {
      setAnswers((prev) => {
        const nextAnswers = { ...prev };
        delete nextAnswers[currentQuestionId];
        return nextAnswers;
      });
      return;
    }

    const nextList = allowMultiple
      ? isSelected
        ? currentList.filter((item) => normalizeChoiceForBranching(item) !== option)
        : [...currentList, optionValue]
      : [optionValue];
    const nextAnswer = allowMultiple ? nextList : optionValue;
    setAnswers((prev) => ({ ...prev, [currentQuestionId]: nextAnswer }));
    if (!allowMultiple && option !== 'Other') {
      void proceedToNext({ ...answers, [currentQuestionId]: optionValue }, option);
    }
  };

  const updateOtherAnswerText = (text: string) => {
    const value = `Other: ${text}`;
    setAnswers((prev) => {
      const current = prev[currentQuestionId];
      if (Array.isArray(current)) {
        const nextList = current.some(isOtherAnswer)
          ? current.map((item) => (isOtherAnswer(item) ? value : item))
          : [...current, value];
        return { ...prev, [currentQuestionId]: nextList };
      }
      return { ...prev, [currentQuestionId]: value };
    });
  };

  const question = questionMap.get(currentQuestionId) ?? questions[0];
  const currentIndexRaw = flowQuestions.findIndex((item) => item.id === question?.id);
  const currentIndex = currentIndexRaw === -1 ? 0 : currentIndexRaw;
  const currentStep = history.length + 1;
  const score = computeScore(answers);
  const answerType = question ? inferQuestionAnswerType(question) : 'yesno';
  const isGroup = question?.category === 'Question Group';
  const isDetails = question?.settings?.kind === 'details' || question?.category === 'Details Screen';
  const isContentStep = isGroup || isDetails;
  const isRequired = Boolean(question?.settings?.required);
  const currentAnswer = answers[currentQuestionId];
  const numberUnitChoices = getNumberUnitChoices(question);
  const currentNumberAnswer = splitNumberAnswer(question, currentAnswer);
  const currentStepAnswers = Array.isArray(currentAnswer)
    ? currentAnswer
    : typeof currentAnswer === 'string' && currentAnswer.trim().length > 0
      ? [currentAnswer]
      : [''];
  const canContinue = (() => {
    if (!isRequired) {
      if (answerType === 'number' && numberUnitChoices.length > 0 && currentNumberAnswer.value) {
        return Boolean(currentNumberAnswer.unit);
      }
      return true;
    }
    if (answerType === 'number' && numberUnitChoices.length > 0) {
      return currentNumberAnswer.value.trim().length > 0 && currentNumberAnswer.unit.trim().length > 0;
    }
    return hasAnswer(currentAnswer);
  })();
  const choiceList = [
    ...(question?.settings?.choices ?? ['Choice A']),
    ...(question?.settings?.otherOption ? ['Other'] : []),
  ];
  const otherSelected = Array.isArray(currentAnswer)
    ? currentAnswer.some(isOtherAnswer)
    : typeof currentAnswer === 'string' && isOtherAnswer(currentAnswer);
  const otherAnswerText = Array.isArray(currentAnswer)
    ? getOtherAnswerText(currentAnswer.find(isOtherAnswer) ?? '')
    : typeof currentAnswer === 'string'
      ? getOtherAnswerText(currentAnswer)
      : '';
  const multipleBranchAnswer = Array.isArray(currentAnswer)
    ? currentAnswer.map(normalizeChoiceForBranching)
    : typeof currentAnswer === 'string'
      ? normalizeChoiceForBranching(currentAnswer)
      : currentAnswer;
  const shouldShowMultipleContinue = Boolean(question?.settings?.multipleSelection) || otherSelected;
  const blockJustifyClass =
    isDetails || question?.settings?.verticalAlignment === 'center' ? 'justify-center' : 'justify-start';
  const activeRepeatLoop =
    loopSummaryId === null ? getRepeatLoopForQuestion(form, currentQuestionId) : undefined;
  const canSkipActiveLoop =
    !previewMode &&
    Boolean(activeRepeatLoop) &&
    ((repeatInstances[activeRepeatLoop?.id ?? ''] ?? []).length > 0);
  const groupSteps = flowQuestions.filter((item) => item.category === 'Question Group');
  const currentGroupIndex = isGroup ? groupSteps.findIndex((item) => item.id === question?.id) : -1;
  const totalGroups = groupSteps.length;
  const questionOrderIndex = question ? allQuestions.findIndex((item) => item.id === question.id) : -1;
  const nextGroupBoundaryIndex =
    questionOrderIndex === -1
      ? -1
      : allQuestions.findIndex(
          (item, index) =>
            index > questionOrderIndex &&
            (item.category === 'Question Group' || item.category === 'End Screen')
        );
  const groupQuestionCount =
    questionOrderIndex === -1
      ? 0
      : allQuestions
          .slice(questionOrderIndex + 1, nextGroupBoundaryIndex === -1 ? undefined : nextGroupBoundaryIndex)
          .filter(isAnswerableQuestion).length;
  const cleanedGroupTitle =
    isGroup && question
      ? question.text.replace(/^section\s+\d+\s*:\s*/i, '').trim() || question.text
      : question?.text ?? '';
  const groupDescription = question?.settings?.description?.trim() ?? '';
  const groupDescriptionMatchesTitle =
    groupDescription.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ===
    cleanedGroupTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const groupSummary =
    isGroup && groupDescription && !groupDescriptionMatchesTitle
      ? groupDescription
      : groupQuestionCount > 0
        ? `The next ${groupQuestionCount} ${
            groupQuestionCount === 1 ? 'question covers' : 'questions cover'
          } this topic area and the work captured in this part of the form.`
        : 'This section introduces the next part of the form.';
  const groupButtonLabel =
    isGroup &&
    (!question?.settings?.buttonLabel ||
      question.settings.buttonLabel.trim().toLowerCase() === 'continue')
      ? 'Start section'
      : question?.settings?.buttonLabel ?? 'Continue';
  const endFooterText =
    endScreen?.settings && Object.prototype.hasOwnProperty.call(endScreen.settings, 'footerText')
      ? endScreen.settings.footerText?.trim() ?? ''
      : 'Thank you for your submissions. You may now close this page.';
  const pageStyles =
    isGroup
      ? ({
          ...themeStyles,
          background: 'linear-gradient(135deg, #eef6ff 0%, #f7fbf5 55%, #fff9ef 100%)',
        } as React.CSSProperties)
      : themeStyles;

  const continueCurrentStep = () => {
    if (showWelcome && welcomeScreen) {
      void handleStartForm();
      return;
    }

    if (loopSummaryId) {
      void handleContinueFromRepeatLoop();
      return;
    }

    if (showEnd || submitting) {
      return;
    }

    if (isContentStep) {
      void proceedToNext({ ...answers }, undefined);
      return;
    }

    if (answerType === 'multiple') {
      if (!shouldShowMultipleContinue || !canContinue) return;
      void proceedToNext(
        { ...answers, [currentQuestionId]: currentAnswer ?? [] },
        multipleBranchAnswer
      );
      return;
    }

    if (answerType === 'long') {
      if (!canContinue) return;
      const nextValue =
        question.settings?.longTextFormat === 'steps' ||
        question.settings?.longTextFormat === 'numbered'
          ? currentStepAnswers
          : typeof currentAnswer === 'string'
            ? currentAnswer
            : '';
      void proceedToNext(
        {
          ...answers,
          [currentQuestionId]: nextValue,
        },
        nextValue
      );
      return;
    }

    if (answerType === 'date' || answerType === 'email' || answerType === 'number') {
      if (answerType === 'number' && getNumberScaleOptions(question).length > 0) return;
      if (!canContinue) return;
      const nextValue =
        answerType === 'number'
          ? composeNumberAnswer(currentNumberAnswer.value, currentNumberAnswer.unit)
          : typeof currentAnswer === 'string'
            ? currentAnswer
            : '';
      void proceedToNext(
        { ...answers, [currentQuestionId]: nextValue },
        nextValue
      );
    }
  };

  useEffect(() => {
    if (previewMode || !draftStorageKey || !formId) {
      setRestoringDraft(false);
      return;
    }

    let isMounted = true;

    const restoreDraft = async () => {
      try {
        const hydrateRemoteDraft = async (token: string) => {
          const response = await fetch(
            `/api/forms/${formId}/responses/draft-resume?draftToken=${encodeURIComponent(token)}`
          );
          if (!response.ok) {
            return false;
          }
          const data = (await response.json()) as { draft?: RemoteDraftState | null };
          if (!data.draft || !isMounted) {
            return false;
          }
          setResponseId(data.draft.responseId);
          setDraftToken(data.draft.draftToken);
          setCurrentQuestionId(data.draft.currentQuestionId);
          setAnswers(data.draft.answers ?? {});
          setHistory(Array.isArray(data.draft.history) ? data.draft.history : []);
          setShowWelcome(Boolean(data.draft.showWelcome));
          setRepeatInstances(data.draft.repeatInstances ?? {});
          setLoopSummaryId(data.draft.loopSummaryId ?? null);
          return true;
        };

        const raw = window.localStorage.getItem(draftStorageKey);
        if (!raw) {
          const cookieDraftToken = readDraftCookie(formId);
          if (cookieDraftToken) {
            await hydrateRemoteDraft(cookieDraftToken);
          }
          return;
        }
        const parsed = JSON.parse(raw) as Partial<LocalDraftState>;

        const parsedResponseId =
          typeof parsed.responseId === 'string' && parsed.responseId.trim().length > 0
            ? parsed.responseId
            : null;
        const parsedDraftToken =
          typeof parsed.draftToken === 'string' && parsed.draftToken.trim().length > 0
            ? parsed.draftToken
            : null;

        if (parsedResponseId && !parsedDraftToken) {
          window.localStorage.removeItem(draftStorageKey);
          writeDraftCookie(formId, null);
          return;
        }

        if (parsedResponseId && parsedDraftToken) {
          const response = await fetch(
            `/api/forms/${formId}/responses/draft-status?responseId=${encodeURIComponent(parsedResponseId)}&draftToken=${encodeURIComponent(parsedDraftToken)}`
          );
          if (!response.ok) {
            return;
          }
          const data = (await response.json()) as { resetRequired?: boolean };
          if (data.resetRequired) {
            window.localStorage.removeItem(draftStorageKey);
            writeDraftCookie(formId, null);
            return;
          }
          const restored = await hydrateRemoteDraft(parsedDraftToken);
          if (restored) {
            return;
          }
        }

        if (
          typeof parsed.currentQuestionId !== 'number' ||
          !Number.isInteger(parsed.currentQuestionId) ||
          !questionMap.has(parsed.currentQuestionId)
        ) {
          return;
        }

        if (!isMounted) return;
        setResponseId(parsedResponseId);
        setDraftToken(parsedDraftToken);
        setCurrentQuestionId(parsed.currentQuestionId);
        setAnswers(parsed.answers ?? {});
        setHistory(Array.isArray(parsed.history) ? parsed.history.filter(Number.isInteger) : []);
        setShowWelcome(Boolean(parsed.showWelcome));
        setRepeatInstances(parsed.repeatInstances ?? {});
        setLoopSummaryId(typeof parsed.loopSummaryId === 'string' ? parsed.loopSummaryId : null);
      } catch {
        // Ignore malformed local drafts and start fresh.
      } finally {
        if (isMounted) {
          setRestoringDraft(false);
        }
      }
    };

    void restoreDraft();

    return () => {
      isMounted = false;
    };
  }, [draftStorageKey, formId, previewMode, questionMap]);

  useEffect(() => {
    if (previewMode || !draftStorageKey) return;
    const hasDraftState =
      responseId !== null ||
      draftToken !== null ||
      Object.keys(answers).length > 0 ||
      history.length > 0 ||
      Object.keys(repeatInstances).length > 0 ||
      loopSummaryId !== null ||
      !showWelcome;
    if (!hasDraftState) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    const payload: LocalDraftState = {
      responseId,
      draftToken,
      currentQuestionId,
      answers,
      history,
      showWelcome,
      repeatInstances,
      loopSummaryId,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      if (formId) {
        writeDraftCookie(formId, draftToken);
      }
    } catch {
      // Ignore storage failures and continue.
    }
  }, [
    answers,
    currentQuestionId,
    draftToken,
    draftStorageKey,
    formId,
    history,
    loopSummaryId,
    previewMode,
    repeatInstances,
    responseId,
    showWelcome,
  ]);

  useEffect(() => {
    if (previewMode || !formId || showWelcome || showEnd) {
      return;
    }

    const visitedQuestionIds = [...history, currentQuestionId];
    const autosaveSignature = JSON.stringify({
      responseId,
      currentQuestionId,
      visitedQuestionIds,
      answers,
      repeatInstances,
      loopSummaryId,
    });

    if (lastAutosaveSignatureRef.current === autosaveSignature) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const persistDraft = async () => {
        const result = await submitResponse(
          answers,
          computeScore(answers),
          {
            visitedQuestionIds,
            lastQuestionId: currentQuestionId,
            completed: false,
          },
          false
        );

        if (result?.error) {
          setSaveWarning(
            `Progress was not saved. You can continue, but draft recovery may be incomplete. ${result.error}`
          );
          return;
        }

        setSaveWarning(null);
        lastAutosaveSignatureRef.current = autosaveSignature;
      };

      void persistDraft();
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    answers,
    currentQuestionId,
    formId,
    history,
    loopSummaryId,
    previewMode,
    repeatInstances,
    responseId,
    showEnd,
    showWelcome,
  ]);

  useEffect(() => {
    const handleEnterContinue = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      continueCurrentStep();
    };

    window.addEventListener('keydown', handleEnterContinue);
    return () => window.removeEventListener('keydown', handleEnterContinue);
  }, [
    continueCurrentStep,
  ]);

  // Animation variants for Framer Motion
  const pageVariants = {
    initial: (direction: number) => ({
      opacity: 0,
      x: direction * 50
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      }
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction * -50,
      transition: {
        duration: 0.3,
        ease: "easeInOut"
      }
    })
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.3,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    }
  };

  // Button hover animation variants
  const buttonVariants = {
    hover: { 
      scale: 1.03,
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  };

  if (restoringDraft) {
    return (
      <div
        className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
        style={themeStyles}
      >
        <div className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}>
          <div className="typeform-card">
            <p className="typeform-text">Restoring your progress...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcome && welcomeScreen) {
    return (
      <div
        className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
        style={themeStyles}
      >
        {logoUrl && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
          </div>
        )}
        <div className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}>
          <div className="typeform-card">
            {welcomeScreen.settings?.mediaUrl && welcomeScreen.settings?.mediaPosition === 'above' && (
              <div className="mb-6 flex justify-center">
                {welcomeScreen.settings.mediaType === 'video' ? (
                  <video
                    src={welcomeScreen.settings.mediaUrl}
                    className={`rounded-xl shadow-sm ${
                      welcomeScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      welcomeScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      welcomeScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                    controls
                  />
                ) : (
                  <img
                    src={welcomeScreen.settings.mediaUrl}
                    alt="Welcome media"
                    className={`rounded-xl shadow-sm ${
                      welcomeScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      welcomeScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      welcomeScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                  />
                )}
              </div>
            )}
            <h2 className="typeform-heading">{welcomeScreen.text}</h2>
            {form.description && <p className="typeform-text">{form.description}</p>}
            {welcomeScreen.settings?.mediaUrl && welcomeScreen.settings?.mediaPosition !== 'above' && (
              <div className="my-6 flex justify-center">
                {welcomeScreen.settings.mediaType === 'video' ? (
                  <video
                    src={welcomeScreen.settings.mediaUrl}
                    className={`rounded-xl shadow-sm ${
                      welcomeScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      welcomeScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      welcomeScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                    controls
                  />
                ) : (
                  <img
                    src={welcomeScreen.settings.mediaUrl}
                    alt="Welcome media"
                    className={`rounded-xl shadow-sm ${
                      welcomeScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      welcomeScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      welcomeScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                  />
                )}
              </div>
            )}
            <button
              type="button"
              className="typeform-button"
              onClick={() => void handleStartForm()}
              disabled={submitting}
            >
              {welcomeScreen.settings?.buttonLabel ?? 'Start'}
            </button>
            {saveWarning && <p className="mt-4 text-sm text-amber-600">{saveWarning}</p>}
            {(welcomeScreen.settings?.showTimeToComplete ||
              welcomeScreen.settings?.showSubmissionCount) && (
              <div className="text-gray-400 text-sm mt-4 flex flex-col items-center gap-2">
                {welcomeScreen.settings?.showTimeToComplete && (
                  <span className="inline-block">Takes X minutes</span>
                )}
                {welcomeScreen.settings?.showSubmissionCount && (
                  <span className="inline-block">X people have filled this out</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loopSummaryId) {
    const loop = form.repeatLoops?.find((item) => item.id === loopSummaryId);
    if (loop) {
      const instances = getLoopSummaryInstances(loop.id);
      const maxReached =
        loop.maxRepeats !== undefined && instances.length >= loop.maxRepeats;
      return (
        <div
          className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
          style={themeStyles}
        >
          {logoUrl && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2">
              <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
            </div>
          )}
          <div className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}>
            <motion.div
              className="typeform-card w-full max-w-2xl text-left"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants} className="text-sm font-medium text-blue-700">
                {loop.pluralLabel ?? `${loop.label}s`} added
              </motion.div>
              <motion.h2 variants={itemVariants} className="typeform-heading text-left">
                {`${loop.label} ${instances.length} complete`}
              </motion.h2>
              <motion.div variants={itemVariants} className="mt-6 rounded-2xl border border-gray-100 bg-white/80">
                {instances.map((instanceAnswers, index) => (
                  <div
                    key={`${loop.id}-summary-${index}`}
                    className="border-b border-gray-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {getLoopInstanceTitle(loop.id, instanceAnswers, index + 1)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {Object.keys(instanceAnswers).length} answers captured
                    </div>
                  </div>
                ))}
              </motion.div>
              {submitError && (
                <motion.div
                  variants={itemVariants}
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {submitError}
                </motion.div>
              )}
              <motion.div variants={itemVariants} className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="typeform-button"
                  onClick={handleAddRepeatInstance}
                  disabled={submitting || maxReached}
                >
                  {loop.addAnotherLabel ?? `Add another ${loop.label.toLowerCase()}`}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-6 py-3 text-base font-medium text-white transition-all duration-300 hover:shadow-sm disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    color: '#fff',
                  }}
                  onClick={() => void handleContinueFromRepeatLoop()}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : loop.continueLabel ?? 'Continue'}
                </button>
              </motion.div>
              {maxReached && (
                <motion.div variants={itemVariants} className="mt-3 text-xs text-gray-500">
                  Maximum {loop.label.toLowerCase()} count reached.
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      );
    }
  }

  if (showEnd && endScreen) {
    return (
      <div
        className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
        style={themeStyles}
      >
        {logoUrl && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
          </div>
        )}
        <div className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}>
          <div className="typeform-card">
            {endScreen.settings?.mediaUrl && endScreen.settings?.mediaPosition === 'above' && (
              <div className="mb-6 flex justify-center">
                {endScreen.settings.mediaType === 'video' ? (
                  <video
                    src={endScreen.settings.mediaUrl}
                    className={`rounded-xl shadow-sm ${
                      endScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      endScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      endScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                    controls
                  />
                ) : (
                  <img
                    src={endScreen.settings.mediaUrl}
                    alt="End media"
                    className={`rounded-xl shadow-sm ${
                      endScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      endScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      endScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                  />
                )}
              </div>
            )}
            <h2 className="typeform-heading">{endScreen.text}</h2>
            {form.description && <p className="typeform-text">{form.description}</p>}
            {!previewMode && endFooterText && (
              <p className="typeform-text">
                {endFooterText}
              </p>
            )}
            {endScreen.settings?.mediaUrl && endScreen.settings?.mediaPosition !== 'above' && (
              <div className="my-6 flex justify-center">
                {endScreen.settings.mediaType === 'video' ? (
                  <video
                    src={endScreen.settings.mediaUrl}
                    className={`rounded-xl shadow-sm ${
                      endScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      endScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      endScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                    controls
                  />
                ) : (
                  <img
                    src={endScreen.settings.mediaUrl}
                    alt="End media"
                    className={`rounded-xl shadow-sm ${
                      endScreen.settings.mediaSize === 'xsmall' ? 'max-w-[100px]' :
                      endScreen.settings.mediaSize === 'small' ? 'max-w-[200px]' :
                      endScreen.settings.mediaSize === 'large' ? 'max-w-[600px]' : 'max-w-[400px]'
                    }`}
                  />
                )}
              </div>
            )}
            {previewMode && (
              <button
                type="button"
                className="typeform-button"
                onClick={() => {
                  setShowEnd(false);
                  setShowWelcome(Boolean(welcomeScreen));
                }}
              >
                {endScreen.settings?.buttonLabel ?? 'Finish'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div
        className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
        style={themeStyles}
      >
        <div className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}>
          <div className="typeform-card">
            <h2 className="typeform-heading">No questions yet</h2>
            <p className="typeform-text">Add a question to preview the form.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Full-screen container
    <div
      className={`typeform-fullscreen${isContentStep ? ' typeform-fullscreen-readable' : ''}${previewMode ? ' typeform-preview' : ''}`}
      style={pageStyles}
    >
      {logoUrl && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2">
          <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
        </div>
      )}
      {canSkipActiveLoop && (
        <div className="absolute right-6 top-6 z-10">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
            onClick={() => void handleSkipActiveLoopToFinish()}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Skip to finish'}
          </button>
        </div>
      )}
      {/* Top progress bar */}
      <div className={`typeform-top-progress${previewMode ? ' typeform-top-progress-preview' : ''}`}>
        <div className="typeform-thin-progress">
          <div 
            className="typeform-thin-progress-fill" 
            style={{ width: `${((currentIndex + 1) / Math.max(flowQuestions.length, 1)) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Main content area */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentQuestionId}
          custom={direction}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`typeform-content${isContentStep ? ' typeform-content-readable' : ''}${previewMode ? ' typeform-content-preview' : ''}`}
        >
          {/* Question counter - small and subtle */}
          <div className="text-sm text-gray-400 mb-8 text-center font-medium">
            Step {currentStep} of {flowQuestions.length}
          </div>
          {(saveWarning || submitError) && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                submitError
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {submitError ?? saveWarning}
            </div>
          )}

          {/* Animated question content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col w-full"
          >
            {isGroup ? (
              <div className="flex w-full justify-center">
                <motion.div
                  variants={itemVariants}
                  className="w-full max-w-4xl rounded-[32px] border border-slate-200/80 bg-white/85 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-10 sm:py-10"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-blue-700">
                        {totalGroups > 0 && currentGroupIndex >= 0
                          ? `Section ${currentGroupIndex + 1} of ${totalGroups}`
                          : 'Section'}
                      </span>
                      {groupQuestionCount > 0 && (
                        <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-emerald-700 sm:ml-auto">
                          {groupQuestionCount} {groupQuestionCount === 1 ? 'question ahead' : 'questions ahead'}
                        </span>
                      )}
                    </div>
                    <div className="mx-auto max-w-3xl text-center">
                      <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                        {cleanedGroupTitle}
                      </h2>
                      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                        {groupSummary}
                      </p>
                    </div>
                    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-center text-sm leading-6 text-slate-600">
                      You’re moving into a new topic area. Continue when you’re ready to start this section.
                    </div>
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:items-center">
                      <motion.button
                        onClick={() => {
                          void proceedToNext({ ...answers }, undefined);
                        }}
                        className="typeform-button"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        disabled={submitting}
                      >
                        {groupButtonLabel}
                      </motion.button>
                      <span className="text-sm text-slate-500">press Enter ↵</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className={`w-full flex ${blockJustifyClass}`}>
                <div
                  className={`w-full grid grid-cols-1 gap-2 sm:grid-cols-[36px_1fr] sm:gap-3 ${
                    isContentStep
                      ? 'max-w-6xl'
                      : answerType === 'long' || answerType === 'number'
                        ? 'max-w-none'
                        : answerType === 'multiple'
                          ? 'max-w-3xl'
                          : 'max-w-[400px]'
                  }`}
                >
                  <div className="hidden text-sm text-blue-600 font-medium leading-snug sm:flex items-center gap-2 self-start mt-[6px]">
                    <span className="whitespace-nowrap">{currentStep}</span>
                    <span className="whitespace-nowrap">→</span>
                  </div>
                  <div className="flex flex-col items-start text-left">
                  {/* Question title */}
                  <h2 className="text-[2rem] font-bold text-gray-800 leading-tight sm:text-2xl">
                    {question.text}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </h2>

                  {/* Description - tight to title, space before input */}
                  {question.settings?.description && !isDetails && (
                    <p className="text-gray-500 italic mt-1">
                      {question.settings.description}
                    </p>
                  )}

                  {/* Spacer before input area */}
                  <div className="h-8" />

                  {question.settings?.mediaUrl && (
                    <motion.div variants={itemVariants} className="mb-6">
                      {question.settings.mediaType === 'video' ? (
                        <video
                          src={question.settings.mediaUrl}
                          className="max-w-[520px] rounded-xl shadow-sm"
                          controls
                        />
                      ) : (
                        <img
                          src={question.settings.mediaUrl}
                          alt="Question media"
                          className="max-w-[520px] rounded-xl shadow-sm"
                        />
                      )}
                    </motion.div>
                  )}

                  {/* Answer buttons - better spacing */}
                  {isDetails ? (
                    <motion.div
                      variants={itemVariants}
                      className="w-full max-w-5xl rounded-2xl bg-white/80 px-4 py-5 shadow-sm border border-gray-100 sm:px-8 sm:py-7 lg:px-10 lg:py-9"
                    >
                      {question.settings?.description && (
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-7">
                          {question.settings.description}
                        </div>
                      )}
                      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <motion.button
                          onClick={() => {
                            void proceedToNext({ ...answers }, undefined);
                          }}
                          className="typeform-button"
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          disabled={submitting}
                        >
                          {question.settings?.buttonLabel ?? 'Continue'}
                        </motion.button>
                        <span className="text-sm text-gray-600">press Enter ↵</span>
                      </div>
                    </motion.div>
                  ) : answerType === 'multiple' ? (
                    <motion.div
                      variants={itemVariants}
                      className="flex flex-col gap-3 w-full max-w-3xl items-start"
                    >
                      {choiceList.map((choice, index) => {
                        const selected = Array.isArray(currentAnswer)
                          ? currentAnswer.some((item) => normalizeChoiceForBranching(item) === choice)
                          : typeof currentAnswer === 'string' &&
                            normalizeChoiceForBranching(currentAnswer) === choice;
                        return (
                          <motion.button
                            key={choice}
                            onClick={() => handleMultipleSelect(choice)}
                            className={`typeform-option-button typeform-option-choice ${
                              selected ? 'typeform-option-yes' : 'typeform-option-no'
                            }`}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <span className="typeform-option-key">
                              {getChoiceKey(index, question.settings?.choiceKeyStyle)}
                            </span>
                            <span className="typeform-option-label">{choice}</span>
                          </motion.button>
                        );
                      })}
                      {otherSelected && (
                        <div className="w-full max-w-3xl">
                          <label className="sr-only" htmlFor={`other-answer-${currentQuestionId}`}>
                            Please specify other answer
                          </label>
                          <input
                            id={`other-answer-${currentQuestionId}`}
                            type="text"
                            value={otherAnswerText}
                            onChange={(event) => updateOtherAnswerText(event.target.value)}
                            className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-base text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Please specify..."
                            autoFocus
                          />
                        </div>
                      )}
                      {shouldShowMultipleContinue && (
                        <motion.button
                          onClick={() => {
                            if (!canContinue) return;
                            void proceedToNext(
                              { ...answers, [currentQuestionId]: currentAnswer ?? [] },
                              multipleBranchAnswer
                            );
                          }}
                          className={`typeform-option-button ${
                            canContinue ? 'typeform-option-yes' : 'typeform-option-no'
                          }`}
                          variants={buttonVariants}
                          whileHover={canContinue ? 'hover' : undefined}
                          whileTap={canContinue ? 'tap' : undefined}
                          disabled={!canContinue}
                        >
                          Continue
                        </motion.button>
                      )}
                    </motion.div>
            ) : answerType === 'long' ? (
              <motion.div variants={itemVariants} className="w-full">
                {question.settings?.longTextFormat === 'steps' ||
                question.settings?.longTextFormat === 'numbered' ? (
                  <div className="space-y-3">
                    {currentStepAnswers.map((step, index) => (
                      <div key={`step-answer-${index}`} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="w-full shrink-0 text-sm font-medium text-blue-700 sm:w-16">
                          {question.settings?.longTextFormat === 'steps'
                            ? `Step ${index + 1}`
                            : `${index + 1}.`}
                        </div>
                        <input
                          type="text"
                          value={step}
                          onChange={(event) => {
                            const nextSteps = [...currentStepAnswers];
                            nextSteps[index] = event.target.value;
                            setAnswers((prev) => ({ ...prev, [currentQuestionId]: nextSteps }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              const nextSteps = [...currentStepAnswers];
                              if (index === currentStepAnswers.length - 1 && step.trim().length > 0) {
                                nextSteps.push('');
                                setAnswers((prev) => ({ ...prev, [currentQuestionId]: nextSteps }));
                              }
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-4 py-3 text-gray-800 focus:border-blue-500 focus:outline-none"
                          placeholder={
                            question.settings?.longTextFormat === 'steps'
                              ? 'Describe this step...'
                              : 'Type an item...'
                          }
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestionId]: [...currentStepAnswers, ''],
                        }));
                      }}
                    >
                      {question.settings?.longTextFormat === 'steps'
                        ? 'Add another step'
                        : 'Add another item'}
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      rows={1}
                      value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                      onChange={(event) =>
                        setAnswers((prev) => ({ ...prev, [currentQuestionId]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (canContinue) {
                            void proceedToNext(
                              { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                              typeof currentAnswer === 'string' ? currentAnswer : ''
                            );
                          }
                        }
                      }}
                      maxLength={
                        question.settings?.maxCharactersEnabled ? question.settings.maxCharacters ?? undefined : undefined
                      }
                      className="w-full bg-transparent text-gray-800 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none resize-none p-0 leading-[1.2]"
                      style={{ fontSize: '24px' }}
                      placeholder="Type your answer here..."
                    />
                    <div className="text-sm text-blue-700" style={{ marginTop: '2px' }}>
                      <span className="font-medium">Shift</span> + Enter ↵ to make a line break
                    </div>
                  </>
                )}
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      {
                        ...answers,
                        [currentQuestionId]:
                          question.settings?.longTextFormat === 'steps' ||
                          question.settings?.longTextFormat === 'numbered'
                            ? currentStepAnswers
                            : typeof currentAnswer === 'string'
                              ? currentAnswer
                              : '',
                      },
                      question.settings?.longTextFormat === 'steps' ||
                      question.settings?.longTextFormat === 'numbered'
                        ? currentStepAnswers
                        : typeof currentAnswer === 'string'
                          ? currentAnswer
                          : ''
                    );
                  }}
                  className={`typeform-option-button mt-6 ${
                    canContinue ? 'typeform-option-yes' : 'typeform-option-no'
                  }`}
                  variants={buttonVariants}
                  whileHover={canContinue ? 'hover' : undefined}
                  whileTap={canContinue ? 'tap' : undefined}
                  disabled={!canContinue}
                >
                  Continue
                </motion.button>
              </motion.div>
            ) : answerType === 'date' ? (
              <motion.div variants={itemVariants} className="w-full">
                {(() => {
                  const format = question.settings?.dateFormat ?? 'MMDDYYYY';
                  const separator = question.settings?.dateSeparator ?? '/';
                  const parts = format === 'DDMMYYYY' ? ['DD', 'MM', 'YYYY'] : format === 'YYYYMMDD' ? ['YYYY', 'MM', 'DD'] : ['MM', 'DD', 'YYYY'];
                  const labels: Record<string, string> = { MM: 'Month', DD: 'Day', YYYY: 'Year' };
                  const widths: Record<string, string> = { MM: 'w-[72px] sm:w-[110px]', DD: 'w-[72px] sm:w-[110px]', YYYY: 'w-[104px] sm:w-[160px]' };
                  return (
                    <div className="flex flex-nowrap items-end gap-2 text-blue-700 text-sm sm:gap-6">
                      {parts.map((part, index) => (
                        <React.Fragment key={part}>
                          <div className="flex flex-col gap-2">
                            <span>{labels[part]}</span>
                            <input
                              type="text"
                              placeholder={part}
                              className={`${widths[part]} text-[28px] text-blue-700 placeholder:text-blue-300 bg-transparent border-b border-blue-400 focus:outline-none sm:text-[36px]`}
                            />
                          </div>
                          {index < parts.length - 1 && (
                            <div className="pb-2 text-[28px] text-blue-700 sm:text-[36px]">{separator}</div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })()}
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                      typeof currentAnswer === 'string' ? currentAnswer : ''
                    );
                  }}
                  className={`typeform-option-button mt-6 ${
                    canContinue ? 'typeform-option-yes' : 'typeform-option-no'
                  }`}
                  variants={buttonVariants}
                  whileHover={canContinue ? 'hover' : undefined}
                  whileTap={canContinue ? 'tap' : undefined}
                  disabled={!canContinue}
                >
                  Continue
                </motion.button>
              </motion.div>
            ) : answerType === 'email' ? (
              <motion.div variants={itemVariants} className="w-full">
                <input
                  type="email"
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [currentQuestionId]: event.target.value }))
                  }
                  className="w-full bg-transparent text-blue-700 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                  placeholder="name@example.com"
                />
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                      typeof currentAnswer === 'string' ? currentAnswer : ''
                    );
                  }}
                  className={`typeform-option-button mt-6 ${
                    canContinue ? 'typeform-option-yes' : 'typeform-option-no'
                  }`}
                  variants={buttonVariants}
                  whileHover={canContinue ? 'hover' : undefined}
                  whileTap={canContinue ? 'tap' : undefined}
                  disabled={!canContinue}
                >
                  Continue
                </motion.button>
              </motion.div>
            ) : answerType === 'number' ? (
              <motion.div variants={itemVariants} className="w-full">
                {getNumberScaleOptions(question).length > 0 ? (
                  <div
                    className={
                      question.settings?.choices?.length
                        ? 'flex flex-col gap-3 w-full max-w-3xl'
                        : 'flex flex-wrap gap-3'
                    }
                  >
                    {getNumberScaleOptions(question).map((option) => {
                      const optionIndex = option - (question.settings?.minNumber ?? option);
                      const optionLabel = getNumberScaleLabel(question, option, optionIndex);
                      const hasLabel = optionLabel !== String(option);
                      const optionValue = String(option);
                      const selected = currentAnswer === optionValue;
                      return (
                        <motion.button
                          key={`number-option-${question.id}-${option}`}
                          type="button"
                          onClick={() => {
                            const nextAnswers = { ...answers, [currentQuestionId]: optionValue };
                            setAnswers(nextAnswers);
                            void proceedToNext(nextAnswers, optionValue);
                          }}
                          className={`flex min-h-12 items-center rounded-xl border px-3 py-3 text-left shadow-sm transition sm:px-4 ${
                            selected
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                          } ${hasLabel ? 'w-full gap-3' : 'min-w-12 justify-center text-lg font-semibold'}`}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          disabled={submitting}
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-current text-sm font-semibold">
                            {option}
                          </span>
                          {hasLabel && (
                            <span className="min-w-0 flex-1 text-sm font-medium leading-snug sm:text-base">
                              {optionLabel}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      value={currentNumberAnswer.value}
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestionId]: composeNumberAnswer(
                            event.target.value,
                            currentNumberAnswer.unit
                          ),
                        }))
                      }
                      min={
                        question.settings?.minNumberEnabled ? question.settings.minNumber : undefined
                      }
                      max={
                        question.settings?.maxNumberEnabled ? question.settings.maxNumber : undefined
                      }
                      className="block w-full max-w-3xl bg-transparent text-blue-700 placeholder:text-blue-300 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                      placeholder="Type your answer here..."
                    />
                    {numberUnitChoices.length > 0 && (
                      <div className="mt-5 flex flex-col gap-3 w-full max-w-3xl items-start">
                        {numberUnitChoices.map((unit) => {
                          const selected = currentNumberAnswer.unit === unit;
                          return (
                            <motion.button
                              key={`number-unit-${question?.id ?? currentQuestionId}-${unit}`}
                              type="button"
                              onClick={() => {
                                setAnswers((prev) => ({
                                  ...prev,
                                  [currentQuestionId]: composeNumberAnswer(currentNumberAnswer.value, unit),
                                }));
                              }}
                              className={`typeform-option-button typeform-option-choice ${
                                selected ? 'typeform-option-yes' : 'typeform-option-no'
                              }`}
                              variants={buttonVariants}
                              whileHover="hover"
                              whileTap="tap"
                            >
                              <span className="typeform-option-label">{unit}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                    <motion.button
                      onClick={() => {
                        if (!canContinue) return;
                        const nextValue = composeNumberAnswer(
                          currentNumberAnswer.value,
                          currentNumberAnswer.unit
                        );
                        void proceedToNext(
                          { ...answers, [currentQuestionId]: nextValue },
                          nextValue
                        );
                      }}
                      className={`typeform-option-button mt-6 ${
                        canContinue ? 'typeform-option-yes' : 'typeform-option-no'
                      }`}
                      variants={buttonVariants}
                      whileHover={canContinue ? 'hover' : undefined}
                      whileTap={canContinue ? 'tap' : undefined}
                      disabled={!canContinue}
                    >
                      Continue
                    </motion.button>
                  </>
                )}
              </motion.div>
            ) : isContentStep ? (
              <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3">
                <motion.button
                  onClick={() => {
                    void proceedToNext({ ...answers }, undefined);
                  }}
                  className="typeform-button"
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  disabled={submitting}
                >
                  {question.settings?.buttonLabel ?? 'Continue'}
                </motion.button>
                <span className="text-sm text-gray-600">press Enter ↵</span>
              </motion.div>
            ) : (
              <motion.div 
                variants={itemVariants}
                className="typeform-options"
              >
                      <motion.button
                        onClick={() => handleAnswer(true)}
                        className="typeform-option-button typeform-option-yes"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        disabled={submitting}
                      >
                        Yes
                      </motion.button>
                      <motion.button
                        onClick={() => handleAnswer(false)}
                        className="typeform-option-button typeform-option-no"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        disabled={submitting}
                      >
                        No
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            )}
            {/* Back button - only show if not on first question */}
            {history.length > 0 && (
              <motion.button
                variants={itemVariants}
                onClick={handlePrevious}
                className="mt-8 text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center self-start"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </motion.button>
            )}

            {scoringEnabled && (
              <motion.div 
                variants={itemVariants}
                className="text-gray-400 text-sm mt-16 font-medium"
              >
                Current score: {score} / {totalScore}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Questions; 
