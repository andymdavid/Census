import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loadForm } from '../data/loadForm';
import type { LoadedFormSchema } from '../types/formSchema';

/**
 * Interface for Questions page props
 */
interface QuestionsProps {
  form?: LoadedFormSchema;
  formId?: string;
  onComplete?: (score: number) => void;
  previewMode?: boolean;
}

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
  const groupScreens = allQuestions.filter((q) => q.category === 'Question Group');
  const questions = allQuestions.filter(
    (q) =>
      q.category !== 'Welcome Screen' &&
      q.category !== 'End Screen' &&
      q.category !== 'Question Group'
  );
  const totalScore = form.totalScore;
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
    questions[0]?.id ?? 0
  );
  // State to track user answers
  const [answers, setAnswers] = useState<Record<number, boolean | string | string[]>>({});
  // State to track history for branching
  const [history, setHistory] = useState<number[]>([]);
  // State to track direction of transition (forward/backward)
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  const [showWelcome, setShowWelcome] = useState(Boolean(welcomeScreen));
  const [showEnd, setShowEnd] = useState(false);

  // Handle answer selection
  const hasAnswer = (value?: boolean | string | string[]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value);
  };

  const computeScore = (answersSnapshot: Record<number, boolean | string | string[]>) => {
    return questions.reduce((sum, question) => {
      return hasAnswer(answersSnapshot[question.id]) ? sum + question.weight : sum;
    }, 0);
  };

  const getSequentialNextId = (questionId: number) => {
    const index = allQuestions.findIndex((question) => question.id === questionId);
    if (index === -1) return null;
    return allQuestions[index + 1]?.id ?? null;
  };

  const getNextQuestionId = (questionId: number, answer: boolean) => {
    const question = questionMap.get(questionId);
    if (!question?.branching) {
      return getSequentialNextId(questionId);
    }

    const conditions = question.branching.conditions;
    if (conditions && conditions.length > 0) {
      const matched = conditions.find((condition) => condition.when.answer === answer);
      if (matched) return matched.next;
    }

    if (question.branching.next !== undefined) {
      return question.branching.next;
    }

    return getSequentialNextId(questionId);
  };

  const submitResponse = async (
    answersSnapshot: Record<number, boolean | string | string[]>,
    finalScore: number
  ) => {
    if (!formId) return;

    const visitedIds = [...history, currentQuestionId];
    const payload = {
      answers: visitedIds.map((questionId) => {
        const answer = answersSnapshot[questionId];
        return {
          questionId: String(questionId),
          answer: Array.isArray(answer)
            ? answer.join(', ')
            : typeof answer === 'string'
              ? answer
              : answer
                ? 'yes'
                : 'no',
        };
      }),
      score: finalScore,
    };

    try {
      const response = await fetch(`/api/forms/${formId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { id?: string };
      return data.id ?? null;
    } catch {
      // Ignore submission errors for now.
    }
    return null;
  };

  const proceedToNext = async (
    answersSnapshot: Record<number, boolean | string | string[]>,
    answerBool: boolean
  ) => {
    const updatedScore = computeScore(answersSnapshot);
    setDirection(1);
    const nextId = getNextQuestionId(currentQuestionId, answerBool);

    if (nextId !== null && questionMap.has(nextId)) {
      const nextHistory = [...history, currentQuestionId];
      const visitedIds = new Set([...nextHistory, nextId]);
      const trimmedAnswers: Record<number, boolean | string | string[]> = {};
      for (const [key, value] of Object.entries(answersSnapshot)) {
        const numericKey = Number(key);
        if (visitedIds.has(numericKey)) {
          trimmedAnswers[numericKey] = value as boolean | string | string[];
        }
      }

      setHistory(nextHistory);
      setAnswers(trimmedAnswers);
      setCurrentQuestionId(nextId);
    } else {
      const responseId = await submitResponse(answersSnapshot, updatedScore);
      if (onComplete) {
        onComplete(updatedScore);
      } else if (endScreen) {
        setShowEnd(true);
      } else {
        navigate('/results', { state: { score: updatedScore, form, formId, responseId } });
      }
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
    const nextList = allowMultiple
      ? currentList.includes(option)
        ? currentList.filter((item) => item !== option)
        : [...currentList, option]
      : [option];
    setAnswers((prev) => ({ ...prev, [currentQuestionId]: allowMultiple ? nextList : option }));
    if (!allowMultiple) {
      void proceedToNext({ ...answers, [currentQuestionId]: option }, true);
    }
  };

  const question = questionMap.get(currentQuestionId) ?? questions[0];
  const currentIndexRaw = questions.findIndex((item) => item.id === question?.id);
  const currentIndex = currentIndexRaw === -1 ? 0 : currentIndexRaw;
  const currentStep = history.length + 1;
  const score = computeScore(answers);
  const answerType =
    question?.settings?.answerType ??
    (question?.category === 'Multiple Choice'
      ? 'multiple'
      : question?.category === 'Yes/No'
        ? 'yesno'
        : question?.category === 'Text'
          ? 'long'
        : question?.category === 'Short Text'
            ? 'long'
            : question?.category === 'Email'
              ? 'email'
            : question?.category === 'Number'
                ? 'number'
                : question?.category === 'Date'
                  ? 'date'
                  : 'yesno');
  const isGroup = question?.category === 'Question Group';
  const isRequired = Boolean(question?.settings?.required);
  const currentAnswer = answers[currentQuestionId];
  const canContinue = !isRequired || hasAnswer(currentAnswer);
  const choiceList = [
    ...(question?.settings?.choices ?? ['Choice A']),
    ...(question?.settings?.otherOption ? ['Other'] : []),
  ];
  const blockJustifyClass =
    question?.settings?.verticalAlignment === 'center' ? 'justify-center' : 'justify-start';

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
            <h2 className="typeform-heading">{welcomeScreen.text}</h2>
            {form.description && <p className="typeform-text">{form.description}</p>}
            <button
              type="button"
              className="typeform-button"
              onClick={() => setShowWelcome(false)}
            >
              {welcomeScreen.settings?.buttonLabel ?? 'Start'}
            </button>
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
            <h2 className="typeform-heading">{endScreen.text}</h2>
            {form.description && <p className="typeform-text">{form.description}</p>}
            <button
              type="button"
              className="typeform-button"
              onClick={() => {
                if (previewMode) {
                  setShowEnd(false);
                  setShowWelcome(Boolean(welcomeScreen));
                } else {
                  navigate('/thank-you');
                }
              }}
            >
              {endScreen.settings?.buttonLabel ?? 'Finish'}
            </button>
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
      className={`typeform-fullscreen${previewMode ? ' typeform-preview' : ''}`}
      style={themeStyles}
    >
      {logoUrl && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2">
          <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
        </div>
      )}
      {/* Top progress bar */}
      <div className={`typeform-top-progress${previewMode ? ' typeform-top-progress-preview' : ''}`}>
        <div className="typeform-thin-progress">
          <div 
            className="typeform-thin-progress-fill" 
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
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
          className={`typeform-content${previewMode ? ' typeform-content-preview' : ''}`}
        >
          {/* Question counter - small and subtle */}
          <div className="text-sm text-gray-400 mb-8 text-center font-medium">
            Step {currentStep} of {questions.length}
          </div>

          {/* Animated question content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col w-full"
          >
            <div className={`w-full flex ${blockJustifyClass}`}>
              <div
                className={`w-full grid grid-cols-[36px_1fr] gap-3 ${
                  answerType === 'long' ? 'max-w-none' : 'max-w-[400px]'
                }`}
              >
                <div className="text-sm text-blue-600 font-medium leading-snug flex items-center gap-2 self-start mt-[6px]">
                  <span className="whitespace-nowrap">{question.id}</span>
                  <span className="whitespace-nowrap">→</span>
                </div>
                <div className="flex flex-col items-start text-left">
                  {/* Category label - small and above question */}
                  <motion.div 
                    variants={itemVariants}
                    className="typeform-category"
                  >
                    {question.category}
                  </motion.div>

                  {/* Question - larger and more prominent */}
                  <motion.h2 
                    variants={itemVariants}
                    className="typeform-question text-left mx-0"
                  >
                    {question.text}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </motion.h2>

                  {question.settings?.description && (
                    <motion.p variants={itemVariants} className="typeform-text text-left mx-0">
                      {question.settings.description}
                    </motion.p>
                  )}

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
                  {answerType === 'multiple' ? (
                    <motion.div
                      variants={itemVariants}
                      className="flex flex-col gap-3 w-full max-w-xl items-start"
                    >
                      {choiceList.map((choice) => {
                        const selected = Array.isArray(currentAnswer)
                          ? currentAnswer.includes(choice)
                          : currentAnswer === choice;
                        return (
                          <motion.button
                            key={choice}
                            onClick={() => handleMultipleSelect(choice)}
                            className={`typeform-option-button ${
                              selected ? 'typeform-option-yes' : 'typeform-option-no'
                            }`}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            {choice}
                          </motion.button>
                        );
                      })}
                      {question.settings?.multipleSelection && (
                        <motion.button
                          onClick={() => {
                            if (!canContinue) return;
                            void proceedToNext(
                              { ...answers, [currentQuestionId]: currentAnswer ?? [] },
                              hasAnswer(currentAnswer)
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
                <textarea
                  rows={1}
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [currentQuestionId]: event.target.value }))
                  }
                  maxLength={
                    question.settings?.maxCharactersEnabled ? question.settings.maxCharacters ?? undefined : undefined
                  }
                  className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none resize-none p-0 leading-[1.1] h-[44px]"
                  style={{ fontSize: '28px' }}
                  placeholder="Type your answer here..."
                />
                <div className="text-sm text-blue-700" style={{ marginTop: '2px' }}>
                  <span className="font-medium">Shift</span> + Enter ↵ to make a line break
                </div>
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                      hasAnswer(currentAnswer)
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
                  const widths: Record<string, string> = { MM: 'w-[110px]', DD: 'w-[110px]', YYYY: 'w-[160px]' };
                  return (
                    <div className="flex items-end gap-6 text-blue-700 text-sm">
                      {parts.map((part, index) => (
                        <React.Fragment key={part}>
                          <div className="flex flex-col gap-2">
                            <span>{labels[part]}</span>
                            <input
                              type="text"
                              placeholder={part}
                              className={`${widths[part]} text-[36px] text-blue-200 bg-transparent border-b border-blue-400 focus:outline-none`}
                            />
                          </div>
                          {index < parts.length - 1 && (
                            <div className="text-[36px] text-blue-700 pb-2">{separator}</div>
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
                      hasAnswer(currentAnswer)
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
                  className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                  placeholder="name@example.com"
                />
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                      hasAnswer(currentAnswer)
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
                <input
                  type="number"
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [currentQuestionId]: event.target.value }))
                  }
                  min={
                    question.settings?.minNumberEnabled ? question.settings.minNumber : undefined
                  }
                  max={
                    question.settings?.maxNumberEnabled ? question.settings.maxNumber : undefined
                  }
                  className="w-full bg-transparent text-blue-200 placeholder:text-blue-200 border-b border-blue-400 focus:outline-none p-0 text-[28px] leading-[1.2]"
                  placeholder="Type your answer here..."
                />
                <motion.button
                  onClick={() => {
                    if (!canContinue) return;
                    void proceedToNext(
                      { ...answers, [currentQuestionId]: typeof currentAnswer === 'string' ? currentAnswer : '' },
                      hasAnswer(currentAnswer)
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
            ) : isGroup ? (
              <motion.div variants={itemVariants} className="mt-6 flex items-center gap-3">
                <motion.button
                  onClick={() => {
                    void proceedToNext({ ...answers }, true);
                  }}
                  className="typeform-button"
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
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
                      >
                        Yes
                      </motion.button>
                      <motion.button
                        onClick={() => handleAnswer(false)}
                        className="typeform-option-button typeform-option-no"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        No
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            {/* Back button - only show if not on first question */}
            {history.length > 0 && (
              <motion.button
                variants={itemVariants}
                onClick={handlePrevious}
                className="mt-8 text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </motion.button>
            )}

            {/* Score display (for development purposes) */}
            <motion.div 
              variants={itemVariants}
              className="text-gray-400 text-sm mt-16 font-medium"
            >
              Current score: {score} / {totalScore}
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Questions; 
