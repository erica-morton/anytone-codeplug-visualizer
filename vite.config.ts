import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
// vitest/config re-exports vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
) as { version: string };
let gitHash = 'unknown';
let localChanges = false;
try {
  gitHash = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  localChanges = Boolean(
    execFileSync('git', ['status', '--porcelain'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  );
} catch {
  // Source archives can still build without Git metadata.
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_HASH__: JSON.stringify(gitHash),
    __LOCAL_CHANGES__: JSON.stringify(localChanges),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['components/**/*.test.tsx'],
    restoreMocks: true,
  },
});
