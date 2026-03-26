import React, { useState, useEffect } from 'react';
import {
  Container, Card, Badge, Button, Spinner, Alert,
  ListGroup, Row, Col, Collapse,
} from 'react-bootstrap';
import { listPRReviews } from '../services/repoService';

const VERDICT_VARIANT = {
  approve: 'success',
  request_changes: 'danger',
  comment: 'secondary',
};

const VERDICT_LABEL = {
  approve: '✅ Approved',
  request_changes: '⚠️ Changes requested',
  comment: '💬 Commented',
};

const SEVERITY_VARIANT = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

/**
 * PRReviewsPage
 *
 * Shows all AI-generated PR reviews for the selected repository.
 *
 * Props:
 *   repoId       {number}
 *   repoFullName {string}
 */
function PRReviewsPage({ repoId, repoFullName }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    listPRReviews(repoId)
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [repoId]);

  function toggleExpand(id) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  if (!repoId) {
    return (
      <Container className="py-5 text-center text-muted">
        <p>Connect a repository from the Dashboard first.</p>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 900 }}>
      <h4 className="fw-bold mb-1">PR Reviews</h4>
      <p className="text-muted mb-4">
        AI-generated reviews for pull requests in <code>{repoFullName}</code>
      </p>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2">Loading reviews…</p>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && reviews.length === 0 && (
        <Card className="border-0 shadow-sm text-center p-5 text-muted">
          <p className="mb-1 fw-semibold">No PR reviews yet</p>
          <p className="small">
            Set up a GitHub webhook pointing to{' '}
            <code>POST /webhooks/github</code> on this server to get automatic
            AI reviews when pull requests are opened.
          </p>
        </Card>
      )}

      {reviews.map((review) => (
        <Card key={review.id} className="mb-3 border-0 shadow-sm">
          <Card.Body className="p-4">
            {/* Header */}
            <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="fw-semibold">PR #{review.pull_number}</span>
                  <Badge bg={VERDICT_VARIANT[review.verdict] || 'secondary'}>
                    {VERDICT_LABEL[review.verdict] || review.verdict}
                  </Badge>
                </div>
                <p className="text-muted small mb-0">{review.pr_title || '(no title)'}</p>
              </div>
              <div className="text-muted small text-end">
                {review.posted_at
                  ? new Date(review.posted_at).toLocaleString()
                  : new Date(review.created_at).toLocaleString()}
              </div>
            </div>

            {review.result && (
              <>
                <p className="mt-3 mb-2 small">{review.result.summary}</p>

                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-decoration-none"
                  onClick={() => toggleExpand(review.id)}
                >
                  {expanded[review.id] ? 'Hide details ▲' : 'Show details ▼'}
                </Button>

                <Collapse in={expanded[review.id]}>
                  <div className="mt-3">
                    {/* Issues */}
                    {review.result.issues?.length > 0 && (
                      <>
                        <h6 className="small fw-semibold text-uppercase text-muted mb-2">
                          Issues ({review.result.issues.length})
                        </h6>
                        <ListGroup variant="flush" className="mb-3">
                          {review.result.issues.map((issue, i) => (
                            <ListGroup.Item key={i} className="px-0 py-2 border-0 border-bottom">
                              <Row className="align-items-start g-2">
                                <Col xs="auto">
                                  <Badge bg={SEVERITY_VARIANT[issue.severity] || 'secondary'}>
                                    {issue.severity}
                                  </Badge>
                                </Col>
                                <Col>
                                  <div className="small fw-semibold">{issue.type}</div>
                                  <div className="small text-muted">
                                    <code>{issue.file}</code>
                                    {issue.line && ` : ${issue.line}`}
                                  </div>
                                  <div className="small">{issue.description}</div>
                                  {issue.suggestion && (
                                    <div className="small text-muted mt-1">
                                      💡 {issue.suggestion}
                                    </div>
                                  )}
                                </Col>
                              </Row>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      </>
                    )}

                    {/* Positives */}
                    {review.result.positives?.length > 0 && (
                      <>
                        <h6 className="small fw-semibold text-uppercase text-muted mb-2">
                          Positives
                        </h6>
                        <ul className="small mb-3">
                          {review.result.positives.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Suggested tests */}
                    {review.result.suggested_tests?.length > 0 && (
                      <>
                        <h6 className="small fw-semibold text-uppercase text-muted mb-2">
                          Suggested Tests
                        </h6>
                        <ul className="small mb-0">
                          {review.result.suggested_tests.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </Collapse>
              </>
            )}
          </Card.Body>
        </Card>
      ))}
    </Container>
  );
}

export default PRReviewsPage;
