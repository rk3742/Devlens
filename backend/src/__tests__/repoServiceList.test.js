'use strict';

/**
 * Tests for the new list/PR-review methods added to repoService.
 * We mock the DB pool so no actual MySQL connection is needed.
 */

const mockExecute = jest.fn();
jest.mock('../config/database', () => ({
  getPool: () => ({ execute: mockExecute }),
}));

const { listUserRepos, listPRReviews } = require('../services/repoService');

describe('repoService – listing functions', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  describe('listUserRepos()', () => {
    it('returns an array of repositories for a user', async () => {
      const fakeRows = [
        { id: 1, full_name: 'alice/myrepo', status: 'indexed', file_count: 42, chunk_count: 120 },
        { id: 2, full_name: 'alice/another', status: 'error',   file_count: 0,  chunk_count: 0 },
      ];
      mockExecute.mockResolvedValueOnce([fakeRows]);

      const result = await listUserRepos(99);

      expect(result).toHaveLength(2);
      expect(result[0].full_name).toBe('alice/myrepo');
      expect(result[1].status).toBe('error');

      // Should have called execute with the user id bound
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('WHERE r.user_id = ?');
      expect(params).toEqual([99]);
    });

    it('returns empty array when user has no repos', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const result = await listUserRepos(99);
      expect(result).toEqual([]);
    });
  });

  describe('listPRReviews()', () => {
    it('parses the JSON result field in each review', async () => {
      const fakeRows = [
        {
          id: 1,
          pull_number: 42,
          pr_title: 'Fix auth bug',
          verdict: 'approve',
          result: JSON.stringify({ summary: 'LGTM', issues: [], positives: ['clean'], suggested_tests: [] }),
          posted_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockExecute.mockResolvedValueOnce([fakeRows]);

      const reviews = await listPRReviews(1, 99);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].result).toMatchObject({ summary: 'LGTM' });
      expect(reviews[0].pull_number).toBe(42);

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('WHERE pr.repo_id = ? AND r.user_id = ?');
      expect(params).toEqual([1, 99]);
    });

    it('returns null result when result field is null/missing', async () => {
      const fakeRows = [
        { id: 2, pull_number: 7, pr_title: 'WIP', verdict: 'comment', result: null, posted_at: null, created_at: '2024-01-02' },
      ];
      mockExecute.mockResolvedValueOnce([fakeRows]);

      const reviews = await listPRReviews(1, 99);
      expect(reviews[0].result).toBeNull();
    });

    it('returns empty array when no reviews exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const reviews = await listPRReviews(1, 99);
      expect(reviews).toEqual([]);
    });
  });
});
