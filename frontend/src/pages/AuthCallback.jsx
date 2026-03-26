import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, Container } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';

/**
 * AuthCallback
 *
 * Handles the redirect from our backend OAuth flow.
 * The backend passes the JWT and username in the URL fragment:
 *   /auth/callback#token=<jwt>&username=<name>
 *
 * Fragments are never sent to the server (privacy-safe).
 */
function AuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const username = params.get('username');

    if (token) {
      login(token, username);
      navigate('/', { replace: true });
    } else {
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [login, navigate]);

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="text-center">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <p className="text-muted">Completing sign in…</p>
      </div>
    </Container>
  );
}

export default AuthCallback;
