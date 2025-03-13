import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import questions from '../data/questions';

/**
 * Interface for Questions page props
 */
interface QuestionsProps {}

/**
 * Questions page component
 * This page displays the assessment questions and collects user responses
 * with a Typeform-like aesthetic and animations
 */
const Questions: React.FC<QuestionsProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // State to track current question index
  const [currentQuestion, setCurrentQuestion] = useState(0);
  // State to track user answers (yes/no)
  const [answers, setAnswers] = useState<boolean[]>(Array(12).fill(false));
  // State to track total score
  const [score, setScore] = useState(0);
  // State to track direction of transition (forward/backward)
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  // Handle answer selection
  const handleAnswer = (answer: boolean) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);

    // Update score if answer is yes
    let updatedScore = score;
    if (answer) {
      updatedScore = score + questions[currentQuestion].weight;
      setScore(updatedScore);
    }

    // Set direction to forward
    setDirection(1);

    // Move to next question or results page
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prevQuestion => prevQuestion + 1);
    } else {
      // Navigate to results page with the final score
      // Use the updated score directly to ensure the last question's score is included
      navigate('/results', { state: { score: updatedScore } });
    }
  };

  // Handle going back to previous question
  const handlePrevious = () => {
    if (currentQuestion > 0) {
      // Set direction to backward
      setDirection(-1);
      
      // If the previous answer was yes, subtract its weight from the score
      if (answers[currentQuestion - 1]) {
        setScore(prevScore => prevScore - questions[currentQuestion - 1].weight);
      }
      
      // Update answers array
      const newAnswers = [...answers];
      newAnswers[currentQuestion - 1] = false;
      setAnswers(newAnswers);
      
      // Go to previous question
      setCurrentQuestion(prevQuestion => prevQuestion - 1);
    }
  };

  // Current question
  const question = questions[currentQuestion];

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

  return (
    // Full-screen container
    <div className="typeform-fullscreen">
      {/* Top progress bar */}
      <div className="typeform-top-progress">
        <div className="typeform-thin-progress">
          <div 
            className="typeform-thin-progress-fill" 
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Main content area */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentQuestion}
          custom={direction}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="typeform-content"
        >
          {/* Question counter - small and subtle */}
          <div className="text-sm text-gray-400 mb-8 text-center font-medium">
            Question {currentQuestion + 1} of {questions.length}
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
            {currentQuestion > 0 && (
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
              Current score: {score} / 100
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Questions; 