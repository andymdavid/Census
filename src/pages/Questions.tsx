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

  return (
    // Main container with typeform styling
    <div className="typeform-container">
      {/* Card container */}
      <div className="typeform-card">
        {/* Progress indicator */}
        <div className="typeform-progress-container">
          <div className="typeform-progress-text">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>Category: {question.category}</span>
          </div>
          <div className="typeform-progress-bar">
            <div 
              className="typeform-progress-fill" 
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Animated question content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col items-center"
          >
            {/* Question */}
            <motion.h2 
              variants={itemVariants}
              className="typeform-heading"
            >
              {question.text}
            </motion.h2>

            {/* Answer buttons */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-xs mx-auto"
            >
              <button
                onClick={() => handleAnswer(true)}
                className="typeform-button-success"
              >
                Yes
              </button>
              <button
                onClick={() => handleAnswer(false)}
                className="typeform-button-danger"
              >
                No
              </button>
            </motion.div>

            {/* Score display (for development purposes) */}
            <motion.div 
              variants={itemVariants}
              className="text-gray-500 text-sm mt-8"
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