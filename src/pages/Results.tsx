import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Interface for Results page props
 */
interface ResultsProps {}

/**
 * Results page component
 * This page displays the assessment results and collects user information
 */
const Results: React.FC<ResultsProps> = () => {
  // Get the score from the location state
  const location = useLocation();
  const navigate = useNavigate();
  const score = location.state?.score || 0;

  // State for form inputs
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would send this data to a server
    console.log({ name, email, company, score });
    setSubmitted(true);
    
    // Navigate to thank you page
    setTimeout(() => {
      navigate('/thank-you');
    }, 1500);
  };

  // Get result category based on score
  const getResultCategory = () => {
    if (score < 30) return 'Low Risk';
    if (score < 60) return 'Medium Risk';
    return 'High Risk';
  };

  // Get result description based on score
  const getResultDescription = () => {
    if (score < 30) {
      return 'Your role or business appears to have a lower risk of AI disruption in the near term. However, staying informed about AI developments is still important.';
    }
    if (score < 60) {
      return 'Your role or business shows moderate vulnerability to AI disruption. Consider exploring how AI might augment your work or create new opportunities.';
    }
    return 'Your role or business shows significant vulnerability to AI disruption. We recommend developing a strategy to adapt to AI changes in your industry.';
  };

  // Animation variants
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
        {submitted ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="text-2xl font-bold text-gray-800 mb-4">Thank you!</div>
            <div className="text-gray-600">Redirecting you to the next step...</div>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center w-full"
          >
            <motion.div 
              variants={itemVariants}
              className="text-sm text-gray-400 mb-4 font-medium"
            >
              Your Assessment Results
            </motion.div>
            
            <motion.h2 
              variants={itemVariants}
              className="text-3xl font-bold text-gray-800 mb-2 text-center"
            >
              {getResultCategory()}
            </motion.h2>
            
            <motion.div 
              variants={itemVariants}
              className="flex items-center justify-center mb-6"
            >
              <div className="text-4xl font-bold text-primary">{score}</div>
              <div className="text-gray-500 ml-2">/ 100</div>
            </motion.div>
            
            <motion.p 
              variants={itemVariants}
              className="text-gray-600 mb-8 text-center max-w-2xl"
            >
              {getResultDescription()}
            </motion.p>
            
            <motion.form 
              variants={itemVariants}
              onSubmit={handleSubmit}
              className="w-full max-w-md"
            >
              <div className="mb-6">
                <label htmlFor="name" className="block text-sm font-medium text-gray-600 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
              
              <div className="mb-8">
                <label htmlFor="company" className="block text-sm font-medium text-gray-600 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <motion.button
                type="submit"
                className="typeform-button w-full"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                Get Detailed Report
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Results; 