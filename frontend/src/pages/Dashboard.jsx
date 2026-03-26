import React, { useState } from 'react';
import { Container, Row, Col, Card, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import RepoConnect from '../components/RepoConnect';

/**
 * Dashboard
 *
 * Props:
 *   onRepoSelected({repoId, fullName}) – called when a repo is indexed
 */
function Dashboard({ onRepoSelected }) {
  const [indexedRepo, setIndexedRepo] = useState(null);
  const navigate = useNavigate();

  function handleConnectSuccess(result) {
    setIndexedRepo(result);
    onRepoSelected?.({
      repoId: result.repoId,
      fullName: result.fullName || `repo #${result.repoId}`,
    });
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} lg={8}>
          {/* Page header */}
          <div className="mb-5 text-center">
            <h1 className="fw-bold display-6 mb-2">
              DevLens <span className="text-primary">AI</span>
            </h1>
            <p className="text-muted">
              Codebase intelligence — connect a GitHub repository to get started.
            </p>
          </div>

          {/* Connect widget */}
          <RepoConnect onSuccess={handleConnectSuccess} />

          {/* Ingestion result */}
          {indexedRepo && (
            <Card className="mt-4 border-0 shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <h6 className="mb-0 fw-semibold">Repository indexed</h6>
                  <Badge bg="success" pill>
                    Ready
                  </Badge>
                </div>
                <p className="text-muted small mb-3">{indexedRepo.message}</p>
                <Row className="g-3 text-center mb-4">
                  <Col xs={6} md={4}>
                    <div className="p-3 bg-light rounded">
                      <div className="fs-4 fw-bold text-primary">{indexedRepo.fileCount}</div>
                      <div className="small text-muted">Files Indexed</div>
                    </div>
                  </Col>
                  <Col xs={6} md={4}>
                    <div className="p-3 bg-light rounded">
                      <div className="fs-4 fw-bold text-primary">{indexedRepo.chunkCount}</div>
                      <div className="small text-muted">AI Chunks</div>
                    </div>
                  </Col>
                  <Col xs={12} md={4}>
                    <div className="p-3 bg-light rounded">
                      <div className="fs-4 fw-bold text-primary">#{indexedRepo.repoId}</div>
                      <div className="small text-muted">Repo ID</div>
                    </div>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => navigate('/analysis')}>
                    Run Analysis →
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => navigate('/qa')}>
                    Ask Questions →
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default Dashboard;
