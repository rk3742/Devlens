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

/**
 * ProtectedRoute – redirects unauthenticated users to /login.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // or a full-page spinner
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * AppShell – holds shared state (selected repo) so AnalysisPage and QAPage
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

