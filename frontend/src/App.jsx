import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

import { AuthProvider, useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import AnalysisPage from './pages/AnalysisPage';
import QAPage from './pages/QAPage';
import PRReviewsPage from './pages/PRReviewsPage';

/**
 * ProtectedRoute – shows a centred spinner while auth is resolving, then
 * redirects unauthenticated users to /login.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * AppShell – holds shared state (selected repo) so all feature pages
 * can receive it without a full state manager.
 */
function AppShell() {
  const [selectedRepo, setSelectedRepo] = useState(null);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard onRepoSelected={setSelectedRepo} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis"
          element={
            <ProtectedRoute>
              <AnalysisPage
                repoId={selectedRepo?.repoId}
                repoFullName={selectedRepo?.fullName}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/qa"
          element={
            <ProtectedRoute>
              <QAPage
                repoId={selectedRepo?.repoId}
                repoFullName={selectedRepo?.fullName}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pr-reviews"
          element={
            <ProtectedRoute>
              <PRReviewsPage
                repoId={selectedRepo?.repoId}
                repoFullName={selectedRepo?.fullName}
              />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

