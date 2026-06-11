// Shared ESLint rules enforcing:
//   - no relative imports (use the package's path aliases instead)
//   - no file extensions on import/export specifiers (.js/.jsx/.ts/.tsx)

const relativeSelector = "[source.value=/^\\.\\.?\\//]";
const extensionSelector = "[source.value=/\\.(jsx?|tsx?)$/]";

const noRelative = (kind) => ({
  selector: `${kind}${relativeSelector}`,
  message:
    'Use a path alias (e.g. @modules/...) instead of a relative import path.',
});

const noExtension = (kind) => ({
  selector: `${kind}${extensionSelector}`,
  message:
    'Do not include the file extension in import/export specifiers (drop .ts/.tsx/.js/.jsx).',
});

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
