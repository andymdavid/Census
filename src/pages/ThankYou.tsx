import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Interface for ThankYou page props
 */
interface ThankYouProps {}

/**
 * ThankYou page component
 * This is the final page shown after the user completes the assessment and submits their information
 */
const ThankYou: React.FC<ThankYouProps> = () => {
  // Initialize the navigate function from React Router
  const navigate = useNavigate();

  // Function to handle button click and navigate back to Welcome page
  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
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
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Thank You!
        </h1>
        <p className="text-gray-600 mb-8">
          Your detailed AI vulnerability assessment report has been sent to your email.
          Our team will be in touch shortly to discuss how we can help your business navigate the AI revolution.
        </p>
        <div className="mb-8">
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
        </div>
        <button 
          onClick={handleBackToHome}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-300"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default ThankYou; 