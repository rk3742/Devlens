import React from 'react';
import { Navbar as BsNavbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <BsNavbar bg="dark" variant="dark" expand="md" className="shadow-sm">
      <Container>
        <BsNavbar.Brand as={Link} to="/" className="fw-bold">
          DevLens <span className="text-primary">AI</span>
        </BsNavbar.Brand>

        <BsNavbar.Toggle aria-controls="main-nav" />
        <BsNavbar.Collapse id="main-nav">
          {user && (
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
              <Nav.Link as={Link} to="/analysis">Analysis</Nav.Link>
              <Nav.Link as={Link} to="/qa">Q&amp;A</Nav.Link>
              <Nav.Link as={Link} to="/pr-reviews">PR Reviews</Nav.Link>
            </Nav>
          )}

          <Nav className="ms-auto align-items-center gap-2">
            {user ? (
              <>
                <span className="text-white-50 small">@{user.username}</span>
                <Button size="sm" variant="outline-light" onClick={handleLogout}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button as={Link} to="/login" size="sm" variant="primary">
                Sign in with GitHub
              </Button>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}

export default Navbar;
