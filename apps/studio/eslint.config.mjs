import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { importDisciplineRules } from './eslint.import-discipline.mjs';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // React hooks rules — applied to all TSX files
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Import discipline: no relative paths, no file extensions
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: importDisciplineRules,
  },

  // ─── Architectural boundary: ui → core / engine ────────────────────────────
  // UI components under src/ui/** may value-import:
  //   - @core/*/domain/**  (errors, value objects, constants — semantically type-like)
  //   - @presentation/**   (renderer-agnostic interaction logic; safe to instantiate)
  // and may NOT value-import:
  //   - anything else under @core/** (store, actions, services, automations,
  //     infrastructure, _shared) — these carry state/lifecycle and must enter
  //     ui only through XModule contexts wired in bootstrap.
  //   - anything from @tscaps/engine — the engine is a black box to ui. Classes
  //     are injected via EngineModule; pure utilities live in presentation/.
  // Type-only imports are unrestricted.
  //
  // Applies uniformly to every file under src/ui/**, including module hosts
  // (*Host.tsx — the top-of-module wiring point). The host name is a
  // convention; the lint rule has no per-file exemptions.
  {
    files: ['src/ui/**/*.tsx', 'src/ui/**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@core/*/store/**',
              '@core/*/actions/**',
              '@core/*/services/**',
              '@core/*/automations/**',
              '@core/*/infrastructure/**',
              '@core/_shared/**',
            ],
            allowTypeImports: true,
            message: 'UI cannot value-import this layer of @core. Only @core/<feature>/domain/** is permitted; everything else must enter ui through an XModule context.',
          },
          {
            group: ['@tscaps/engine', '@tscaps/engine/**'],
            allowTypeImports: true,
            message: 'UI cannot value-import from @tscaps/engine. Classes are injected via EngineModule (useEngine()); constants live on EngineModule.constants.',
          },
        ],
      }],
    },
  },

  // ─── Architectural boundary: core / presentation are renderer-agnostic ────
  // Files under src/core/** and src/presentation/** must not import React in
  // any form (value or type) — neither `react`, nor `react-dom`, nor any
  // `react-*` package. The web's React layer is replaceable; reaching into
  // React types from core/presentation re-couples it to React. Use plain
  // TypeScript types (Record, structural interfaces) for shared shapes;
  // ui handles the cast to React's CSSProperties / EventHandler / etc.
  //
  // Core has the extra rule that it cannot depend on the top-level
  // presentation/ either — the contract is reversed: presentation may know
  // about core (subscribing to stores, calling actions); core stays
  // renderer-agnostic.
  {
    files: ['src/core/**/*.ts', 'src/core/**/*.tsx', 'src/presentation/**/*.ts', 'src/presentation/**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['react', 'react-dom', 'react-*', 'react-dom/**'],
            message: 'core/ and presentation/ are renderer-agnostic. React belongs in ui/. Use plain TypeScript types for shared shapes; ui handles the React-side typing.',
          },
        ],
      }],
    },
  },

  // ─── Architectural boundary: core → presentation ───────────────────────────
  // Files under src/core/** must not depend on the top-level presentation/.
  // Older per-feature `core/<x>/presentation/` folders are not covered yet —
  // they are slated for migration to the top-level presentation/ in upcoming
  // slices.
  {
    files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@presentation/**'],
            message: 'Core must not depend on presentation/. The renderer can know about core; core does not know about the renderer.',
          },
        ],
      }],
    },
  },

  // ─── Architectural boundary: wiring → presentation ─────────────────────────
  // Files under src/bootstrap/wiring/** instantiate only core. Presentation
  // collaborators are instantiated by module hosts (mount-scoped) or by
  // EditorApp (app-lifetime). Type-only imports are allowed when wiring
  // needs to reference a presentation type for its own typing surface.
  {
    files: ['src/bootstrap/wiring/**/*.ts', 'src/bootstrap/wiring/**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@presentation/**'],
            allowTypeImports: true,
            message: 'Wiring instantiates only @core. Move presentation construction to a module host, or to EditorApp if app-lifetime.',
          },
        ],
      }],
    },
  },


  { ignores: ['dist/**', 'tests/**', 'playwright.config.ts'] },
];
