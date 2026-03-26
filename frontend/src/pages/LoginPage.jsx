import React from 'react';
import { Container, Button, Card } from 'react-bootstrap';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

/**
 * LoginPage
 *
 * Displays a "Sign in with GitHub" button that initiates the OAuth flow.
 * After the OAuth dance, GitHub redirects to /auth/callback on this SPA.
 */
function LoginPage() {
  function handleLogin() {
    window.location.href = `${BACKEND_URL}/auth/github`;
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Card className="border-0 shadow-sm text-center p-5" style={{ maxWidth: 420 }}>
        <div className="mb-4">
          <h1 className="fw-bold display-6">
            DevLens <span className="text-primary">AI</span>
          </h1>
          <p className="text-muted">Codebase intelligence for engineering teams.</p>
        </div>

        <Button
          variant="dark"
          size="lg"
          onClick={handleLogin}
          className="d-flex align-items-center justify-content-center gap-2 w-100"
        >
          {/* GitHub mark SVG */}
          <svg height="20" viewBox="0 0 16 16" width="20" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
              0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
              -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
              .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
              -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
              1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
              1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
              1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Sign in with GitHub
        </Button>

        <p className="text-muted small mt-3">
          We only request <strong>read</strong> access to your repositories.
        </p>
      </Card>
    </Container>
  );
}

export default LoginPage;
