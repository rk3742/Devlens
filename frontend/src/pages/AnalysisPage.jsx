import React, { useState } from 'react';
import {
  Container, Row, Col, Card, Button, Badge, Spinner,
  Alert, Nav, Tab, ListGroup, Form,
} from 'react-bootstrap';
import { runAnalysis, runFileSummary } from '../services/analysisService';

const ANALYSIS_TYPES = [
  { key: 'architecture_overview', label: 'Architecture Overview', icon: '🏗️' },
  { key: 'data_flow',             label: 'Data Flow',             icon: '🔀' },
  { key: 'start_here',            label: 'Start Here Guide',      icon: '🚀' },
  { key: 'complexity',            label: 'Code Complexity',       icon: '📊' },
  { key: 'dead_code',             label: 'Dead Code',             icon: '🪦' },
  { key: 'circular_deps',         label: 'Circular Deps',         icon: '🔄' },
  { key: 'security_scan',         label: 'Security Scan',         icon: '🔒' },
  { key: 'tech_debt',             label: 'Tech Debt',             icon: '💸' },
];

/**
 * AnalysisPage
 *
 * Props:
 *   repoId  {number} - the currently selected repo id
 *   repoFullName {string} - owner/repo display name
 */
function AnalysisPage({ repoId, repoFullName }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [filePath, setFilePath] = useState('');
  const [fileSummaryResult, setFileSummaryResult] = useState(null);
  const [fileSummaryLoading, setFileSummaryLoading] = useState(false);
  const [fileSummaryError, setFileSummaryError] = useState(null);
  const [activeTab, setActiveTab] = useState('architecture_overview');

  async function handleRun(type) {
    setLoading((p) => ({ ...p, [type]: true }));
    setErrors((p) => ({ ...p, [type]: null }));
    try {
      const data = await runAnalysis(repoId, type);
      setResults((p) => ({ ...p, [type]: data.result }));
    } catch (err) {
      setErrors((p) => ({ ...p, [type]: err.message }));
    } finally {
      setLoading((p) => ({ ...p, [type]: false }));
    }
  }

  async function handleFileSummary(e) {
    e.preventDefault();
    if (!filePath.trim()) return;
    setFileSummaryLoading(true);
    setFileSummaryError(null);
    try {
      const data = await runFileSummary(repoId, filePath.trim());
      setFileSummaryResult(data.result);
    } catch (err) {
      setFileSummaryError(err.message);
    } finally {
      setFileSummaryLoading(false);
    }
  }

  if (!repoId) {
    return (
      <Container className="py-5 text-center text-muted">
        <p>Connect a repository from the Dashboard first.</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h4 className="fw-bold mb-1">Analysis</h4>
      <p className="text-muted mb-4">
        <code>{repoFullName}</code>
      </p>

      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Row>
          {/* Sidebar */}
          <Col md={3}>
            <Nav variant="pills" className="flex-column gap-1">
              {ANALYSIS_TYPES.map((t) => (
                <Nav.Item key={t.key}>
                  <Nav.Link
                    eventKey={t.key}
                    className="d-flex align-items-center gap-2"
                  >
                    <span>{t.icon}</span>
                    <span className="small">{t.label}</span>
                    {results[t.key] && (
                      <Badge bg="success" pill className="ms-auto">✓</Badge>
                    )}
                  </Nav.Link>
                </Nav.Item>
              ))}
              <Nav.Item>
                <Nav.Link eventKey="file_summary" className="d-flex align-items-center gap-2">
                  <span>📄</span>
                  <span className="small">File Summary</span>
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>

          {/* Content */}
          <Col md={9}>
            <Tab.Content>
              {ANALYSIS_TYPES.map((t) => (
                <Tab.Pane key={t.key} eventKey={t.key}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="mb-0">{t.icon} {t.label}</h5>
                        <Button
                          size="sm"
                          variant={results[t.key] ? 'outline-primary' : 'primary'}
                          onClick={() => handleRun(t.key)}
                          disabled={loading[t.key]}
                        >
                          {loading[t.key] ? (
                            <><Spinner size="sm" className="me-1" />Running…</>
                          ) : results[t.key] ? 'Re-run' : 'Run Analysis'}
                        </Button>
                      </div>

                      {errors[t.key] && (
                        <Alert variant="danger" className="small">{errors[t.key]}</Alert>
                      )}

                      {results[t.key] && (
                        <pre
                          className="bg-light rounded p-3 small"
                          style={{ maxHeight: 500, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                        >
                          {JSON.stringify(results[t.key], null, 2)}
                        </pre>
                      )}

                      {!results[t.key] && !loading[t.key] && !errors[t.key] && (
                        <p className="text-muted small">
                          Click "Run Analysis" to generate AI-powered insights for this repository.
                        </p>
                      )}
                    </Card.Body>
                  </Card>
                </Tab.Pane>
              ))}

              {/* File Summary Tab */}
              <Tab.Pane eventKey="file_summary">
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <h5 className="mb-3">📄 File Summary</h5>
                    <Form onSubmit={handleFileSummary} className="mb-3">
                      <Row className="g-2">
                        <Col>
                          <Form.Control
                            type="text"
                            placeholder="src/services/authService.js"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            disabled={fileSummaryLoading}
                          />
                        </Col>
                        <Col xs="auto">
                          <Button type="submit" variant="primary" disabled={fileSummaryLoading}>
                            {fileSummaryLoading ? <Spinner size="sm" /> : 'Summarise'}
                          </Button>
                        </Col>
                      </Row>
                    </Form>

                    {fileSummaryError && (
                      <Alert variant="danger" className="small">{fileSummaryError}</Alert>
                    )}

                    {fileSummaryResult && (
                      <pre
                        className="bg-light rounded p-3 small"
                        style={{ maxHeight: 500, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                      >
                        {JSON.stringify(fileSummaryResult, null, 2)}
                      </pre>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </Container>
  );
}

export default AnalysisPage;
