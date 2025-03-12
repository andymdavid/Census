import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Interface for ThankYou page props
 */
interface ThankYouProps {}

/**
 * ThankYou page component
 * This page is displayed after the user completes the assessment and submits their information
 */
const ThankYou: React.FC<ThankYouProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

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
    <div className="typeform-fullscreen">
      <div className="typeform-content">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center w-full"
        >
          <motion.div 
            variants={itemVariants}
            className="mb-8"
          >
            <svg className="w-20 h-20 text-primary mx-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="text-3xl font-bold text-gray-800 mb-4 text-center"
          >
            Thank You!
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-gray-600 mb-8 text-center max-w-2xl"
          >
            Your detailed AI disruption assessment report has been sent to your email.
            Check your inbox for insights and recommendations.
          </motion.p>
          
          <motion.div 
            variants={itemVariants}
            className="mb-8"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Next Steps
            </h3>
            <ul className="text-gray-600 space-y-3 max-w-md">
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-primary mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <span>Review your detailed report to understand your AI disruption risk factors</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-primary mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <span>Share the assessment with colleagues to align on AI readiness</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-primary mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <span>Schedule a consultation with our AI experts to discuss your results</span>
              </li>
            </ul>
          </motion.div>
          
          <motion.button
            variants={buttonVariants}
            onClick={() => navigate('/')}
            className="typeform-button"
            whileHover="hover"
            whileTap="tap"
          >
            Back to Home
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default ThankYou; 