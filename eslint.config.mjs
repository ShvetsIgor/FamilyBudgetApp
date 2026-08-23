import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  // `next lint` used to ignore build output implicitly; a flat config has to
  // say so, and `eslint .` would otherwise walk the service worker and the
  // local repo backups.
  globalIgnores([
    '.next/**',
    // A leftover agent worktree holds a full copy of the app (vitest excludes it too)
    '.claude/worktrees/**',
    'out/**',
    'build/**',
    'coverage/**',
    'public/sw.js',
    'next-env.d.ts',
    'FamilyBudgetApp-migration-safe-*/**',
  ]),
  {
    // TS/TSX only. For plain JS eslint-config-next installs its Babel-based
    // parser, whose bundled eslint-scope predates ESLint 10 and crashes with
    // «scopeManager.addGlobals is not a function». The app itself is entirely
    // TypeScript; the handful of JS files are build configs.
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...nextCoreWebVitals],
    settings: {
      // eslint-config-next leaves this at 'detect', and detection calls
      // `context.getFilename()` — removed in ESLint 10, so the react plugin
      // (7.37.5, still peer-capped at ESLint 9) throws while loading its
      // rules. Naming the version skips the detection path entirely.
      // Revert to 'detect' once eslint-plugin-react ships ESLint 10 support.
      react: { version: '19.2' },
    },
    rules: {
      // eslint-config-next 16 turns the React Compiler rule set on. Everything
      // it found on 2026-08-23 is either fixed or exempted at its own line with
      // a reason, so these stay ERRORS: a new violation should fail the build,
      // not join a pile of warnings. The remaining exemptions are all one of
      // three deliberate shapes — starting a Firestore fetch, syncing from the
      // URL/localStorage, and resetting a form when it reopens.
    },
  },
]);
