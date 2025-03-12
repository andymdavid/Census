import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import questions from '../data/questions';

/**
 * Interface for Questions page props
 */
interface QuestionsProps {}

/**
 * Questions page component
 * This page displays the assessment questions and collects user responses
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>Category: {question.category}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question */}
        <h2 className="text-xl font-semibold text-gray-800 mb-8 text-center">
          {question.text}
        </h2>

        {/* Answer buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => handleAnswer(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-8 rounded-md transition duration-300"
          >
            Yes
          </button>
          <button
            onClick={() => handleAnswer(false)}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-8 rounded-md transition duration-300"
          >
            No
          </button>
        </div>

        {/* Score display (for development purposes) */}
        <div className="mt-8 text-center text-gray-500">
          Current score: {score} / 100
        </div>
      </div>
    </div>
  );
};

export default Questions; 