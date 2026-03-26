'use strict';

/**
 * File extensions that are treated as source code / text and sent to the AI.
 * Everything else is skipped to avoid wasting tokens on binary or generated content.
 */
const ALLOWED_EXTENSIONS = new Set([
  // Web / JS ecosystem
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Backend languages
  '.py', '.rb', '.php', '.java', '.kt', '.scala',
  '.go', '.rs', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  '.cs', '.fs', '.vb',
  // Shell / scripting
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1',
  // Config / data / docs
  '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.env',
  '.md', '.mdx', '.txt', '.rst',
  '.xml', '.graphql', '.gql', '.proto',
  // Build / tooling
  '.dockerfile', '.makefile', '.mk',
  // SQL
  '.sql',
  // Swift / Dart / others
  '.swift', '.dart', '.ex', '.exs', '.erl', '.elm', '.clj',
  '.r', '.m', '.mm',
]);

/**
 * Directory names that are always excluded from analysis.
 * Any path segment matching one of these entries is filtered out.
 */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'vendor',
  'bower_components',
  '.gradle',
  '.idea',
  '.vscode',
  'target',
  'bin',
  'obj',
  '.dart_tool',
  '.pub-cache',
  'Pods',
  'DerivedData',
  '.cargo',
]);

/**
 * File name patterns that are always excluded.
 */
const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock',
  'Podfile.lock',
  'poetry.lock',
  'cargo.lock',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
  '.env.test',
]);

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES) || 524_288; // 512 KB
const MAX_FILES_PER_REPO = Number(process.env.MAX_FILES_PER_REPO) || 5_000;

/**
 * Binary-file detection heuristic: checks if a Buffer contains a null byte
 * in the first 8 KB, which is a reliable indicator of binary content.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isBinaryBuffer(buffer) {
  const sample = buffer.slice(0, 8192);
  return sample.includes(0x00);
}

/**
 * Determines whether a file path should be included in analysis.
 *
 * @param {string} filePath   - repo-relative POSIX path (e.g. "src/index.js")
 * @param {number} [sizeBytes] - file size reported by GitHub tree API
 * @returns {boolean}
 */
function shouldIncludeFile(filePath, sizeBytes) {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];

  // Skip excluded directories anywhere in the path
  for (const part of parts.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(part)) return false;
    // Also catch hidden directories (e.g. .cache, .turbo) beyond the known list
    if (part.startsWith('.') && part !== '.github') return false;
  }

  // Skip excluded filenames
  if (EXCLUDED_FILENAMES.has(fileName)) return false;

  // Skip hidden files except common config dotfiles
  if (
    fileName.startsWith('.') &&
    !ALLOWED_EXTENSIONS.has(getExtension(fileName))
  ) {
    return false;
  }

  // Skip by extension
  const ext = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext) && !isKnownConfigFile(fileName)) return false;

  // Skip oversized files
  if (sizeBytes !== undefined && sizeBytes > MAX_FILE_SIZE_BYTES) return false;

  return true;
}

/**
 * Returns the lowercased file extension including the dot.
 * Returns empty string for files with no extension.
 *
 * @param {string} fileName
 * @returns {string}
 */
function getExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

/**
 * Identifies well-known configuration files that have no extension but
 * should still be parsed (e.g. Makefile, Dockerfile, Procfile).
 *
 * @param {string} fileName
 * @returns {boolean}
 */
function isKnownConfigFile(fileName) {
  const knownConfigFiles = new Set([
    'Makefile',
    'Dockerfile',
    'dockerfile',
    'Procfile',
    'Rakefile',
    'Gemfile',
    'Brewfile',
    'Vagrantfile',
    'Jenkinsfile',
  ]);
  return knownConfigFiles.has(fileName);
}

/**
 * Filters a raw GitHub tree to the list of files that should be analysed.
 *
 * @param {Array<{path: string, type: string, size: number}>} tree
 * @returns {Array<{path: string, size: number}>}
 */
function filterTree(tree) {
  const files = tree
    .filter((item) => item.type === 'blob' && shouldIncludeFile(item.path, item.size))
    .map(({ path, size }) => ({ path, size: size || 0 }));

  if (files.length > MAX_FILES_PER_REPO) {
    // Prioritise smaller files to maximise coverage within the limit
    files.sort((a, b) => a.size - b.size);
    return files.slice(0, MAX_FILES_PER_REPO);
  }

  return files;
}

/**
 * Checks whether the text content appears to be binary (e.g. a minified blob
 * that passed the extension filter but is not human-readable source).
 *
 * @param {string} content
 * @returns {boolean}
 */
function isLikelyBinaryContent(content) {
  const buf = Buffer.from(content, 'utf8');
  return isBinaryBuffer(buf);
}

module.exports = {
  filterTree,
  shouldIncludeFile,
  isLikelyBinaryContent,
  getExtension,
  ALLOWED_EXTENSIONS,
  EXCLUDED_DIRS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REPO,
};
