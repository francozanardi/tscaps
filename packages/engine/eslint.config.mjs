import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { importDisciplineRules } from './eslint.import-discipline.mjs';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    rules: importDisciplineRules,
  },

  { ignores: ['dist/**'] },
];
