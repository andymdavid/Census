import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Import page components
import Questions from './pages/Questions';
import Results from './pages/Results';
import ThankYou from './pages/ThankYou';
import Forms from './pages/Forms';
import Builder from './pages/Builder';
import Analytics from './pages/Analytics';
import PublicForm from './pages/PublicForm';
import AuthGate from './components/AuthGate';

/**
 * AnimatedRoutes component
 * This component wraps the routes with AnimatePresence for page transitions
 */
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Workspace home */}
        <Route path="/" element={<Navigate to="/forms" replace />} />
        
        {/* Questions page - Assessment questions */}
        <Route path="/questions" element={<Questions />} />
        
        {/* Results page - Assessment results and lead capture */}
        <Route path="/results" element={<Results />} />
        
        {/* Thank You page - Final page after submission */}
        <Route path="/thank-you" element={<ThankYou />} />

        {/* Forms list page */}
        <Route
          path="/forms"
          element={
            <AuthGate>
              <Forms />
            </AuthGate>
          }
        />

        {/* Form builder page */}
        <Route
          path="/forms/:id/edit"
          element={
            <AuthGate>
              <Builder />
            </AuthGate>
          }
        />

        {/* Form analytics page */}
        <Route
          path="/forms/:id/analytics"
          element={
            <AuthGate>
              <Analytics />
            </AuthGate>
          }
        />

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
