'use strict';

const { generateJSON, buildCodeContext, PROMPTS } = require('../services/aiService');

// We don't want to hit the real Gemini API in tests.
// Mock the @google/generative-ai module.
jest.mock('@google/generative-ai', () => {
  const mockGenerate = jest.fn().mockResolvedValue({
    response: { text: () => '{"summary":"mocked","verdict":"approve","issues":[],"positives":[],"suggested_tests":[]}' },
  });
  const MockModel = jest.fn().mockImplementation(() => ({
    generateContent: mockGenerate,
  }));
  const MockGenAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => new MockModel(),
  }));
  return { GoogleGenerativeAI: MockGenAI };
});

describe('aiService', () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  describe('buildCodeContext()', () => {
    it('formats chunks with file headers', () => {
      const chunks = [
        { filePath: 'src/index.js', content: 'const x = 1;' },
        { filePath: 'src/app.js', content: 'module.exports = {};' },
      ];
      const ctx = buildCodeContext(chunks);
      expect(ctx).toContain('### FILE: src/index.js');
      expect(ctx).toContain('const x = 1;');
      expect(ctx).toContain('### FILE: src/app.js');
    });

    it('truncates when maxTotalChars is small', () => {
      const chunks = [{ filePath: 'big.js', content: 'x'.repeat(10000) }];
      const ctx = buildCodeContext(chunks, 100);
      expect(ctx.length).toBeLessThanOrEqual(200); // header + truncated content
    });

    it('returns empty string for no chunks', () => {
      expect(buildCodeContext([])).toBe('');
    });
  });

  describe('PROMPTS templates', () => {
    it('architectureOverview includes repo name', () => {
      const prompt = PROMPTS.architectureOverview('my-repo', 'code here');
      expect(prompt).toContain('my-repo');
      expect(prompt).toContain('code here');
    });

    it('prReview includes PR title and diff', () => {
      const prompt = PROMPTS.prReview('Fix bug', 'description', 'diff content');
      expect(prompt).toContain('Fix bug');
      expect(prompt).toContain('diff content');
    });

    it('codeQA includes the question', () => {
      const prompt = PROMPTS.codeQA('How does auth work?', 'code context');
      expect(prompt).toContain('How does auth work?');
    });

    it('securityScan requests issues array in JSON schema', () => {
      const prompt = PROMPTS.securityScan('some code');
      expect(prompt).toContain('"issues"');
      expect(prompt).toContain('severity');
    });
  });

  describe('generateJSON()', () => {
    it('calls Gemini and parses JSON response', async () => {
      const result = await generateJSON('test prompt');
      expect(result).toMatchObject({ summary: 'mocked' });
    });
  });
});
