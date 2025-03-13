import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Interface for Welcome page props
 */
interface WelcomeProps {}

/**
 * Welcome page component
 * This is the landing page for the AI Disruption Self-Assessment Tool
 */
const Welcome: React.FC<WelcomeProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();
  // State to track if we're transitioning out
  const [isExiting, setIsExiting] = useState(false);

  // Handle start assessment button click
  const handleStartAssessment = () => {
    setIsExiting(true);
    // Delay navigation to allow exit animation to play
    setTimeout(() => {
      navigate('/questions');
    }, 500);
  };

  // Animation variants for Framer Motion
  const pageVariants = {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.5,
        ease: "easeIn"
      }
    }
  };

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
      transition: {
        duration: 0.3
      }
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
    <motion.div 
      className="typeform-fullscreen"
      variants={pageVariants}
      initial="initial"
      animate={isExiting ? "exit" : "animate"}
      exit="exit"
    >
      <motion.div 
        className="typeform-content"
        variants={containerVariants}
        initial="hidden"
        animate={isExiting ? "exit" : "visible"}
      >
        <motion.div
          className="flex flex-col items-center w-full"
        >
          <motion.h1 
            variants={itemVariants}
            className="text-3xl font-bold text-gray-800 mb-6 text-center"
          >
            AI Disruption Self-Assessment Tool
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-gray-600 mb-8 text-center max-w-2xl"
          >
            This assessment will help you understand how AI might impact your business.
            Answer 12 simple questions to receive a personalized disruption score and recommendations.
          </motion.p>
          
          <motion.div
            variants={itemVariants}
            className="mb-8"
          >
            <ul className="text-gray-600 space-y-2">
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                Takes only 2-3 minutes to complete
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                No personal data collected
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                Get actionable insights
              </li>
            </ul>
          </motion.div>
          
          <motion.button
            variants={buttonVariants}
            onClick={handleStartAssessment}
            className="typeform-button"
            whileHover="hover"
            whileTap="tap"
          >
            Start Assessment
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default Welcome; 