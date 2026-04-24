import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadForm } from '../data/loadForm';
import type { LoadedFormSchema } from '../types/formSchema';
import { isScoringEnabled } from '../../shared/formFlow';

const defaultForm = loadForm();

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
  const form = (location.state?.form as LoadedFormSchema | undefined) ?? defaultForm;
  const formId = location.state?.formId as string | undefined;
  const responseId = location.state?.responseId as string | undefined;
  const scoringEnabled = isScoringEnabled(form);
  const logoUrl = form.theme?.logoUrl;
  const themeStyles = form.theme
    ? ({
        '--color-primary': form.theme.primaryColor,
        '--color-background': form.theme.backgroundColor,
        '--color-text': form.theme.textColor,
        fontFamily: form.theme.fontFamily,
      } as React.CSSProperties)
    : undefined;

  // State for form inputs
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // State to track if we're transitioning out
  const [isExiting, setIsExiting] = useState(false);

  // Handle form submission
  const readApiError = async (response: Response, fallback: string) => {
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        return data.error;
      }
    } catch {
      // ignore parse errors and use the fallback message
    }
    return fallback;
  };

  const finishFlow = () => {
    setSubmitted(true);

    // Delay navigation to allow transition animation
    setTimeout(() => {
      setIsExiting(true);

      // Navigate to thank you page after exit animation
      setTimeout(() => {
        navigate('/thank-you');
      }, 500);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    if (formId) {
      try {
        const response = await fetch(`/api/forms/${formId}/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            email,
            company,
            responseId,
          }),
        });
        if (!response.ok) {
          setSubmitError(await readApiError(response, 'Unable to submit your details.'));
          setSubmitting(false);
          return;
        }
      } catch {
        setSubmitError('Unable to submit your details. Check your connection and try again.');
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    finishFlow();
  };

  // Get result category based on score
  const getResult = () => {
    const match = form.results.find((result) => {
      const meetsMin = result.minScore === undefined || score >= result.minScore;
      const meetsMax = result.maxScore === undefined || score < result.maxScore;
      return meetsMin && meetsMax;
    });

    return match ?? form.results[form.results.length - 1];
  };

  const result = scoringEnabled ? getResult() : form.results[0];

  // Animation variants
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
      style={themeStyles}
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
        {logoUrl && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <img src={logoUrl} alt="Form logo" className="h-10 object-contain" />
          </div>
        )}
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
            className="flex flex-col items-center w-full"
          >
            {scoringEnabled && (
              <motion.div 
                variants={itemVariants}
                className="text-sm text-gray-400 mb-4 font-medium"
              >
                Your Assessment Results
              </motion.div>
            )}
            
            {result && (
              <motion.h2 
                variants={itemVariants}
                className="text-3xl font-bold text-gray-800 mb-2 text-center"
              >
                {result.label}
              </motion.h2>
            )}
            
            {scoringEnabled && (
              <motion.div 
                variants={itemVariants}
                className="flex items-center justify-center mb-6"
              >
                <div className="text-4xl font-bold text-primary">{score}</div>
                <div className="text-gray-500 ml-2">/ {form.totalScore}</div>
              </motion.div>
            )}
            
            {result && (
              <motion.p 
                variants={itemVariants}
                className="text-gray-600 mb-8 text-center max-w-2xl"
              >
                {result.description}
              </motion.p>
            )}
            
            <motion.form 
              variants={itemVariants}
              onSubmit={handleSubmit}
              className="w-full max-w-md"
            >
              {submitError && (
                <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
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
                whileHover={submitting ? undefined : 'hover'}
                whileTap={submitting ? undefined : 'tap'}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Contact Stakwork'}
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Results; 
