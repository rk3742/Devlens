import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Badge, Button,
  ListGroup, Spinner,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import RepoConnect from '../components/RepoConnect';
import { listRepositories } from '../services/repoService';

const STATUS_VARIANT = {
  indexed: 'success',
  indexing: 'warning',
  pending: 'secondary',
  error: 'danger',
};

/**
 * Dashboard
 *
 * Props:
 *   onRepoSelected({repoId, fullName}) – called when a repo is selected or freshly indexed
 */
function Dashboard({ onRepoSelected }) {
  const [indexedRepo, setIndexedRepo] = useState(null);
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [activeRepoId, setActiveRepoId] = useState(null);
  const navigate = useNavigate();

  // Load previously-indexed repos on mount
  useEffect(() => {
    listRepositories()
      .then(setRepos)
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, []);

  function handleConnectSuccess(result) {
    setIndexedRepo(result);
    // Add / update in the list
    setRepos((prev) => {
      const exists = prev.find((r) => r.id === result.repoId);
      if (exists) {
        return prev.map((r) =>
          r.id === result.repoId
            ? { ...r, status: 'indexed', file_count: result.fileCount, chunk_count: result.chunkCount }
            : r
        );
      }
      return [
        {
          id: result.repoId,
          full_name: result.fullName,
          status: 'indexed',
          file_count: result.fileCount,
          chunk_count: result.chunkCount,
        },
        ...prev,
      ];
    });
    selectRepo(result.repoId, result.fullName || `repo #${result.repoId}`);
  }

  function selectRepo(repoId, fullName) {
    setActiveRepoId(repoId);
    onRepoSelected?.({ repoId, fullName });
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} lg={10}>
          {/* Page header */}
          <div className="mb-5 text-center">
            <h1 className="fw-bold display-6 mb-2">
              DevLens <span className="text-primary">AI</span>
            </h1>
            <p className="text-muted">
              Codebase intelligence — connect a GitHub repository to get started.
            </p>
          </div>

          <Row className="g-4">
            {/* Left: connect widget + recent result */}
            <Col xs={12} lg={7}>
              <RepoConnect onSuccess={handleConnectSuccess} />

              {indexedRepo && (
                <Card className="mt-4 border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <h6 className="mb-0 fw-semibold">Repository indexed</h6>
                      <Badge bg="success" pill>Ready</Badge>
                    </div>
                    <p className="text-muted small mb-3">{indexedRepo.message}</p>
                    <Row className="g-3 text-center mb-4">
                      <Col xs={4}>
                        <div className="p-3 bg-light rounded">
                          <div className="fs-5 fw-bold text-primary">{indexedRepo.fileCount}</div>
                          <div className="small text-muted">Files</div>
                        </div>
                      </Col>
                      <Col xs={4}>
                        <div className="p-3 bg-light rounded">
                          <div className="fs-5 fw-bold text-primary">{indexedRepo.chunkCount}</div>
                          <div className="small text-muted">AI Chunks</div>
                        </div>
                      </Col>
                      <Col xs={4}>
                        <div className="p-3 bg-light rounded">
                          <div className="fs-5 fw-bold text-primary">#{indexedRepo.repoId}</div>
                          <div className="small text-muted">Repo ID</div>
                        </div>
                      </Col>
                    </Row>
                    <div className="d-flex gap-2 flex-wrap">
                      <Button variant="primary" size="sm" onClick={() => navigate('/analysis')}>
                        Run Analysis →
                      </Button>
                      <Button variant="outline-primary" size="sm" onClick={() => navigate('/qa')}>
                        Ask Questions →
                      </Button>
                      <Button variant="outline-secondary" size="sm" onClick={() => navigate('/pr-reviews')}>
                        PR Reviews →
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Col>

            {/* Right: previously indexed repos */}
            <Col xs={12} lg={5}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom py-3 px-4">
                  <h6 className="mb-0 fw-semibold">My Repositories</h6>
                </Card.Header>
                <Card.Body className="p-0">
                  {reposLoading ? (
                    <div className="text-center py-4">
                      <Spinner size="sm" />
                    </div>
                  ) : repos.length === 0 ? (
                    <p className="text-muted small p-4 mb-0">
                      No repositories indexed yet. Connect one to get started!
                    </p>
                  ) : (
                    <ListGroup variant="flush">
                      {repos.map((repo) => (
                        <ListGroup.Item
                          key={repo.id}
                          action
                          active={activeRepoId === repo.id}
                          onClick={() => selectRepo(repo.id, repo.full_name)}
                          className="d-flex justify-content-between align-items-center px-4 py-3"
                        >
                          <div className="overflow-hidden me-2">
                            <div className="small fw-semibold text-truncate">
                              {repo.full_name}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {repo.file_count ?? '–'} files · {repo.chunk_count ?? '–'} chunks
                            </div>
                          </div>
                          <Badge
                            bg={STATUS_VARIANT[repo.status] || 'secondary'}
                            pill
                            style={{ flexShrink: 0 }}
                          >
                            {repo.status}
                          </Badge>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
}

export default Dashboard;

