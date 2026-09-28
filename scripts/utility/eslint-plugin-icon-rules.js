/**
 * ESLint Plugin for Icon Rules
 *
 * This plugin enforces the use of shared icon components instead of inline SVGs.
 *
 * @module eslint-plugin-icon-rules
 */

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-icon-rules',
    version: '1.0.0',
  },
  rules: {
    'no-inline-svg': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow inline SVG elements in favor of shared icon components',
          category: 'Best Practices',
          recommended: true,
          url: 'https://github.com/orbivort/scrumooth/tree/main/packages/frontend/src/components/common/Icons',
        },
        fixable: null,
        schema: [
          {
            type: 'object',
            properties: {
              allowedPaths: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'File paths where inline SVGs are allowed (e.g., icon component files)',
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          noInlineSvg:
            'Inline SVGs are not allowed. Use a shared icon component from @/components/common/Icons instead.',
        },
      },

      create(context) {
        const options = context.options[0] || {};
        const allowedPaths = options.allowedPaths || [
          'components/common/Icons/',
          'components/common/Icons/index.ts',
        ];

        const filename = context.filename || context.getFilename();
        // Normalize path to use forward slashes for consistent matching
        const normalizedFilename = filename.replace(/\\/g, '/');

        // Check if the current file is in an allowed path
        const isAllowedFile = allowedPaths.some((allowedPath) =>
          normalizedFilename.includes(allowedPath)
        );

        // Skip checking in allowed files (like the Icons folder itself)
        if (isAllowedFile) {
          return {};
        }

        /**
         * Check if an element is an SVG
         * @param {import('estree-jsx').JSXOpeningElement | import('estree-jsx').JSXIdentifier} node
         * @returns {boolean}
         */
        function isSvgElement(node) {
          if (node.type === 'JSXIdentifier') {
            return node.name === 'svg';
          }
          if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier') {
            return node.name.name === 'svg';
          }
          return false;
        }

        return {
          JSXOpeningElement(node) {
            if (isSvgElement(node)) {
              context.report({
                node,
                messageId: 'noInlineSvg',
              });
            }
          },
        };
      },
    },

    'prefer-icon-import': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prefer importing icons from the shared icon library',
          category: 'Best Practices',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
          preferIconImport:
            'Import icons from @/components/common/Icons instead of defining them locally',
        },
      },

      create(context) {
        return {
          // Detect icon component patterns defined locally
          VariableDeclarator(node) {
            if (
              node.id.type === 'Identifier' &&
              node.id.name.endsWith('Icon') &&
              node.init &&
              (node.init.type === 'ArrowFunctionExpression' ||
                node.init.type === 'FunctionExpression')
            ) {
              // Check if this looks like an icon component
              const functionBody =
                node.init.body.type === 'BlockStatement' ? node.init.body.body : [node.init.body];

              // Look for JSX return with svg
              const hasSvgReturn = functionBody.some((statement) => {
                if (statement.type === 'ReturnStatement' && statement.argument) {
                  const returnedValue = statement.argument;
                  // Check for JSXElement with svg tag
                  if (
                    returnedValue.type === 'JSXElement' &&
                    returnedValue.openingElement.name.type === 'JSXIdentifier' &&
                    returnedValue.openingElement.name.name === 'svg'
                  ) {
                    return true;
                  }
                }
                return false;
              });

              if (hasSvgReturn) {
                context.report({
                  node,
                  messageId: 'preferIconImport',
                });
              }
            }
          },
        };
      },
    },
  },

  configs: {
    recommended: {
      plugins: ['icon-rules'],
      rules: {
        'icon-rules/no-inline-svg': 'error',
        'icon-rules/prefer-icon-import': 'warn',
      },
    },
    strict: {
      plugins: ['icon-rules'],
      rules: {
        'icon-rules/no-inline-svg': 'error',
        'icon-rules/prefer-icon-import': 'error',
      },
    },
  },
};

export default plugin;
