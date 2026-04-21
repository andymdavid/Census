import React, { Suspense, lazy } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import AuthGate from './components/AuthGate';

const Questions = lazy(() => import('./pages/Questions'));
const Results = lazy(() => import('./pages/Results'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const Forms = lazy(() => import('./pages/Forms'));
const Builder = lazy(() => import('./pages/Builder'));
const Analytics = lazy(() => import('./pages/Analytics'));
const PublicForm = lazy(() => import('./pages/PublicForm'));

const RouteFallback = () => (
  <div className="typeform-fullscreen">
    <div className="typeform-content">
      <div className="text-gray-500">Loading...</div>
    </div>
  </div>
);

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
        <Suspense fallback={<RouteFallback />}>
          <AnimatedRoutes />
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
