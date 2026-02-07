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
  const questions = allQuestions.filter(
    (q) => q.category !== 'Welcome Screen' && q.category !== 'End Screen'
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
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );

  // State to track current question index
  const [currentQuestionId, setCurrentQuestionId] = useState(
    questions[0]?.id ?? 0
  );
  // State to track user answers (yes/no)
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  // State to track history for branching
  const [history, setHistory] = useState<number[]>([]);
  // State to track direction of transition (forward/backward)
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  const [showWelcome, setShowWelcome] = useState(Boolean(welcomeScreen));
  const [showEnd, setShowEnd] = useState(false);

  // Handle answer selection
  const computeScore = (answersSnapshot: Record<number, boolean>) => {
    return questions.reduce((sum, question) => {
      return answersSnapshot[question.id] ? sum + question.weight : sum;
    }, 0);
  };

  const getSequentialNextId = (questionId: number) => {
    const index = questions.findIndex((question) => question.id === questionId);
    if (index === -1) return null;
    return questions[index + 1]?.id ?? null;
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
    answersSnapshot: Record<number, boolean>,
    finalScore: number
  ) => {
    if (!formId) return;

    const visitedIds = [...history, currentQuestionId];
    const payload = {
      answers: visitedIds.map((questionId) => ({
        questionId: String(questionId),
        answer: answersSnapshot[questionId] ? 'yes' : 'no',
      })),
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

  const handleAnswer = async (answer: boolean) => {
    const newAnswers = { ...answers, [currentQuestionId]: answer };
    setAnswers(newAnswers);
    const updatedScore = computeScore(newAnswers);

    // Set direction to forward
    setDirection(1);

    const nextId = getNextQuestionId(currentQuestionId, answer);

    // Move to next question or results page
    if (nextId !== null && questionMap.has(nextId)) {
      const nextHistory = [...history, currentQuestionId];
      const visitedIds = new Set([...nextHistory, nextId]);
      const trimmedAnswers: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(newAnswers)) {
        const numericKey = Number(key);
        if (visitedIds.has(numericKey)) {
          trimmedAnswers[numericKey] = value;
        }
      }

      setHistory(nextHistory);
      setAnswers(trimmedAnswers);
      setCurrentQuestionId(nextId);
    } else {
      const responseId = await submitResponse(newAnswers, updatedScore);
      if (onComplete) {
        onComplete(updatedScore);
      } else if (endScreen) {
        setShowEnd(true);
      } else {
        // Navigate to results page with the final score
        // Use the updated score directly to ensure the last question's score is included
        navigate('/results', { state: { score: updatedScore, form, formId, responseId } });
      }
    }
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

  const question = questionMap.get(currentQuestionId) ?? questions[0];
  const currentIndexRaw = questions.findIndex((item) => item.id === question?.id);
  const currentIndex = currentIndexRaw === -1 ? 0 : currentIndexRaw;
  const currentStep = history.length + 1;
  const score = computeScore(answers);

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
              Start
            </button>
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
              Finish
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
            className="flex flex-col items-center w-full"
          >
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
              className="typeform-question"
            >
              {question.text}
            </motion.h2>

            {/* Answer buttons - better spacing */}
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
