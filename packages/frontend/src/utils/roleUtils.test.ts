import { describe, it, expect } from 'vitest';

import {
  getRoleLabel,
  getRoleBadgeClass,
  getRoleBadgeColor,
  canStartSprint,
  canOrderBacklog,
} from './roleUtils';

describe('roleUtils', () => {
  describe('getRoleLabel', () => {
    it('should return "No Role" for null', () => {
      expect(getRoleLabel(null)).toBe('No Role');
    });

    it('should return "No Role" for empty string', () => {
      expect(getRoleLabel('')).toBe('No Role');
    });

    it('should return "Product Owner" for PRODUCT_OWNER', () => {
      expect(getRoleLabel('PRODUCT_OWNER')).toBe('Product Owner');
    });

    it('should return "Scrum Master" for SCRUM_MASTER', () => {
      expect(getRoleLabel('SCRUM_MASTER')).toBe('Scrum Master');
    });

    it('should return "Developers" for DEVELOPERS', () => {
      expect(getRoleLabel('DEVELOPERS')).toBe('Developers');
    });

    it('should return the role itself for unknown roles', () => {
      expect(getRoleLabel('UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
    });

    it('should handle lowercase roles', () => {
      expect(getRoleLabel('product_owner')).toBe('product_owner');
    });
  });

  describe('getRoleBadgeClass', () => {
    const mockStyles = {
      'badge-default': 'default-class',
      'badge-po': 'po-class',
      'badge-sm': 'sm-class',
      'badge-dev': 'dev-class',
    };

    it('should return default class for null', () => {
      expect(getRoleBadgeClass(null, mockStyles)).toBe('default-class');
    });

    it('should return default class for empty string', () => {
      expect(getRoleBadgeClass('', mockStyles)).toBe('default-class');
    });

    it('should return po class for PRODUCT_OWNER', () => {
      expect(getRoleBadgeClass('PRODUCT_OWNER', mockStyles)).toBe('po-class');
    });

    it('should return sm class for SCRUM_MASTER', () => {
      expect(getRoleBadgeClass('SCRUM_MASTER', mockStyles)).toBe('sm-class');
    });

    it('should return dev class for DEVELOPERS', () => {
      expect(getRoleBadgeClass('DEVELOPERS', mockStyles)).toBe('dev-class');
    });

    it('should return default class for unknown roles', () => {
      expect(getRoleBadgeClass('UNKNOWN', mockStyles)).toBe('default-class');
    });

    it('should handle missing styles gracefully', () => {
      const emptyStyles: Record<string, string> = {};
      expect(getRoleBadgeClass('PRODUCT_OWNER', emptyStyles)).toBe('');
      expect(getRoleBadgeClass(null, emptyStyles)).toBe('');
    });

    it('should handle partial styles', () => {
      const partialStyles = { 'badge-po': 'po-class' };
      expect(getRoleBadgeClass('PRODUCT_OWNER', partialStyles)).toBe('po-class');
      expect(getRoleBadgeClass('DEVELOPERS', partialStyles)).toBe('');
    });

    it('should return empty string for SCRUM_MASTER when badge-sm style is missing', () => {
      const partialStyles = { 'badge-po': 'po-class' };
      expect(getRoleBadgeClass('SCRUM_MASTER', partialStyles)).toBe('');
    });

    it('should return empty string for default when badge-default style is missing', () => {
      const partialStyles = { 'badge-po': 'po-class' };
      expect(getRoleBadgeClass(null, partialStyles)).toBe('');
    });
  });

  describe('getRoleBadgeColor', () => {
    it('should return gray for null', () => {
      expect(getRoleBadgeColor(null)).toBe('#6b7280');
    });

    it('should return gray for empty string', () => {
      expect(getRoleBadgeColor('')).toBe('#6b7280');
    });

    it('should return amber for PRODUCT_OWNER', () => {
      expect(getRoleBadgeColor('PRODUCT_OWNER')).toBe('#f59e0b');
    });

    it('should return blue for SCRUM_MASTER', () => {
      expect(getRoleBadgeColor('SCRUM_MASTER')).toBe('#3b82f6');
    });

    it('should return green for DEVELOPERS', () => {
      expect(getRoleBadgeColor('DEVELOPERS')).toBe('#10b981');
    });

    it('should return gray for unknown roles', () => {
      expect(getRoleBadgeColor('UNKNOWN')).toBe('#6b7280');
    });
  });

  describe('canStartSprint', () => {
    it('should return true when both a Sprint Goal and a saved backlog are present', () => {
      expect(canStartSprint({ hasSprintGoal: true, hasSavedBacklog: true })).toBe(true);
    });

    it('should return false when there is no Sprint Goal', () => {
      expect(canStartSprint({ hasSprintGoal: false, hasSavedBacklog: true })).toBe(false);
    });

    it('should return false when the Sprint Backlog has not been saved', () => {
      expect(canStartSprint({ hasSprintGoal: true, hasSavedBacklog: false })).toBe(false);
    });

    it('should return false when neither prerequisite is met', () => {
      expect(canStartSprint({ hasSprintGoal: false, hasSavedBacklog: false })).toBe(false);
    });
  });

  describe('canOrderBacklog', () => {
    it('should allow the Product Owner', () => {
      expect(canOrderBacklog('PRODUCT_OWNER')).toBe(true);
    });

    it('should accept the lowercase role form', () => {
      expect(canOrderBacklog('product_owner')).toBe(true);
    });

    it('should refuse the Scrum Master', () => {
      expect(canOrderBacklog('SCRUM_MASTER')).toBe(false);
    });

    it('should refuse a Developer', () => {
      expect(canOrderBacklog('DEVELOPERS')).toBe(false);
    });

    it('should refuse a missing role', () => {
      expect(canOrderBacklog(null)).toBe(false);
      expect(canOrderBacklog(undefined)).toBe(false);
    });
  });
});
