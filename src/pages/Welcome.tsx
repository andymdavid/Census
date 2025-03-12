import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Interface for Welcome page props
 */
interface WelcomeProps {}

/**
 * Welcome page component
 * This is the landing page for the AI assessment tool
 * with Typeform-like aesthetic and animations
 */
const Welcome: React.FC<WelcomeProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Function to handle button click and navigate to Questions page
  const handleStartAssessment = () => {
    navigate('/questions');
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.2
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

  return (
    <div className="typeform-container">
      <motion.div 
        className="typeform-card"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 
          className="typeform-heading"
          variants={itemVariants}
        >
          AI Disruption Self-Assessment
        </motion.h1>
        <motion.p 
          className="typeform-text"
          variants={itemVariants}
        >
          Assess your company's vulnerability to AI disruption with our 12-question assessment.
          This tool evaluates your business based on Load, Language, and Labour criteria.
        </motion.p>
        <motion.div 
          className="flex justify-center"
          variants={itemVariants}
        >
          <button 
            className="typeform-button-primary"
            onClick={handleStartAssessment}
          >
            Start Assessment
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Welcome; 