/**
 * ESLint Plugin: No Literal JSX String
 *
 * Detects hardcoded user-facing strings in JSX that should use i18n translation
 * keys instead. This enforces the project rule that all user-facing text must
 * go through i18next `t()` function calls.
 *
 * The rule checks:
 * - JSX text content (e.g., `<div>Hello World</div>`)
 * - JSX string attribute values (e.g., `<div title="Hello">`)
 *
 * It ignores:
 * - Technical/non-user-facing props (className, id, type, name, role, data-*, aria-*, etc.)
 * - Strings without enough alphabetic characters (likely not user-facing)
 * - Known technical string values
 * - Empty strings and whitespace-only strings
 * - Translation function calls (t(), i18n.t())
 *
 * @module eslint-plugin-no-literal-jsx-string
 */

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-no-literal-jsx-string',
    version: '1.0.0',
  },
  rules: {
    'no-literal-jsx-string': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow hardcoded user-facing strings in JSX — use i18n translation keys instead',
          category: 'Best Practices',
          recommended: true,
          url: 'https://github.com/orbivort/scrumooth/blob/main/docs/architecture/i18n-architecture-review.md',
        },
        fixable: null,
        schema: [
          {
            type: 'object',
            properties: {
              ignoredProps: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional JSX prop names to ignore (beyond the built-in allowlist)',
              },
              allowedStrings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific string values to allow (exact match, case-sensitive)',
              },
              minAlphabeticChars: {
                type: 'integer',
                minimum: 1,
                description:
                  'Minimum number of consecutive alphabetic characters required to flag a string (default: 3)',
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          noLiteralJsxString:
            'Hardcoded string "{{text}}" in JSX should use an i18n translation key. Use t("key") from useI18nStore() instead.',
          noLiteralJsxAttribute:
            'Hardcoded string "{{text}}" in {{prop}} attribute should use an i18n translation key. Use t("key") from useI18nStore() instead.',
        },
      },

      create(context) {
        const options = context.options[0] || {};
        const minAlphabeticChars = options.minAlphabeticChars || 3;

        /**
         * Built-in set of JSX prop names whose string values are NOT user-facing.
         * These are technical/structural props that should never be translated.
         * @type {Set<string>}
         */
        const builtinIgnoredProps = new Set([
          // CSS and styling
          'className',
          'style',
          'class',
          // HTML identity and structure
          'id',
          'key',
          'for',
          'htmlFor',
          // Input-related technical props
          'type',
          'name',
          'autoComplete',
          'autoFocus',
          'autocomplete',
          'autofocus',
          // NOTE: placeholder, title, and alt are NOT here — they are user-facing
          // Form technical props
          'method',
          'action',
          'enctype',
          'encoding',
          'accept',
          'form',
          'formAction',
          'formEncType',
          'formMethod',
          'formNoValidate',
          'formTarget',
          // Link and navigation technical props
          'target',
          'rel',
          'href',
          'download',
          // ARIA technical props (non-user-facing)
          'aria-hidden',
          'aria-expanded',
          'aria-checked',
          'aria-disabled',
          'aria-selected',
          'aria-pressed',
          'aria-invalid',
          'aria-readonly',
          'aria-required',
          'aria-haspopup',
          'aria-modal',
          'aria-live',
          'aria-atomic',
          'aria-relevant',
          'aria-busy',
          'aria-controls',
          'aria-flowto',
          'aria-owns',
          'aria-posinset',
          'aria-setsize',
          'aria-level',
          'aria-valuemin',
          'aria-valuemax',
          'aria-valuenow',
          'aria-roledescription',
          'aria-multiselectable',
          'aria-orientation',
          'aria-sort',
          'aria-activedescendant',
          'aria-colcount',
          'aria-colindex',
          'aria-colspan',
          'aria-rowcount',
          'aria-rowindex',
          'aria-rowspan',
          // Table structure
          'scope',
          'colSpan',
          'rowSpan',
          'headers',
          'span',
          // Test and data attributes
          'data-testid',
          'testId',
          // React internal
          'ref',
          'dangerouslySetInnerHTML',
          'suppressContentEditableWarning',
          'suppressHydrationWarning',
          // Value prop for form elements (technical, not user-facing)
          'value',
          'defaultValue',
          'checked',
          'defaultChecked',
          // Event handlers
          'onChange',
          'onClick',
          'onSubmit',
          'onFocus',
          'onBlur',
          'onKeyDown',
          'onKeyUp',
          'onKeyPress',
          'onMouseEnter',
          'onMouseLeave',
          'onInput',
          // Misc technical props
          'tabIndex',
          'role',
          'dir',
          'lang',
          'draggable',
          'contentEditable',
          'spellCheck',
          'loading',
          'decoding',
          'src',
          'srcSet',
          // NOTE: alt is NOT here — it is user-facing (screen reader text)
          'width',
          'height',
          'sizes',
          'crossOrigin',
          'integrity',
          'preload',
          'as',
          'media',
          // NOTE: title is NOT here — it is user-facing (tooltip text)
          // Chart.js / SVG / Canvas technical props
          'd',
          'viewBox',
          'xmlns',
          'fill',
          'stroke',
          'strokeWidth',
          'strokeLinecap',
          'strokeLinejoin',
          'strokeDasharray',
          'strokeDashoffset',
          'strokeMiterlimit',
          'strokeOpacity',
          'fillOpacity',
          'fillRule',
          'clipRule',
          'x',
          'y',
          'x1',
          'y1',
          'x2',
          'y2',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'points',
          'transform',
          'offset',
          'stopColor',
          'stopOpacity',
          'pathLength',
          // UI component technical props (non-user-facing variant/size identifiers)
          'variant',
          'size',
          'color',
          'tone',
          'cardVariant',
          'defaultRole',
          'prefetch',
          'autoCapitalize',
          // Technical identifier props
          'entityType',
          'errorId',
          'definitionType',
          'targetId',
          'bodyId',
          'pageName',
          'fallbackMessage',
          'i18nKey',
          'animationType',
          'clipPath',
          'mask',
          'filter',
          'preserveAspectRatio',
          // Animation props
          'from',
          'to',
          'repeatCount',
          'dur',
          'begin',
          'attributeName',
          'values',
        ]);

        /**
         * User-facing ARIA props that should be translated.
         * These contain text that assistive technology reads to users.
         * @type {Set<string>}
         */
        const userFacingAriaProps = new Set([
          // These contain DIRECT text strings that screen readers read aloud
          'aria-label',
          'aria-description',
          'aria-valuetext',
          'aria-placeholder',
          // NOTE: aria-labelledby, aria-describedby, aria-errormessage are ID references (not text)
          // NOTE: aria-keyshortcuts is a keyboard shortcut string (not user-facing text)
        ]);

        /**
         * Known technical string values that should never be flagged.
         * These are common non-user-facing string values used in HTML/JSX.
         * @type {Set<string>}
         */
        const knownTechnicalStrings = new Set([
          // Link rel values
          'noopener',
          'noreferrer',
          'nofollow',
          'noopener noreferrer',
          'noreferrer noopener',
          'author',
          'bookmark',
          'external',
          'help',
          'license',
          'next',
          'prev',
          'search',
          'tag',
          'alternate',
          'prefetch',
          'preload',
          'preconnect',
          'dns-prefetch',
          // Target values
          '_blank',
          '_self',
          '_parent',
          '_top',
          // Form method/action
          'post',
          'get',
          'put',
          'delete',
          'patch',
          // Input types
          'text',
          'password',
          'email',
          'number',
          'tel',
          'url',
          'search',
          'date',
          'datetime-local',
          'time',
          'month',
          'week',
          'color',
          'range',
          'file',
          'image',
          'hidden',
          'checkbox',
          'radio',
          'submit',
          'reset',
          'button',
          // Autocomplete values
          'off',
          'on',
          'name',
          'given-name',
          'family-name',
          'email',
          'username',
          'new-password',
          'current-password',
          'one-time-code',
          'organization',
          'street-address',
          'address-line1',
          'address-line2',
          'address-line3',
          'address-level1',
          'address-level2',
          'address-level3',
          'country',
          'country-name',
          'postal-code',
          'cc-name',
          'cc-number',
          'cc-exp',
          'cc-exp-month',
          'cc-exp-year',
          'cc-csc',
          'cc-type',
          'transaction-amount',
          'transaction-currency',
          'language',
          'bday',
          'bday-day',
          'bday-month',
          'bday-year',
          'sex',
          'tel',
          'tel-country-code',
          'tel-national',
          'tel-area-code',
          'tel-local',
          'tel-extension',
          'impp',
          // Role values
          'alert',
          'alertdialog',
          'application',
          'article',
          'banner',
          'button',
          'cell',
          'checkbox',
          'columnheader',
          'combobox',
          'complementary',
          'contentinfo',
          'definition',
          'dialog',
          'directory',
          'document',
          'feed',
          'figure',
          'form',
          'grid',
          'gridcell',
          'group',
          'heading',
          'img',
          'link',
          'list',
          'listbox',
          'listitem',
          'log',
          'main',
          'marquee',
          'math',
          'menu',
          'menubar',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'navigation',
          'none',
          'note',
          'option',
          'presentation',
          'progressbar',
          'radio',
          'radiogroup',
          'region',
          'row',
          'rowgroup',
          'rowheader',
          'scrollbar',
          'search',
          'searchbox',
          'separator',
          'slider',
          'spinbutton',
          'status',
          'switch',
          'tab',
          'table',
          'tablist',
          'tabpanel',
          'term',
          'textbox',
          'timer',
          'toolbar',
          'tooltip',
          'tree',
          'treegrid',
          'treeitem',
          // Boolean-like values
          'true',
          'false',
          // Common aria attribute values
          'polite',
          'assertive',
          'off',
          'horizontal',
          'vertical',
          'ascending',
          'descending',
          'none',
          'other',
          'inline',
          'list',
          'both',
          'additions',
          'removals',
          'all',
          // Misc technical values
          'anonymous',
          'use-credentials',
          'lazy',
          'eager',
          'auto',
          'no-referrer',
          'origin',
          'origin-when-cross-origin',
          'same-origin',
          'strict-origin',
          'strict-origin-when-cross-origin',
          'unsafe-url',
          // Encoding types
          'multipart/form-data',
          'application/x-www-form-urlencoded',
          'text/plain',
          // SVG fill/stroke values
          'none',
          'currentColor',
          'transparent',
          'evenodd',
          'nonzero',
          // Common CSS-like values in JSX
          'fixed',
          'absolute',
          'relative',
          'sticky',
          'static',
          'initial',
          'inherit',
          'unset',
          'center',
          'start',
          'end',
          'left',
          'right',
          'top',
          'bottom',
          'middle',
          'nowrap',
          'wrap',
          'wrap-reverse',
          'row',
          'column',
          'row-reverse',
          'column-reverse',
          'flex',
          'grid',
          'block',
          'inline-block',
          'inline-flex',
          'inline-grid',
          'visible',
          'hidden',
          'collapse',
          'solid',
          'dashed',
          'dotted',
          'normal',
          'bold',
          'italic',
          'underline',
          'pointer',
          'default',
          'move',
          'text',
          'wait',
          'help',
          'progress',
          'not-allowed',
          'crosshair',
          'copy',
          'grab',
          'grabbing',
          // Numeric-like string values
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '100',
          // SVG stroke/fill values
          'round',
          'butt',
          'square',
          'miter',
          'bevel',
          // Chart.js technical values
          'x',
          'y',
          'xy',
          'category',
          'linear',
          'logarithmic',
          'radialLinear',
          'time',
          'timeseries',
          'pie',
          'doughnut',
          'bar',
          'line',
          'scatter',
          'bubble',
          'radar',
          'polarArea',
          'top',
          'bottom',
          'left',
          'right',
          'ticks',
          'grid',
          'title',
          'legend',
          'tooltip',
          'animation',
          'point',
          'segment',
          'fill',
          'borderColor',
          'backgroundColor',
          'borderWidth',
          'pointRadius',
          'pointHoverRadius',
          'tension',
          'stepped',
          'spanGaps',
        ]);

        // Merge with user-provided options
        const ignoredProps = new Set(builtinIgnoredProps);
        if (options.ignoredProps) {
          for (const prop of options.ignoredProps) {
            ignoredProps.add(prop);
          }
        }

        const allowedStrings = new Set(knownTechnicalStrings);
        if (options.allowedStrings) {
          for (const str of options.allowedStrings) {
            allowedStrings.add(str);
          }
        }

        /**
         * Check if a prop name should be ignored (not treated as user-facing)
         * @param {string} propName
         * @returns {boolean}
         */
        function isIgnoredProp(propName) {
          // Direct match
          if (ignoredProps.has(propName)) {
            return true;
          }
          // data-* attributes are always technical
          if (propName.startsWith('data-')) {
            return true;
          }
          // aria-* attributes that are NOT user-facing (boolean, numeric, ID-ref types)
          if (propName.startsWith('aria-') && !userFacingAriaProps.has(propName)) {
            return true;
          }
          // on* event handlers
          if (
            propName.startsWith('on') &&
            propName.length > 2 &&
            propName[2] === propName[2].toUpperCase()
          ) {
            return true;
          }
          return false;
        }

        /**
         * Check if a string value looks like user-facing text that should be translated.
         * A string is considered user-facing if it contains enough consecutive
         * alphabetic characters (default: 3+).
         * @param {string} value
         * @returns {boolean}
         */
        function isUserFacingString(value) {
          // Empty or whitespace-only strings are never user-facing
          if (!value || value.trim() === '') {
            return false;
          }

          // Check the trimmed value
          const trimmed = value.trim();

          // Known technical strings are never user-facing
          if (allowedStrings.has(trimmed)) {
            return false;
          }

          // Check for consecutive alphabetic characters
          // A string like "Hello World" has "Hello" (5) and "World" (5) — both >= 3
          // A string like "." or "-" or ": " has no consecutive alphabetic chars
          // A string like "px" has only 2 consecutive alphabetic chars
          const alphabeticPattern = new RegExp(`[a-zA-Z]{${minAlphabeticChars},}`);
          if (!alphabeticPattern.test(trimmed)) {
            return false;
          }

          // URLs and paths are not user-facing
          if (
            /^https?:\/\//.test(trimmed) ||
            /^\/[\w]/.test(trimmed) ||
            /^\.\//.test(trimmed) ||
            /^\.\.\//.test(trimmed)
          ) {
            return false;
          }

          // CSS-like values (e.g., "16px", "1.5rem", "100%", "#fff")
          if (
            /^[\d.]+(%|px|rem|em|vh|vw|fr|cm|mm|in|pt|pc|ch|ex|deg|rad|turn|s|ms)?$/.test(trimmed)
          ) {
            return false;
          }
          if (/^#([0-9a-fA-F]{3,8})$/.test(trimmed)) {
            return false;
          }

          // Regex patterns (e.g., /^\d+$/)
          if (/^\/.*\/[gimsuy]*$/.test(trimmed)) {
            return false;
          }

          // Email-like values
          if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) {
            return false;
          }

          return true;
        }

        /**
         * Check if a node is a translation function call (t(), i18n.t(), etc.)
         * @param {import('estree').Node} node
         * @returns {boolean}
         */
        function isTranslationCall(node) {
          if (node.type === 'CallExpression') {
            const callee = node.callee;
            // Direct t() call
            if (callee.type === 'Identifier' && callee.name === 't') {
              return true;
            }
            // i18n.t() or this.t() call
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
         * Check if a JSX expression container is a translation call
         * @param {import('estree-jsx').JSXExpressionContainer} node
         * @returns {boolean}
         */
        function isTranslationExpression(node) {
          if (node.type === 'JSXExpressionContainer') {
            return isTranslationCall(node.expression);
          }
          return false;
        }

        return {
          // Check JSX text content: <div>Hello World</div>
          JSXText(node) {
            const value = node.value;

            if (!isUserFacingString(value)) {
              return;
            }

            context.report({
              node,
              messageId: 'noLiteralJsxString',
              data: {
                text: value.trim().substring(0, 50),
              },
            });
          },

          // Check JSX string attribute values: <div title="Hello">
          JSXAttribute(node) {
            // Only check string literal values
            if (
              !node.value ||
              node.value.type !== 'Literal' ||
              typeof node.value.value !== 'string'
            ) {
              return;
            }

            const propName = node.name.type === 'JSXIdentifier' ? node.name.name : '';

            // Skip ignored props
            if (isIgnoredProp(propName)) {
              return;
            }

            const value = node.value.value;

            if (!isUserFacingString(value)) {
              return;
            }

            // User-facing ARIA props should use translation keys
            const isUserFacingAria =
              propName.startsWith('aria-') && userFacingAriaProps.has(propName);

            context.report({
              node: node.value,
              messageId: 'noLiteralJsxAttribute',
              data: {
                text: value.trim().substring(0, 50),
                prop: propName,
              },
            });
          },

          // Check JSX expression containers with string literals: <div>{"Hello"}</div>
          JSXExpressionContainer(node) {
            // Skip translation calls
            if (isTranslationExpression(node)) {
              return;
            }

            // Only check string literals inside expressions
            if (node.expression.type === 'Literal' && typeof node.expression.value === 'string') {
              const value = node.expression.value;
              if (isUserFacingString(value)) {
                context.report({
                  node: node.expression,
                  messageId: 'noLiteralJsxString',
                  data: {
                    text: value.trim().substring(0, 50),
                  },
                });
              }
            }

            // Also check template literals with no expressions: <div>{`Hello World`}</div>
            if (
              node.expression.type === 'TemplateLiteral' &&
              node.expression.expressions.length === 0 &&
              node.expression.quasis.length === 1
            ) {
              const value = node.expression.quasis[0].value.cooked;
              if (isUserFacingString(value)) {
                context.report({
                  node: node.expression,
                  messageId: 'noLiteralJsxString',
                  data: {
                    text: value.trim().substring(0, 50),
                  },
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
      plugins: ['no-literal-jsx-string'],
      rules: {
        'no-literal-jsx-string/no-literal-jsx-string': 'warn',
      },
    },
    strict: {
      plugins: ['no-literal-jsx-string'],
      rules: {
        'no-literal-jsx-string/no-literal-jsx-string': 'error',
      },
    },
  },
};

export default plugin;
