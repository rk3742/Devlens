'use strict';

/**
 * chunkingService.js
 *
 * Splits source files into token-sized chunks suitable for Gemini API calls.
 *
 * Strategy:
 *  1. Estimate token count (4 chars ≈ 1 token – good enough without a real tokeniser)
 *  2. Split by logical boundaries (blank lines → paragraphs, then chars) to avoid
 *     cutting in the middle of a statement.
 *  3. Add configurable overlap so the AI keeps context across chunk boundaries.
 */

const CHUNK_SIZE_TOKENS = Number(process.env.CHUNK_SIZE_TOKENS) || 3_000;
const CHUNK_OVERLAP_TOKENS = Number(process.env.CHUNK_OVERLAP_TOKENS) || 200;
const CHARS_PER_TOKEN = 4; // rough approximation

const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
const CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

/**
 * Estimates the token count for a string.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Splits a long text into overlapping chunks that fit within the token budget.
 * Prefers splitting at blank-line boundaries (between logical blocks of code).
 *
 * @param {string} text
 * @param {number} [chunkSizeChars]
 * @param {number} [overlapChars]
 * @returns {string[]}
 */
function splitIntoChunks(text, chunkSizeChars = CHUNK_SIZE_CHARS, overlapChars = CHUNK_OVERLAP_CHARS) {
  if (text.length <= chunkSizeChars) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSizeChars, text.length);
    let chunkEnd = end;

    // Try to find a blank-line boundary within the last 20 % of the chunk
    if (end < text.length) {
      const lookbackFrom = start + Math.floor(chunkSizeChars * 0.8);
      const segment = text.slice(lookbackFrom, end);
      const blankLineIdx = segment.lastIndexOf('\n\n');
      if (blankLineIdx !== -1) {
        chunkEnd = lookbackFrom + blankLineIdx + 2; // include the blank line
      } else {
        // Fall back to last newline
        const newlineIdx = segment.lastIndexOf('\n');
        if (newlineIdx !== -1) {
          chunkEnd = lookbackFrom + newlineIdx + 1;
        }
      }
    }

    chunks.push(text.slice(start, chunkEnd));

    // Next chunk starts with overlap
    start = Math.max(chunkEnd - overlapChars, start + 1);
  }

  return chunks;
}

/**
 * Converts a list of parsed files into a list of AI-ready chunk objects.
 * Each chunk carries enough metadata for the AI response to be attributed
 * back to a specific file and byte range.
 *
 * @param {Array<{path: string, content: string}>} files
 * @returns {Array<{
 *   filePath: string,
 *   chunkIndex: number,
 *   totalChunks: number,
 *   content: string,
 *   estimatedTokens: number,
 *   startChar: number,
 *   endChar: number,
 * }>}
 */
function buildChunks(files) {
  const allChunks = [];

  for (const { path: filePath, content } of files) {
    const rawChunks = splitIntoChunks(content);
    const totalChunks = rawChunks.length;

    let charOffset = 0;
    rawChunks.forEach((chunk, index) => {
      const startChar = content.indexOf(chunk, charOffset);
      // indexOf may miss due to overlap; fall back to accumulated offset
      const resolvedStart = startChar !== -1 ? startChar : charOffset;
      const endChar = resolvedStart + chunk.length;

      allChunks.push({
        filePath,
        chunkIndex: index,
        totalChunks,
        content: chunk,
        estimatedTokens: estimateTokens(chunk),
        startChar: resolvedStart,
        endChar,
      });

      // Advance past the non-overlapping portion
      charOffset = Math.max(endChar - CHUNK_OVERLAP_CHARS, charOffset + 1);
    });
  }

  return allChunks;
}

/**
 * Groups chunks into batches where the combined token count stays under
 * a given per-request budget.  Useful when sending multiple small files
 * in a single Gemini request.
 *
 * @param {Array<Object>} chunks     - output of buildChunks()
 * @param {number} [maxTokensPerBatch=8000]
 * @returns {Array<Array<Object>>}   - array of batches
 */
function batchChunks(chunks, maxTokensPerBatch = 8_000) {
  const batches = [];
  let current = [];
  let tokenCount = 0;

  for (const chunk of chunks) {
    if (tokenCount + chunk.estimatedTokens > maxTokensPerBatch && current.length > 0) {
      batches.push(current);
      current = [];
      tokenCount = 0;
    }
    current.push(chunk);
    tokenCount += chunk.estimatedTokens;
  }

  if (current.length > 0) batches.push(current);

  return batches;
}

module.exports = {
  buildChunks,
  batchChunks,
  splitIntoChunks,
  estimateTokens,
  CHUNK_SIZE_CHARS,
  CHUNK_OVERLAP_CHARS,
};
