import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Interface for Welcome page props
 */
interface WelcomeProps {}

/**
 * Welcome page component
 * This is the landing page for the AI assessment tool
 */
const Welcome: React.FC<WelcomeProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Function to handle button click and navigate to Questions page
  const handleStartAssessment = () => {
    navigate('/questions');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          AI Disruption Self-Assessment
        </h1>
        <p className="text-gray-600 mb-8 text-center">
          Assess your company's vulnerability to AI disruption with our 12-question assessment.
          This tool evaluates your business based on Load, Language, and Labour criteria.
        </p>
        <div className="flex justify-center">
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-300"
            onClick={handleStartAssessment}
          >
            Start Assessment
          </button>
        </div>
      </div>
    </div>
  );
};

export default Welcome; 