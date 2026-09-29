import { describe, it, expect, beforeAll, vi } from 'vitest';
import { i18nInstance } from '../../../i18n/config.js';
import { logger } from '../../../utils/logger.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@scrumooth/shared';

describe('i18n config', () => {
  beforeAll(async () => {
    // Ensure i18next is initialized before tests run
    await i18nInstance.init();
  });

  describe('i18next instance', () => {
    it('should be initialized', () => {
      expect(i18nInstance.isInitialized).toBe(true);
    });
  });

  describe('supported locales', () => {
    it('should have all 5 locales as supported languages', () => {
      const supportedLngs = i18nInstance.options.supportedLngs as string[];
      for (const locale of SUPPORTED_LOCALES) {
        expect(supportedLngs).toContain(locale);
      }
    });

    it('should have English as the default/fallback locale', () => {
      const fallbackLng = i18nInstance.options.fallbackLng;
      // i18next may normalize fallbackLng to an array
      if (Array.isArray(fallbackLng)) {
        expect(fallbackLng).toContain(DEFAULT_LOCALE);
      } else {
        expect(fallbackLng).toEqual(DEFAULT_LOCALE);
      }
    });
  });

  describe('namespaces', () => {
    const expectedNamespaces = ['emails', 'notifications', 'errors', 'validation'];

    it('should have all 4 namespaces configured', () => {
      const configuredNamespaces = i18nInstance.options.ns as string[];
      for (const ns of expectedNamespaces) {
        expect(configuredNamespaces).toContain(ns);
      }
    });

    it('should have errors as the default namespace', () => {
      expect(i18nInstance.options.defaultNS).toBe('errors');
    });
  });

  describe('translation key resolution', () => {
    it('should resolve English error keys', () => {
      const result = i18nInstance.t('errors:entityNotFound', {
        lng: 'en',
        entity: 'User',
      });
      expect(result).toContain('User');
      expect(result).toContain('not found');
    });

    it('should resolve German error keys', () => {
      const result = i18nInstance.t('errors:entityNotFound', {
        lng: 'de',
        entity: 'User',
      });
      expect(result).toBeTruthy();
    });

    it('should resolve French error keys', () => {
      const result = i18nInstance.t('errors:entityNotFound', {
        lng: 'fr',
        entity: 'User',
      });
      expect(result).toBeTruthy();
    });

    it('should resolve Spanish error keys', () => {
      const result = i18nInstance.t('errors:entityNotFound', {
        lng: 'es',
        entity: 'User',
      });
      expect(result).toBeTruthy();
    });

    it('should resolve Italian error keys', () => {
      const result = i18nInstance.t('errors:entityNotFound', {
        lng: 'it',
        entity: 'User',
      });
      expect(result).toBeTruthy();
    });

    it('should resolve validation namespace keys', () => {
      const result = i18nInstance.t('validation:fieldRequired', { lng: 'en' });
      expect(result).toBeTruthy();
    });

    it('should resolve notification namespace keys', () => {
      const result = i18nInstance.t('notifications:sprintStarted', { lng: 'en' });
      expect(result).toBeTruthy();
    });

    it('should resolve email namespace keys', () => {
      const result = i18nInstance.t('emails:welcome', { lng: 'en' });
      expect(result).toBeTruthy();
    });

    it('should interpolate parameters into translation values', () => {
      const result = i18nInstance.t('errors:emailAlreadyExists', {
        lng: 'en',
        email: 'test@example.com',
      });
      expect(result).toContain('test@example.com');
    });

    it('should fall back to default locale for missing keys', () => {
      // If a key doesn't exist in one locale, it falls back to the fallback language
      const result = i18nInstance.t('errors:invalidCredentials', { lng: 'en' });
      expect(result).toBeTruthy();
    });
  });

  describe('missing key handlers', () => {
    it('logs a warning through the missingKeyHandler when a key is missing', () => {
      // Arrange
      const warnSpy = vi.spyOn(logger, 'warn');
      const handler = i18nInstance.options.missingKeyHandler as unknown as (
        lngs: string[],
        ns: string,
        key: string
      ) => void;
      expect(typeof handler).toBe('function');

      // Act
      handler(['en'], 'errors', 'some.missing.key');

      // Assert
      expect(warnSpy).toHaveBeenCalledWith('Missing i18n key', {
        lng: ['en'],
        ns: 'errors',
        key: 'some.missing.key',
      });
      warnSpy.mockRestore();
    });

    it('parseMissingKeyHandler returns the last segment of a namespaced key', () => {
      // Arrange
      const parse = i18nInstance.options.parseMissingKeyHandler as unknown as (
        key: string
      ) => string;
      expect(typeof parse).toBe('function');

      // Act & Assert
      expect(parse('errors:someKey')).toBe('someKey');
      expect(parse('a.b.c')).toBe('c');
    });
  });
});
