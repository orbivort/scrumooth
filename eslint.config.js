import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import iconRules from './scripts/utility/eslint-plugin-icon-rules.js';
import i18nSecurity from './scripts/utility/eslint-plugin-i18n-security.js';
import noLiteralJsxString from './scripts/utility/eslint-plugin-no-literal-jsx-string.js';

export default tseslint.config(
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/prisma/generated/**',
      'packages/backend/src/generated/prisma/**',
      'packages/frontend/e2e/**',
      'packages/frontend/playwright.config.ts',
      'packages/frontend/temp/**',
      'temp/**',
      '**/scripts/**',
      'k6/**',
    ],
  },
  // Base TypeScript rules for all TS files (without type checking)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': ['warn', { allowNamedFunctions: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-duplicate-imports': 'off', // Handled by import-x/no-duplicates
      'object-shorthand': ['warn', 'properties'],
      'prefer-template': 'warn',
      'no-unassigned-vars': 'off',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'error',
    },
  },
  // Type-aware rules for source files only (excludes tests and config files)
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', '**/setupTests.ts'],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['packages/backend/**/*.ts'],
    plugins: {
      unicorn,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        NodeJS: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'unicorn/prefer-node-protocol': 'error',
      // New rules from v64.0.0
      'unicorn/consistent-template-literal-escape': 'error',
      'unicorn/no-useless-iterator-to-array': 'error',
      'unicorn/switch-case-break-position': 'error',
    },
  },
  {
    files: ['packages/frontend/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/__tests__/**/*',
      '**/setupTests.ts',
      '**/vite.config.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      '**/e2e/**/*',
      // Icon components are allowed to have inline SVGs (they ARE the shared icons)
      '**/components/common/Icons/*.tsx',
    ],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'import-x': importX,
      'icon-rules': iconRules,
      'i18n-security': i18nSecurity,
      'no-literal-jsx-string': noLiteralJsxString,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'warn',
      'react/jsx-boolean-value': ['warn', 'never'],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'import-x/order': ['warn', { 'newlines-between': 'always' }],
      // Relax no-floating-promises for frontend store files (intentional fire-and-forget)
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      // Icon system rules - enforce shared icon usage
      'icon-rules/no-inline-svg': 'error',
      'icon-rules/prefer-icon-import': 'warn',
      // i18n security - prevent XSS via dangerouslySetInnerHTML with translated content
      'i18n-security/no-dangerous-i18n': 'error',
      // i18n - disallow hardcoded user-facing strings in JSX (use t() instead)
      'no-literal-jsx-string/no-literal-jsx-string': 'error',
      // Date formatting - enforce shared formatters
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
          message:
            'Use formatLocaleDate from @scrumooth/shared instead of toLocaleDateString(). This ensures consistent locale-aware date formatting.',
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"]',
          message:
            'Use formatLocaleDate from @scrumooth/shared instead of toLocaleString(). This ensures consistent locale-aware date/time formatting.',
        },
      ],
    },
  },
  // Barrel (facade) index files are excluded from coverage (see the coverage.exclude globs in
  // packages/frontend/vitest.config.ts). That exemption is only safe as long as these files stay
  // pure re-export facades, so this guard fails lint as soon as one of them gains runtime code —
  // which would mean silently losing coverage of real logic.
  // The globs must stay in sync with packages/frontend/vitest.config.ts and .github/codecov.yml.
  // Note: no-restricted-syntax is redefined here, so the frontend selectors above are repeated.
  {
    files: [
      'packages/frontend/src/components/**/index.ts',
      'packages/frontend/src/pages/**/index.ts',
      'packages/frontend/src/config/index.ts',
      'packages/frontend/src/hooks/index.ts',
      'packages/frontend/src/styles/index.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Program > VariableDeclaration, Program > ExpressionStatement, Program > IfStatement, Program > ForStatement, Program > ForOfStatement, Program > ForInStatement, Program > WhileStatement, Program > SwitchStatement, Program > TryStatement, Program > ThrowStatement',
          message:
            'Barrel index files are coverage-excluded and must only re-export. Move this runtime code into a named module (and keep the barrel a pure facade).',
        },
        {
          selector:
            'ExportNamedDeclaration[declaration.type=/^(VariableDeclaration|FunctionDeclaration|ClassDeclaration)$/]',
          message:
            'Barrel index files are coverage-excluded and must only re-export. Move this runtime export into a named module (and keep the barrel a pure facade).',
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
          message:
            'Use formatLocaleDate from @scrumooth/shared instead of toLocaleDateString(). This ensures consistent locale-aware date formatting.',
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"]',
          message:
            'Use formatLocaleDate from @scrumooth/shared instead of toLocaleString(). This ensures consistent locale-aware date/time formatting.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      'no-console': 'off',
    },
  },
  eslintConfigPrettier
);
