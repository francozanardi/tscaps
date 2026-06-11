// Shared ESLint rules enforcing:
//   - no relative imports (use the package's path aliases instead)
//   - no file extensions on import/export specifiers (.js/.jsx/.ts/.tsx)
//
// Imported by each package's eslint.config.mjs.

const relativeSelector = "[source.value=/^\\.\\.?\\//]";
const extensionSelector = "[source.value=/\\.(jsx?|tsx?)$/]";

const noRelative = (kind) => ({
  selector: `${kind}${relativeSelector}`,
  message:
    'Use a path alias (e.g. @core/..., @ui/..., @modules/...) instead of a relative import path.',
});

const noExtension = (kind) => ({
  selector: `${kind}${extensionSelector}`,
  message:
    'Do not include the file extension in import/export specifiers (drop .ts/.tsx/.js/.jsx).',
});

// Dynamic import('...') — CallExpression where callee is `import` keyword.
const dynamicImportRelative = {
  selector:
    "CallExpression[callee.type='Import'][arguments.0.type='Literal'][arguments.0.value=/^\\.\\.?\\//]",
  message:
    'Use a path alias instead of a relative path in dynamic import().',
};

const dynamicImportExtension = {
  selector:
    "CallExpression[callee.type='Import'][arguments.0.type='Literal'][arguments.0.value=/\\.(jsx?|tsx?)$/]",
  message:
    'Do not include the file extension in dynamic import().',
};

export const importDisciplineRules = {
  // Underscore-prefixed args/vars/caught-errors are intentionally unused.
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    },
  ],
  'no-restricted-syntax': [
    'error',
    noRelative('ImportDeclaration'),
    noRelative('ExportAllDeclaration'),
    noRelative('ExportNamedDeclaration'),
    noExtension('ImportDeclaration'),
    noExtension('ExportAllDeclaration'),
    noExtension('ExportNamedDeclaration'),
    dynamicImportRelative,
    dynamicImportExtension,
  ],
};
