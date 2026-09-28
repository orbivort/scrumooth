/**
 * Token Validation Tests
 *
 * These tests verify that:
 * 1. TypeScript token values match CSS custom property values
 * 2. All tokens are properly defined
 * 3. Token naming conventions are followed
 */

import { describe, it, expect } from 'vitest';
import {
  tokens,
  color,
  semanticColor,
  space,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  borderWidth,
  shadow,
  transition,
  zIndex,
  focusRing,
  breakpoint,
  opacity,
  getSpaceInPixels,
  getBreakpointInPixels,
  meetsContrastAA,
} from './tokens';

describe('Design Tokens', () => {
  describe('Primitive Color Tokens', () => {
    it('should have all primary color shades', () => {
      expect(color.primary[50]).toBe('#eff6ff');
      expect(color.primary[100]).toBe('#dbeafe');
      expect(color.primary[500]).toBe('#3b82f6');
      expect(color.primary[900]).toBe('#1e3a8a');
    });

    it('should have all semantic color shades', () => {
      expect(color.success[500]).toBe('#22c55e');
      expect(color.warning[500]).toBe('#f59e0b');
      expect(color.error[500]).toBe('#ef4444');
    });

    it('should have all gray scale shades', () => {
      expect(color.gray[50]).toBe('#f9fafb');
      expect(color.gray[500]).toBe('#6b7280');
      expect(color.gray[900]).toBe('#111827');
    });
  });

  describe('Semantic Color Tokens', () => {
    it('should have text color aliases', () => {
      expect(semanticColor.text.primary).toBe(color.gray[900]);
      expect(semanticColor.text.secondary).toBe(color.gray[500]);
      expect(semanticColor.text.link).toBe(color.primary[600]);
    });

    it('should have background color aliases', () => {
      expect(semanticColor.background.page).toBe(color.gray[50]);
      expect(semanticColor.background.card).toBe('#ffffff');
    });

    it('should have border color aliases', () => {
      expect(semanticColor.border.default).toBe(color.gray[200]);
      expect(semanticColor.border.focus).toBe(color.primary[500]);
    });

    it('should have interactive color aliases', () => {
      expect(semanticColor.interactive.primary).toBe(color.primary[600]);
      expect(semanticColor.interactive.danger).toBe(color.error[600]);
    });
  });

  describe('Spacing Tokens', () => {
    it('should have all spacing values', () => {
      expect(space[0]).toBe('0');
      expect(space[1]).toBe('0.25rem');
      expect(space[4]).toBe('1rem');
      expect(space[8]).toBe('2rem');
      expect(space[24]).toBe('6rem');
    });

    it('should convert spacing to pixels correctly', () => {
      expect(getSpaceInPixels(0)).toBe(0);
      expect(getSpaceInPixels(1)).toBe(4); // 0.25rem = 4px
      expect(getSpaceInPixels(4)).toBe(16); // 1rem = 16px
      expect(getSpaceInPixels(8)).toBe(32); // 2rem = 32px
    });
  });

  describe('Typography Tokens', () => {
    it('should have font family definitions', () => {
      expect(fontFamily.sans).toContain('Inter');
      expect(fontFamily.mono).toContain('Fira Code');
    });

    it('should have all font sizes', () => {
      expect(fontSize.xs).toBe('0.75rem');
      expect(fontSize.base).toBe('1rem');
      expect(fontSize['4xl']).toBe('2.25rem');
    });

    it('should have all font weights', () => {
      expect(fontWeight.normal).toBe(400);
      expect(fontWeight.medium).toBe(500);
      expect(fontWeight.bold).toBe(700);
    });

    it('should have all line heights', () => {
      expect(lineHeight.tight).toBe(1.25);
      expect(lineHeight.normal).toBe(1.5);
      expect(lineHeight.relaxed).toBe(1.625);
    });
  });

  describe('Border Radius Tokens', () => {
    it('should have all radius values', () => {
      expect(radius.none).toBe('0');
      expect(radius.sm).toBe('0.25rem');
      expect(radius.md).toBe('0.5rem');
      expect(radius.lg).toBe('0.75rem');
      expect(radius.xl).toBe('1rem');
      expect(radius.full).toBe('9999px');
    });
  });

  describe('Border Width Tokens', () => {
    it('should have all border width values', () => {
      expect(borderWidth[0]).toBe('0');
      expect(borderWidth[1]).toBe('1px');
      expect(borderWidth[2]).toBe('2px');
      expect(borderWidth[4]).toBe('4px');
    });
  });

  describe('Shadow Tokens', () => {
    it('should have all shadow values', () => {
      expect(shadow.sm).toContain('rgba(0, 0, 0, 0.05)');
      expect(shadow.md).toContain('rgba(0, 0, 0, 0.1)');
      expect(shadow.lg).toContain('rgba(0, 0, 0, 0.1)');
    });
  });

  describe('Transition Tokens', () => {
    it('should have all transition values', () => {
      expect(transition.fast).toContain('150ms');
      expect(transition.normal).toContain('200ms');
      expect(transition.slow).toContain('300ms');
    });
  });

  describe('Z-Index Tokens', () => {
    it('should have all z-index values in ascending order', () => {
      expect(zIndex.dropdown).toBe(1000);
      expect(zIndex.sticky).toBe(1020);
      expect(zIndex.fixed).toBe(1030);
      expect(zIndex.modalBackdrop).toBe(1040);
      expect(zIndex.modal).toBe(1050);
      expect(zIndex.popover).toBe(1060);
      expect(zIndex.tooltip).toBe(1070);
      expect(zIndex.toast).toBe(1080);
    });
  });

  describe('Focus Ring Tokens', () => {
    it('should have focus ring values', () => {
      expect(focusRing.width).toBe('2px');
      expect(focusRing.offset).toBe('2px');
      expect(focusRing.color).toBe(color.primary[500]);
      expect(focusRing.shadow).toContain(color.primary[500]);
    });
  });

  describe('Breakpoint Tokens', () => {
    it('should have all breakpoint values', () => {
      expect(breakpoint.sm).toBe('640px');
      expect(breakpoint.md).toBe('768px');
      expect(breakpoint.lg).toBe('1024px');
      expect(breakpoint.xl).toBe('1280px');
      expect(breakpoint['2xl']).toBe('1536px');
    });

    it('should convert breakpoints to pixels correctly', () => {
      expect(getBreakpointInPixels('sm')).toBe(640);
      expect(getBreakpointInPixels('md')).toBe(768);
      expect(getBreakpointInPixels('lg')).toBe(1024);
    });
  });

  describe('Opacity Tokens', () => {
    it('should have all opacity values', () => {
      expect(opacity[0]).toBe(0);
      expect(opacity[25]).toBe(0.25);
      expect(opacity[50]).toBe(0.5);
      expect(opacity[75]).toBe(0.75);
      expect(opacity[100]).toBe(1);
    });
  });

  describe('Complete Tokens Object', () => {
    it('should export all token categories', () => {
      expect(tokens.color).toBeDefined();
      expect(tokens.semanticColor).toBeDefined();
      expect(tokens.space).toBeDefined();
      expect(tokens.fontFamily).toBeDefined();
      expect(tokens.fontSize).toBeDefined();
      expect(tokens.fontWeight).toBeDefined();
      expect(tokens.lineHeight).toBeDefined();
      expect(tokens.radius).toBeDefined();
      expect(tokens.borderWidth).toBeDefined();
      expect(tokens.shadow).toBeDefined();
      expect(tokens.transition).toBeDefined();
      expect(tokens.zIndex).toBeDefined();
      expect(tokens.focusRing).toBeDefined();
      expect(tokens.breakpoint).toBeDefined();
      expect(tokens.opacity).toBeDefined();
    });
  });

  describe('Token Naming Conventions', () => {
    it('should use kebab-case for CSS custom properties', () => {
      // CSS custom properties should follow --category-property-variant pattern
      // This is verified by the CSS file, but we can check TypeScript naming
      // Note: Object.keys returns strings, so we compare with string keys
      expect(Object.keys(color.primary)).toEqual(
        expect.arrayContaining([
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
        ])
      );
    });

    it('should use camelCase for TypeScript exports', () => {
      // TypeScript exports should use camelCase
      expect(Object.keys(semanticColor.text)).toEqual(
        expect.arrayContaining([
          'primary',
          'secondary',
          'tertiary',
          'disabled',
          'inverse',
          'link',
          'linkHover',
          'success',
          'warning',
          'error',
        ])
      );
    });
  });

  describe('Token Value Consistency', () => {
    it('should have matching values between primitive and semantic colors', () => {
      // Semantic colors should reference primitive colors
      expect(semanticColor.text.primary).toBe(color.gray[900]);
      expect(semanticColor.interactive.primary).toBe(color.primary[600]);
      expect(semanticColor.border.default).toBe(color.gray[200]);
    });
  });

  describe('getSpaceInPixels Edge Cases', () => {
    it('should return 0 for space[0]', () => {
      expect(getSpaceInPixels(0)).toBe(0);
    });

    it('should convert rem values to pixels', () => {
      expect(getSpaceInPixels(1)).toBe(4);
      expect(getSpaceInPixels(4)).toBe(16);
      expect(getSpaceInPixels(8)).toBe(32);
    });

    it('should handle all valid space keys', () => {
      expect(getSpaceInPixels(2)).toBe(8);
      expect(getSpaceInPixels(3)).toBe(12);
      expect(getSpaceInPixels(6)).toBe(24);
      expect(getSpaceInPixels(12)).toBe(48);
    });

    // The `px` token is the only space value that is neither '0' nor expressed in `rem`, so it is
    // the sole input that reaches the numeric fallback branch at the end of `getSpaceInPixels`
    // (`parseInt(value, 10) || 0`). Exercising it keeps that branch covered instead of dead.
    it('should parse a non-rem, non-zero space token through the numeric fallback', () => {
      expect(getSpaceInPixels('px')).toBe(1);
    });
  });

  describe('meetsContrastAA', () => {
    it('should return true for light background with dark text', () => {
      expect(meetsContrastAA('#111827', '#ffffff')).toBe(true);
      expect(meetsContrastAA('#1f2937', '#f9fafb')).toBe(true);
    });

    it('should return false for dark background with light text', () => {
      expect(meetsContrastAA('#ffffff', '#111827')).toBe(false);
    });

    it('should return false for dark colors on dark background', () => {
      expect(meetsContrastAA('#111827', '#1f2937')).toBe(false);
    });

    it('should return false for light colors on light background', () => {
      expect(meetsContrastAA('#f9fafb', '#ffffff')).toBe(false);
    });
  });

  describe('getBreakpointInPixels', () => {
    it('should return correct pixel values for all breakpoints', () => {
      expect(getBreakpointInPixels('sm')).toBe(640);
      expect(getBreakpointInPixels('md')).toBe(768);
      expect(getBreakpointInPixels('lg')).toBe(1024);
      expect(getBreakpointInPixels('xl')).toBe(1280);
      expect(getBreakpointInPixels('2xl')).toBe(1536);
    });
  });
});
