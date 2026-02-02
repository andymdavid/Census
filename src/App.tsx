import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Import page components
import Welcome from './pages/Welcome';
import Questions from './pages/Questions';
import Results from './pages/Results';
import ThankYou from './pages/ThankYou';
import Forms from './pages/Forms';
import Builder from './pages/Builder';
import Analytics from './pages/Analytics';
import PublicForm from './pages/PublicForm';

/**
 * AnimatedRoutes component
 * This component wraps the routes with AnimatePresence for page transitions
 */
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Welcome page - Landing page */}
        <Route path="/" element={<Welcome />} />
        
        {/* Questions page - Assessment questions */}
        <Route path="/questions" element={<Questions />} />
        
        {/* Results page - Assessment results and lead capture */}
        <Route path="/results" element={<Results />} />
        
        {/* Thank You page - Final page after submission */}
        <Route path="/thank-you" element={<ThankYou />} />

        {/* Forms list page */}
        <Route path="/forms" element={<Forms />} />

        {/* Form builder page */}
        <Route path="/forms/:id/edit" element={<Builder />} />

        {/* Form analytics page */}
        <Route path="/forms/:id/analytics" element={<Analytics />} />

        {/* Public form share page */}
        <Route path="/f/:id" element={<PublicForm />} />
      </Routes>
    </AnimatePresence>
  );
};

/**
 * Main App component
 * This is the entry point of our application
 * Implements routing to navigate between different pages
 */
function App() {
  return (
    <Router>
      <div className="App">
        <AnimatedRoutes />
      </div>
    </Router>
  );
}

export default App;
