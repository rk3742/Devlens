'use strict';

const {
  shouldIncludeFile,
  filterTree,
  isLikelyBinaryContent,
  getExtension,
} = require('../services/fileParserService');

describe('fileParserService', () => {
  describe('getExtension()', () => {
    it('returns lowercase extension with dot', () => {
      expect(getExtension('index.JS')).toBe('.js');
      expect(getExtension('App.TSX')).toBe('.tsx');
    });

    it('returns empty string for no extension', () => {
      expect(getExtension('Makefile')).toBe('');
      expect(getExtension('Dockerfile')).toBe('');
    });

    it('handles dotfiles correctly', () => {
      // .eslintrc has no extension – dot is at index 0
      expect(getExtension('.eslintrc')).toBe('');
    });
  });

  describe('shouldIncludeFile()', () => {
    it('includes common source files', () => {
      expect(shouldIncludeFile('src/index.js')).toBe(true);
      expect(shouldIncludeFile('src/App.tsx')).toBe(true);
      expect(shouldIncludeFile('server/app.py')).toBe(true);
    });

    it('excludes files inside node_modules', () => {
      expect(shouldIncludeFile('node_modules/lodash/index.js')).toBe(false);
    });

    it('excludes files inside .git', () => {
      expect(shouldIncludeFile('.git/config')).toBe(false);
    });

    it('excludes files inside dist and build', () => {
      expect(shouldIncludeFile('dist/bundle.js')).toBe(false);
      expect(shouldIncludeFile('build/index.html')).toBe(false);
    });

    it('excludes lock files', () => {
      expect(shouldIncludeFile('package-lock.json')).toBe(false);
      expect(shouldIncludeFile('yarn.lock')).toBe(false);
      expect(shouldIncludeFile('pnpm-lock.yaml')).toBe(false);
    });

    it('excludes binary extensions (implicit: not in ALLOWED_EXTENSIONS)', () => {
      expect(shouldIncludeFile('image.png')).toBe(false);
      expect(shouldIncludeFile('font.woff2')).toBe(false);
      expect(shouldIncludeFile('archive.zip')).toBe(false);
    });

    it('excludes oversized files', () => {
      const bigSize = 2 * 1024 * 1024; // 2 MB
      expect(shouldIncludeFile('src/index.js', bigSize)).toBe(false);
    });

    it('includes known config files without extensions', () => {
      expect(shouldIncludeFile('Makefile')).toBe(true);
      expect(shouldIncludeFile('Dockerfile')).toBe(true);
    });

    it('includes SQL files', () => {
      expect(shouldIncludeFile('database/schema.sql')).toBe(true);
    });

    it('includes markdown files', () => {
      expect(shouldIncludeFile('README.md')).toBe(true);
    });

    it('excludes hidden directories other than .github', () => {
      expect(shouldIncludeFile('.cache/something.js')).toBe(false);
      expect(shouldIncludeFile('.vscode/settings.json')).toBe(false);
    });
  });

  describe('filterTree()', () => {
    const mockTree = [
      { type: 'blob', path: 'src/index.js', size: 1024 },
      { type: 'blob', path: 'node_modules/express/index.js', size: 512 },
      { type: 'blob', path: 'README.md', size: 2048 },
      { type: 'blob', path: 'image.png', size: 50000 },
      { type: 'tree', path: 'src', size: 0 },             // directories are excluded
      { type: 'blob', path: 'package-lock.json', size: 100000 },
    ];

    it('keeps only allowed text blobs', () => {
      const result = filterTree(mockTree);
      const paths = result.map((f) => f.path);
      expect(paths).toContain('src/index.js');
      expect(paths).toContain('README.md');
      expect(paths).not.toContain('node_modules/express/index.js');
      expect(paths).not.toContain('image.png');
      expect(paths).not.toContain('src'); // tree type
      expect(paths).not.toContain('package-lock.json');
    });
  });

  describe('isLikelyBinaryContent()', () => {
    it('returns false for plain text', () => {
      const text = 'const x = 1;\n'.repeat(100);
      expect(isLikelyBinaryContent(text)).toBe(false);
    });

    it('returns true for content with a null byte', () => {
      const binary = 'some text\x00more text';
      expect(isLikelyBinaryContent(binary)).toBe(true);
    });
  });
});
