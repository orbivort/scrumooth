/**
 * ESLint Plugin for i18n Security
 *
 * Prevents XSS vulnerabilities when translated content (i18n `t()` output)
 * is used with `dangerouslySetInnerHTML`. Translated content can contain
 * user-controlled or injected markup if translation files are compromised,
 * so it must be sanitized with DOMPurify before being rendered as raw HTML.
 *
 * @module eslint-plugin-i18n-security
 */

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-i18n-security',
    version: '1.0.0',
  },
  rules: {
    'no-dangerous-i18n': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow i18n translated content (t() output) in dangerouslySetInnerHTML without sanitization',
          category: 'Security',
          recommended: true,
          url: 'https://github.com/orbivort/scrumooth/blob/main/docs/architecture/i18n-architecture.md',
        },
        fixable: null,
        schema: [],
        messages: {
          noDangerousI18n:
            'Using i18n t() output in dangerouslySetInnerHTML is a potential XSS vector. Sanitize with DOMPurify.sanitize() or use <Trans> component instead. See docs/architecture/i18n-architecture.md',
          noDangerousInnerHTML:
            'Using dangerouslySetInnerHTML is discouraged. If content comes from i18n t(), sanitize with DOMPurify.sanitize() first. See docs/architecture/i18n-architecture.md',
        },
      },

      create(context) {
        /**
         * Track variables assigned from t() calls so we can detect
         * indirect usage like: const html = t('key'); <div dangerouslySetInnerHTML={{ __html: html }} />
         * @type {Map<string, boolean>}
         */
        const translationVariables = new Map();

        /**
         * Check if a node is a call to t() (the i18next translation function)
         * @param {import('estree').Node} node
         * @returns {boolean}
         */
        function isTCall(node) {
          if (node.type === 'CallExpression') {
            const callee = node.callee;
            // Direct t() call
            if (callee.type === 'Identifier' && callee.name === 't') {
              return true;
            }
            // this.t() or obj.t() call
            if (
              callee.type === 'MemberExpression' &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 't'
            ) {
              return true;
            }
          }
          return false;
        }

        /**
         * Check if a node references a variable that was assigned from t()
         * @param {import('estree').Node} node
         * @returns {boolean}
         */
        function isTranslationVariable(node) {
          if (node.type === 'Identifier') {
            return translationVariables.get(node.name) === true;
          }
          return false;
        }

        /**
         * Check if a node involves t() output (direct call or variable reference)
         * Also checks template literals, string concatenation, and DOMPurify.sanitize()
         * @param {import('estree').Node} node
         * @returns {{ isTranslation: boolean, isSanitized: boolean }}
         */
        function analyzeExpression(node) {
          if (!node) {
            return { isTranslation: false, isSanitized: false };
          }

          // DOMPurify.sanitize() call — content is sanitized
          if (node.type === 'CallExpression') {
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 'sanitize'
            ) {
              const object = callee.object;
              if (object.type === 'Identifier' && object.name === 'DOMPurify') {
                return { isTranslation: true, isSanitized: true };
              }
            }
            // Check if the argument to DOMPurify.sanitize is t()
            // We still consider it sanitized in this case
          }

          // Direct t() call
          if (isTCall(node)) {
            return { isTranslation: true, isSanitized: false };
          }

          // Variable reference from t()
          if (isTranslationVariable(node)) {
            return { isTranslation: true, isSanitized: false };
          }

          // Template literal — check expressions
          if (node.type === 'TemplateLiteral') {
            for (const expr of node.expressions) {
              const result = analyzeExpression(expr);
              if (result.isTranslation && !result.isSanitized) {
                return { isTranslation: true, isSanitized: false };
              }
            }
          }

          // Binary expression (string concatenation)
          if (node.type === 'BinaryExpression' && node.operator === '+') {
            const left = analyzeExpression(node.left);
            const right = analyzeExpression(node.right);
            if (left.isTranslation && !left.isSanitized) {
              return { isTranslation: true, isSanitized: false };
            }
            if (right.isTranslation && !right.isSanitized) {
              return { isTranslation: true, isSanitized: false };
            }
          }

          // Conditional expression (ternary)
          if (node.type === 'ConditionalExpression') {
            const consequent = analyzeExpression(node.consequent);
            const alternate = analyzeExpression(node.alternate);
            if (consequent.isTranslation && !consequent.isSanitized) {
              return { isTranslation: true, isSanitized: false };
            }
            if (alternate.isTranslation && !alternate.isSanitized) {
              return { isTranslation: true, isSanitized: false };
            }
          }

          // Call expression — check if it's DOMPurify.sanitize (already handled above)
          // or if it wraps t() output (e.g., someFunction(t('key')))
          if (node.type === 'CallExpression' && node.arguments) {
            for (const arg of node.arguments) {
              if (arg.type === 'SpreadElement') {
                continue;
              }
              const argResult = analyzeExpression(arg);
              if (argResult.isTranslation) {
                // If the wrapping function is DOMPurify.sanitize, it's sanitized
                const callee = node.callee;
                if (
                  callee.type === 'MemberExpression' &&
                  callee.property.type === 'Identifier' &&
                  callee.property.name === 'sanitize' &&
                  callee.object.type === 'Identifier' &&
                  callee.object.name === 'DOMPurify'
                ) {
                  return { isTranslation: true, isSanitized: true };
                }
                // Otherwise, t() output flows into an unsanitized function
                return { isTranslation: true, isSanitized: false };
              }
            }
          }

          return { isTranslation: false, isSanitized: false };
        }

        /**
         * Find the __html property value in a JSX attribute for dangerouslySetInnerHTML
         * @param {import('estree-jsx').JSXAttribute} attrNode
         * @returns {import('estree').Node | null}
         */
        function getHtmlValue(attrNode) {
          const value = attrNode.value;
          if (!value) {
            return null;
          }

          // dangerouslySetInnerHTML={{ __html: expr }}
          if (value.type === 'JSXExpressionContainer') {
            const expr = value.expression;
            if (expr.type === 'ObjectExpression') {
              for (const prop of expr.properties) {
                if (
                  prop.type === 'Property' &&
                  prop.key.type === 'Identifier' &&
                  prop.key.name === '__html'
                ) {
                  return prop.value;
                }
                // Also handle shorthand: { __html } (key and value are the same identifier)
                if (
                  prop.type === 'Property' &&
                  prop.shorthand &&
                  prop.key.type === 'Identifier' &&
                  prop.key.name === '__html'
                ) {
                  return prop.key;
                }
              }
            }
          }

          return null;
        }

        return {
          // Track variable declarations assigned from t()
          VariableDeclarator(node) {
            if (node.id.type === 'Identifier' && node.init) {
              if (isTCall(node.init)) {
                translationVariables.set(node.id.name, true);
              }
              // Also track: const html = `<b>${t('key')}</b>`
              const result = analyzeExpression(node.init);
              if (result.isTranslation && !result.isSanitized) {
                translationVariables.set(node.id.name, true);
              }
            }
          },

          // Check JSX elements for dangerouslySetInnerHTML
          JSXOpeningElement(node) {
            for (const attr of node.attributes) {
              if (attr.type !== 'JSXAttribute') {
                continue;
              }
              if (
                attr.name.type !== 'JSXIdentifier' ||
                attr.name.name !== 'dangerouslySetInnerHTML'
              ) {
                continue;
              }

              const htmlValue = getHtmlValue(attr);

              if (!htmlValue) {
                // dangerouslySetInnerHTML present but couldn't analyze the value
                // Report as a general warning
                context.report({
                  node: attr,
                  messageId: 'noDangerousInnerHTML',
                });
                continue;
              }

              const analysis = analyzeExpression(htmlValue);

              if (analysis.isTranslation && !analysis.isSanitized) {
                // t() output flows into dangerouslySetInnerHTML without sanitization
                context.report({
                  node: attr,
                  messageId: 'noDangerousI18n',
                });
              } else if (analysis.isTranslation && analysis.isSanitized) {
                // t() output is sanitized with DOMPurify — this is acceptable
                // No report needed
              } else {
                // dangerouslySetInnerHTML with non-translation content
                // Report as a general warning (lower severity would be nice,
                // but ESLint rule severity is configured externally)
                context.report({
                  node: attr,
                  messageId: 'noDangerousInnerHTML',
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
      plugins: ['i18n-security'],
      rules: {
        'i18n-security/no-dangerous-i18n': 'error',
      },
    },
    strict: {
      plugins: ['i18n-security'],
      rules: {
        'i18n-security/no-dangerous-i18n': 'error',
      },
    },
  },
};

export default plugin;
