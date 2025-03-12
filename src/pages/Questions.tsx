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

  // Handle answer selection
  const handleAnswer = (answer: boolean) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);

    // Update score if answer is yes
    if (answer) {
      setScore(prevScore => prevScore + questions[currentQuestion].weight);
    }

    // Move to next question or results page
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prevQuestion => prevQuestion + 1);
    } else {
      // Navigate to results page with the final score
      navigate('/results', { state: { score } });
    }
  };

  // Current question
  const question = questions[currentQuestion];

  // Animation variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
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
      <div className="typeform-content">
        {/* Question counter - small and subtle */}
        <div className="text-sm text-gray-400 mb-8 text-center font-medium">
          Question {currentQuestion + 1} of {questions.length}
        </div>

        {/* Animated question content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
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

            {/* Score display (for development purposes) */}
            <motion.div 
              variants={itemVariants}
              className="text-gray-400 text-sm mt-16 font-medium"
            >
              Current score: {score} / 100
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Questions; 