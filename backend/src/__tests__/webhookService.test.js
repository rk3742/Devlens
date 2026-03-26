'use strict';

const crypto = require('crypto');

describe('webhookService', () => {
  describe('verifySignature()', () => {
    const secret = 'test-webhook-secret-123';
    const body = Buffer.from(JSON.stringify({ action: 'opened' }));
    let verifySignature;

    beforeEach(() => {
      jest.resetModules();
      process.env.GITHUB_WEBHOOK_SECRET = secret;
      // Re-require after setting env var
      ({ verifySignature } = require('../services/webhookService'));
    });

    afterEach(() => {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    });

    it('accepts a valid HMAC-SHA256 signature', () => {
      const hmac = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
      expect(verifySignature(body, hmac)).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const badSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
      expect(verifySignature(body, badSig)).toBe(false);
    });

    it('rejects a missing signature', () => {
      expect(verifySignature(body, undefined)).toBe(false);
    });
  });

  describe('formatReviewBody()', () => {
    let formatReviewBody;

    beforeAll(() => {
      ({ formatReviewBody } = require('../services/webhookService'));
    });

    const review = {
      summary: 'Good PR overall with one minor issue.',
      verdict: 'comment',
      positives: ['Clean code', 'Good test coverage'],
      issues: [
        {
          file: 'src/auth.js',
          line: '42',
          severity: 'high',
          type: 'security',
          description: 'Potential SQL injection',
          suggestion: 'Use parameterised queries',
        },
      ],
      suggested_tests: ['Test with empty input', 'Test with special characters'],
    };

    it('includes the summary', () => {
      const body = formatReviewBody(review);
      expect(body).toContain('Good PR overall with one minor issue.');
    });

    it('includes positives', () => {
      const body = formatReviewBody(review);
      expect(body).toContain('Clean code');
      expect(body).toContain('Good test coverage');
    });

    it('includes issue details', () => {
      const body = formatReviewBody(review);
      expect(body).toContain('src/auth.js');
      expect(body).toContain('Potential SQL injection');
      expect(body).toContain('Use parameterised queries');
    });

    it('includes suggested tests', () => {
      const body = formatReviewBody(review);
      expect(body).toContain('Test with empty input');
    });

    it('handles missing issues gracefully', () => {
      const minimalReview = { summary: 'LGTM', verdict: 'approve', positives: [], issues: [], suggested_tests: [] };
      expect(() => formatReviewBody(minimalReview)).not.toThrow();
    });
  });
});
