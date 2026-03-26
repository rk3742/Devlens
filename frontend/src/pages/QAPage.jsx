import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Row, Col, Card, Button, Form,
  Spinner, Alert, ListGroup, Badge,
} from 'react-bootstrap';
import {
  createSession,
  listSessions,
  getMessages,
  askQuestion,
} from '../services/qaService';

let _msgIdCounter = 0;
function nextMsgId() { return ++_msgIdCounter; }

/**
 * QAPage
 *
 * Chat-style interface for natural language Q&A over a codebase.
 *
 * Props:
 *   repoId       {number}
 *   repoFullName {string}
 */
function QAPage({ repoId, repoFullName }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  // Load sessions when repoId changes
  useEffect(() => {
    if (!repoId) return;
    setSessionsLoading(true);
    listSessions(repoId)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, [repoId]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSession) return;
    getMessages(activeSession.id)
      .then(setMessages)
      .catch(() => {});
  }, [activeSession]);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleNewSession() {
    const sessionId = await createSession(repoId, 'New conversation');
    const newSession = { id: sessionId, title: 'New conversation', message_count: 0 };
    setSessions((p) => [newSession, ...p]);
    setActiveSession(newSession);
    setMessages([]);
  }

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || !activeSession) return;

    const q = question.trim();
    setQuestion('');
    setError(null);

    // Optimistically add user message
    const optimisticMsg = { id: nextMsgId(), role: 'user', content: q, created_at: new Date().toISOString() };
    setMessages((p) => [...p, optimisticMsg]);

    setLoading(true);
    try {
      const { answer } = await askQuestion(activeSession.id, repoId, q);
      const assistantMsg = {
        id: nextMsgId(),
        role: 'assistant',
        content: answer,
        created_at: new Date().toISOString(),
      };
      setMessages((p) => [...p, assistantMsg]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    <Container className="py-4" style={{ maxWidth: 1100 }}>
      <h4 className="fw-bold mb-1">Code Q&A</h4>
      <p className="text-muted mb-4">
        Ask anything about <code>{repoFullName}</code>
      </p>

      <Row style={{ height: 'calc(100vh - 220px)' }}>
        {/* Session list */}
        <Col md={3} className="d-flex flex-column">
          <Button
            variant="primary"
            size="sm"
            className="mb-2 w-100"
            onClick={handleNewSession}
          >
            + New conversation
          </Button>

          {sessionsLoading ? (
            <div className="text-center py-3"><Spinner size="sm" /></div>
          ) : (
            <ListGroup className="overflow-auto flex-grow-1">
              {sessions.map((s) => (
                <ListGroup.Item
                  key={s.id}
                  action
                  active={activeSession?.id === s.id}
                  onClick={() => setActiveSession(s)}
                  className="small"
                >
                  <div className="d-flex justify-content-between">
                    <span className="text-truncate">{s.title}</span>
                    <Badge bg="secondary" pill>{s.message_count}</Badge>
                  </div>
                </ListGroup.Item>
              ))}
              {sessions.length === 0 && (
                <p className="text-muted small p-2 mb-0">No conversations yet.</p>
              )}
            </ListGroup>
          )}
        </Col>

        {/* Chat area */}
        <Col md={9} className="d-flex flex-column">
          {activeSession ? (
            <>
              <Card className="flex-grow-1 border-0 shadow-sm mb-2" style={{ overflowY: 'auto' }}>
                <Card.Body className="p-3">
                  {messages.length === 0 && !loading && (
                    <p className="text-muted small text-center mt-4">
                      Ask a question about the codebase to get started.
                    </p>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`d-flex mb-3 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
                    >
                      <div
                        className={`p-3 rounded-3 small ${
                          msg.role === 'user'
                            ? 'bg-primary text-white'
                            : 'bg-light border'
                        }`}
                        style={{ maxWidth: '80%', whiteSpace: 'pre-wrap' }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="d-flex justify-content-start mb-3">
                      <div className="bg-light border p-3 rounded-3 small">
                        <Spinner size="sm" className="me-2" />Thinking…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </Card.Body>
              </Card>

              {error && <Alert variant="danger" className="small py-2">{error}</Alert>}

              <Form onSubmit={handleAsk}>
                <Row className="g-2">
                  <Col>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Ask a question about the codebase…"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAsk(e);
                        }
                      }}
                    />
                  </Col>
                  <Col xs="auto" className="d-flex align-items-end">
                    <Button type="submit" variant="primary" disabled={loading || !question.trim()}>
                      Send
                    </Button>
                  </Col>
                </Row>
              </Form>
            </>
          ) : (
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              <p>Select or create a conversation on the left.</p>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default QAPage;
