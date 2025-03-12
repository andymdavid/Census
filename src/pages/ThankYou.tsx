import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Interface for ThankYou page props
 */
interface ThankYouProps {}

/**
 * ThankYou page component
 * This is the final page shown after the user completes the assessment and submits their information
 * with Typeform-like aesthetic and animations
 */
const ThankYou: React.FC<ThankYouProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Function to handle button click and navigate back to Welcome page
  const handleBackToHome = () => {
    navigate('/');
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
        className="typeform-card text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="flex justify-center mb-6"
          variants={itemVariants}
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-green-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </motion.div>
        <motion.h1 
          className="typeform-heading"
          variants={itemVariants}
        >
          Thank You!
        </motion.h1>
        <motion.p 
          className="typeform-text"
          variants={itemVariants}
        >
          Your detailed AI vulnerability assessment report has been sent to your email.
          Our team will be in touch shortly to discuss how we can help your business navigate the AI revolution.
        </motion.p>
        <motion.div 
          className="mb-8"
          variants={itemVariants}
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            What's Next?
          </h2>
          <ul className="text-left text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Review your detailed report</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Schedule a consultation with our AI experts</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Explore our resources on AI adaptation strategies</span>
            </li>
          </ul>
        </motion.div>
        <motion.button 
          onClick={handleBackToHome}
          className="typeform-button-primary"
          variants={itemVariants}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Back to Home
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ThankYou; 