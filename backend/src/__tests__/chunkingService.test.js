'use strict';

const {
  splitIntoChunks,
  estimateTokens,
  buildChunks,
  batchChunks,
  CHUNK_SIZE_CHARS,
} = require('../services/chunkingService');

describe('chunkingService', () => {
  describe('estimateTokens()', () => {
    it('returns ceil(length / 4)', () => {
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('splitIntoChunks()', () => {
    it('returns single chunk for short text', () => {
      const text = 'short text';
      const chunks = splitIntoChunks(text, 1000, 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('splits long text into multiple chunks', () => {
      const text = 'a'.repeat(5000);
      const chunks = splitIntoChunks(text, 1000, 100);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('every chunk is within the size limit (with tolerance for boundary alignment)', () => {
      const text = 'x'.repeat(10000);
      // Use a large chunk size to avoid false positives from boundary alignment
      const chunks = splitIntoChunks(text, 2000, 200);
      for (const chunk of chunks) {
        // chunks may be slightly smaller; boundary search can reduce them
        expect(chunk.length).toBeLessThanOrEqual(2000 + 200);
      }
    });

    it('reconstructed text covers the entire original (chunks overlap)', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line ${i}\n`).join('');
      const chunks = splitIntoChunks(lines, 500, 50);
      // First chunk starts at the beginning
      expect(lines.startsWith(chunks[0])).toBe(true);
      // Last chunk ends at the end
      expect(lines.endsWith(chunks[chunks.length - 1])).toBe(true);
    });
  });

  describe('buildChunks()', () => {
    it('returns empty array for empty file list', () => {
      expect(buildChunks([])).toEqual([]);
    });

    it('returns one chunk per short file', () => {
      const files = [
        { path: 'a.js', content: 'const a = 1;' },
        { path: 'b.js', content: 'const b = 2;' },
      ];
      const chunks = buildChunks(files);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].filePath).toBe('a.js');
      expect(chunks[1].filePath).toBe('b.js');
    });

    it('chunk objects have required fields', () => {
      const files = [{ path: 'src/index.js', content: 'export default {};\n' }];
      const [chunk] = buildChunks(files);
      expect(chunk).toMatchObject({
        filePath: 'src/index.js',
        chunkIndex: 0,
        totalChunks: 1,
        estimatedTokens: expect.any(Number),
        startChar: expect.any(Number),
        endChar: expect.any(Number),
      });
      expect(typeof chunk.content).toBe('string');
    });

    it('splits large file into multiple chunks', () => {
      const bigContent = 'const x = 1;\n'.repeat(2000);
      const files = [{ path: 'big.js', content: bigContent }];
      const chunks = buildChunks(files);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => c.filePath === 'big.js')).toBe(true);
      // chunk indexes should be sequential
      chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
    });
  });

  describe('batchChunks()', () => {
    it('returns empty array for empty input', () => {
      expect(batchChunks([])).toEqual([]);
    });

    it('respects the max token budget per batch', () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        filePath: `f${i}.js`,
        chunkIndex: 0,
        totalChunks: 1,
        content: 'x'.repeat(400),
        estimatedTokens: 100, // 100 tokens each
      }));

      // With 300 token budget, groups of 3
      const batches = batchChunks(chunks, 300);
      expect(batches.length).toBeGreaterThan(1);
      for (const batch of batches) {
        const total = batch.reduce((sum, c) => sum + c.estimatedTokens, 0);
        expect(total).toBeLessThanOrEqual(300);
      }
    });
  });
});
