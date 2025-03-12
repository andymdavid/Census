import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import page components
import Welcome from './pages/Welcome';
import Questions from './pages/Questions';
import Results from './pages/Results';
import ThankYou from './pages/ThankYou';

/**
 * Main App component
 * This is the entry point of our application
 * Implements routing to navigate between different pages
 */
function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Welcome page - Landing page */}
          <Route path="/" element={<Welcome />} />
          
          {/* Questions page - Assessment questions */}
          <Route path="/questions" element={<Questions />} />
          
          {/* Results page - Assessment results and lead capture */}
          <Route path="/results" element={<Results />} />
          
          {/* Thank You page - Final page after submission */}
          <Route path="/thank-you" element={<ThankYou />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
