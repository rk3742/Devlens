import React, { useState } from 'react';
import { Form, Button, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import { connectRepository } from '../services/repoService';

/**
 * RepoConnect
 *
 * Lets the user paste a GitHub repository URL (or enter owner + repo manually)
 * and kicks off the indexing pipeline.
 *
 * Props:
 *   onSuccess(result) – called with the ingestion result when indexing completes
 */
function RepoConnect({ onSuccess }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Parses a GitHub URL like https://github.com/owner/repo[/tree/branch]
   * into { owner, repo, branch? }.
   */
  function parseGitHubUrl(raw) {
    const cleaned = raw.trim().replace(/\.git$/, '');
    // Accept both https://github.com/owner/repo and owner/repo shorthand
    const match = cleaned.match(/(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      setError('Please enter a valid GitHub repository URL or "owner/repo" shorthand.');
      return;
    }

    setLoading(true);
    try {
      const result = await connectRepository({
        owner: parsed.owner,
        repo: parsed.repo,
      });
      onSuccess?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-sm border-0">
      <Card.Body className="p-4">
        <h5 className="fw-semibold mb-1">Connect a GitHub Repository</h5>
        <p className="text-muted small mb-4">
          Paste a GitHub URL or enter <code>owner/repo</code> to start indexing.
        </p>

        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Label className="fw-medium">Repository URL</Form.Label>
              <Form.Control
                type="text"
                placeholder="https://github.com/owner/repo  or  owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
            </Col>

            <Col xs={12} className="d-flex align-items-center gap-3 mt-2">
              <Button type="submit" variant="primary" disabled={loading} className="px-4">
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Indexing…
                  </>
                ) : (
                  'Connect & Index'
                )}
              </Button>

              {loading && (
                <span className="text-muted small">
                  Fetching file tree and building AI chunks — this may take a moment for large repos.
                </span>
              )}
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

export default RepoConnect;
