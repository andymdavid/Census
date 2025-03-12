import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { motion } from 'framer-motion';

/**
 * Interface for Results page props
 */
interface ResultsProps {
  score: number;
}

/**
 * Interface for form input fields
 */
interface FormInputs {
  name: string;
  email: string;
  company?: string; // Optional field
}

/**
 * Results page component
 * This page displays the assessment results and collects user information
 * with Typeform-like aesthetic and animations
 */
const Results: React.FC<ResultsProps> = ({ score: propScore }) => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();
  
  // Get location state (score) from navigation
  const location = useLocation();
  const score = location.state?.score || propScore;

  // State to track if form is submitted
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Initialize react-hook-form
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<FormInputs>();

  // Calculate vulnerability level based on score
  const getVulnerabilityLevel = () => {
    if (score <= 30) return { level: 'Low', color: 'green' };
    if (score <= 70) return { level: 'Medium', color: 'yellow' };
    return { level: 'High', color: 'red' };
  };

  const vulnerability = getVulnerabilityLevel();

  // Handle form submission
  const onSubmit: SubmitHandler<FormInputs> = (data) => {
    // TODO: Implement API call to save user data
    console.log('Form submitted:', { ...data, score });
    setIsSubmitted(true);
  };

  // Handle navigation to Thank You page
  const handleContinue = () => {
    navigate('/thankyou');
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
          Your Assessment Results
        </motion.h1>

        {/* Results display */}
        <motion.div className="mb-8" variants={itemVariants}>
          {/* Vulnerability level indicator */}
          <div className="flex justify-center mb-4">
            <div className={`text-${vulnerability.color}-600 text-2xl font-bold px-6 py-2 rounded-full ${
              vulnerability.color === 'green' ? 'bg-green-50' : 
              vulnerability.color === 'yellow' ? 'bg-yellow-50' : 
              'bg-red-50'
            }`}>
              {vulnerability.level} Vulnerability
            </div>
          </div>
          
          {/* Score display */}
          <div className="flex justify-center mb-6">
            <div className="text-5xl font-bold">
              {score} / 100
            </div>
          </div>
          
          {/* Vulnerability description */}
          <p className="typeform-text">
            {score <= 30 && "Your business shows low vulnerability to AI disruption. However, staying informed about AI advancements is still important."}
            {score > 30 && score <= 70 && "Your business shows moderate vulnerability to AI disruption. Consider exploring AI integration strategies."}
            {score > 70 && "Your business shows high vulnerability to AI disruption. Immediate action is recommended to adapt your business model."}
          </p>
          
          {/* Divider */}
          <div className="border-t border-gray-200 my-6"></div>
        </motion.div>

        {/* Lead capture form */}
        {!isSubmitted ? (
          <motion.div variants={itemVariants}>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Get Your Detailed Report
            </h2>
            <p className="typeform-text">
              Enter your details below to receive a comprehensive analysis of your business's AI vulnerability and personalized recommendations.
            </p>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  className={`w-full px-4 py-3 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
                  placeholder="John Doe"
                  {...register('name', { 
                    required: 'Name is required' 
                  })}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              
              {/* Email field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className={`w-full px-4 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
                  placeholder="john@example.com"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              
              {/* Company field */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  id="company"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  placeholder="Acme Inc."
                  {...register('company')}
                />
              </div>
              
              {/* Submit button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="typeform-button-primary w-full"
                >
                  Get My Detailed Report
                </button>
              </div>
              
              {/* Privacy note */}
              <p className="text-xs text-gray-500 text-center mt-4">
                We respect your privacy. Your information will not be shared with third parties.
              </p>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-6"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
            <p className="text-green-600 font-medium mb-6 text-xl">
              Thank you! Your detailed report has been sent to your email.
            </p>
            <button
              onClick={handleContinue}
              className="typeform-button-primary"
            >
              Continue
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Results; 