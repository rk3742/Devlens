'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

let genAI;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Sends a single prompt to Gemini and returns the text response.
 * Automatically retries once on transient 503 errors.
 *
 * @param {string} prompt
 * @param {Object} [generationConfig]
 * @returns {Promise<string>}
 */
async function generateText(prompt, generationConfig = {}) {
  const model = getGenAI().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      ...generationConfig,
    },
  });

  let attempt = 0;
  while (attempt < 2) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      attempt++;
      if (attempt >= 2 || !err.message?.includes('503')) throw err;
      logger.warn(`Gemini 503 – retrying (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Strips markdown code fences that Gemini sometimes wraps around JSON.
 * @param {string} raw
 * @returns {string}
 */
function stripCodeFences(raw) {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/**
 * Sends a prompt and parses the response as JSON.
 * Strips markdown code fences that Gemini sometimes adds around JSON.
 *
 * @param {string} prompt
 * @param {Object} [generationConfig]
 * @returns {Promise<Object>}
 */
async function generateJSON(prompt, generationConfig = {}) {
  const raw = await generateText(prompt, {
    responseMimeType: 'application/json',
    ...generationConfig,
  });

  const cleaned = stripCodeFences(raw);

  try {
    return JSON.parse(cleaned);
  } catch {
    logger.warn('Gemini returned non-JSON; attempting lenient extraction');
    const start = cleaned.search(/[{[]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start === -1 || end === -1) throw new Error('Could not parse Gemini response as JSON');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * Summarises multiple file chunks into a single coherent context string for a prompt.
 * Truncates each chunk to avoid exceeding the context window.
 *
 * @param {Array<{filePath: string, content: string}>} chunks
 * @param {number} [maxTotalChars=80000]
 * @returns {string}
 */
function buildCodeContext(chunks, maxTotalChars = 80_000) {
  let total = 0;
  const parts = [];

  for (const chunk of chunks) {
    const header = `\n\n### FILE: ${chunk.filePath}\n`;
    const available = maxTotalChars - total - header.length;
    if (available <= 0) break;

    const body = chunk.content.slice(0, available);
    parts.push(header + body);
    total += header.length + body.length;
  }

  return parts.join('');
}

// ── Prompt templates ────────────────────────────────────────────────────────

const PROMPTS = {
  architectureOverview: (repoName, codeContext) => `
You are a senior software architect analysing the "${repoName}" codebase.

Based on the source files below, produce a JSON object with this exact schema:
{
  "summary": "<2-3 sentence high-level summary of what the project does>",
  "architecture_style": "<e.g. MVC, microservices, monolith, serverless>",
  "layers": [
    { "name": "<layer name>", "description": "<what it does>", "key_files": ["<path>", ...] }
  ],
  "tech_stack": ["<tech1>", "<tech2>", ...],
  "entry_points": ["<file path>", ...],
  "external_dependencies": ["<lib or service>", ...]
}

SOURCE FILES:
${codeContext}
`,

  fileSummary: (filePath, fileContent) => `
You are a senior software engineer. Summarise the following source file concisely.

Return JSON with this schema:
{
  "file": "${filePath}",
  "purpose": "<one sentence>",
  "exports": ["<function/class/const name>", ...],
  "dependencies": ["<imported module>", ...],
  "complexity": "<low|medium|high>",
  "notes": "<optional key observations>"
}

FILE CONTENT:
\`\`\`
${fileContent.slice(0, 12000)}
\`\`\`
`,

  dataFlow: (repoName, codeContext) => `
You are a senior software architect. Analyse data flow in "${repoName}".

Return JSON with this schema:
{
  "data_sources": ["<DB, API, file, user input, ...>"],
  "flows": [
    {
      "name": "<flow name, e.g. 'User authentication'>",
      "steps": ["<step 1>", "<step 2>", ...],
      "files_involved": ["<path>", ...]
    }
  ],
  "state_management": "<description of how state is managed>",
  "external_apis": ["<API name>", ...]
}

SOURCE FILES:
${codeContext}
`,

  startHere: (repoName, codeContext) => `
You are a senior engineer onboarding a new developer to "${repoName}".

Return JSON with this schema:
{
  "overview": "<3-4 sentence project overview>",
  "setup_steps": ["<step 1>", "<step 2>", ...],
  "key_concepts": [
    { "concept": "<name>", "explanation": "<brief explanation>", "relevant_files": ["<path>"] }
  ],
  "recommended_reading_order": ["<file path>", ...],
  "common_pitfalls": ["<pitfall>", ...]
}

SOURCE FILES:
${codeContext}
`,

  complexity: (codeContext) => `
Analyse the code complexity of the following source files.

Return JSON with this schema:
{
  "overall_complexity": "<low|medium|high|very high>",
  "hotspots": [
    {
      "file": "<path>",
      "issue": "<description>",
      "severity": "<low|medium|high>",
      "suggestion": "<how to improve>"
    }
  ],
  "metrics": {
    "deeply_nested_functions": <count>,
    "large_files": <count>,
    "complex_conditionals": <count>
  }
}

SOURCE FILES:
${codeContext}
`,

  deadCode: (codeContext) => `
Identify potentially unused or dead code in the following source files.

Return JSON with this schema:
{
  "findings": [
    {
      "file": "<path>",
      "type": "<unused_function|unused_variable|unreachable_code|commented_out_code>",
      "description": "<what was found>",
      "line_hint": "<approximate location or function name>",
      "confidence": "<low|medium|high>"
    }
  ],
  "summary": "<overall assessment>"
}

SOURCE FILES:
${codeContext}
`,

  circularDeps: (codeContext) => `
Identify circular dependencies in the following source files.

Return JSON with this schema:
{
  "circular_chains": [
    {
      "chain": ["<fileA>", "<fileB>", "<fileA>"],
      "severity": "<low|medium|high>",
      "suggestion": "<how to break the cycle>"
    }
  ],
  "total_cycles": <number>,
  "summary": "<assessment>"
}

SOURCE FILES:
${codeContext}
`,

  securityScan: (codeContext) => `
Perform a security audit on the following source files.

Return JSON with this schema:
{
  "issues": [
    {
      "file": "<path>",
      "type": "<e.g. SQL_INJECTION|XSS|HARDCODED_SECRET|INSECURE_DESERIALIZATION|...>",
      "description": "<what the issue is>",
      "severity": "<low|medium|high|critical>",
      "line_hint": "<approximate location>",
      "recommendation": "<how to fix>"
    }
  ],
  "overall_risk": "<low|medium|high|critical>",
  "summary": "<overall security assessment>"
}

SOURCE FILES:
${codeContext}
`,

  techDebt: (codeContext) => `
Assess the technical debt in the following source files.

Return JSON with this schema:
{
  "overall_debt_level": "<low|medium|high|critical>",
  "debt_items": [
    {
      "file": "<path>",
      "category": "<code_duplication|missing_tests|poor_naming|outdated_dependencies|missing_error_handling|lack_of_documentation|...>",
      "description": "<what the debt is>",
      "effort_to_fix": "<hours: low=<2, medium=2-8, high=>8>",
      "priority": "<low|medium|high>"
    }
  ],
  "total_estimated_hours": <number>,
  "recommendations": ["<recommendation>", ...]
}

SOURCE FILES:
${codeContext}
`,

  codeQA: (question, codeContext) => `
You are an expert software engineer with deep knowledge of the codebase below.
Answer the following question accurately and concisely, citing specific files and line references where possible.

QUESTION: ${question}

SOURCE FILES:
${codeContext}
`,

  prReview: (prTitle, prBody, diff) => `
You are a senior software engineer performing a pull request review.

PR TITLE: ${prTitle}
PR DESCRIPTION: ${prBody || '(no description)'}

Review the diff below and return JSON with this schema:
{
  "summary": "<overall assessment of the PR>",
  "verdict": "<approve|request_changes|comment>",
  "issues": [
    {
      "file": "<filename>",
      "line": "<approximate line or hunk>",
      "severity": "<low|medium|high|critical>",
      "type": "<bug|security|performance|style|logic|test_missing>",
      "description": "<what the issue is>",
      "suggestion": "<how to fix>"
    }
  ],
  "positives": ["<good thing about this PR>", ...],
  "suggested_tests": ["<test case description>", ...]
}

DIFF:
\`\`\`diff
${diff.slice(0, 50000)}
\`\`\`
`,
};

module.exports = { generateText, generateJSON, buildCodeContext, PROMPTS };
