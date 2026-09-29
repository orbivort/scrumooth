import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// We mock the entire i18next ecosystem so that importing config.ts does not
// perform real network / DOM side effects and so we can capture the
// post-processor module and the init() options for assertions.

// Captured arguments passed to i18n.use(...)
const useArgs: unknown[] = [];
// Captured options passed to i18nInstance.init(...)
let initOptions: Record<string, unknown> | null = null;
let initReturn: unknown = Promise.resolve(vi.fn());
// Whether init() should reject (to test error propagation)
let initShouldReject = false;

const mockI18nInstance = {
  use(module: unknown) {
    useArgs.push(module);
    return mockI18nInstance;
  },
  init(options: Record<string, unknown>) {
    initOptions = options;
    if (initShouldReject) {
      return Promise.reject(new Error('init failed'));
    }
    return Promise.resolve(initReturn);
  },
};

vi.mock('i18next', () => ({
  default: mockI18nInstance,
  // The named type imports (TFunction, PostProcessorModule) are types only and
  // are erased at runtime; we just need the default export.
  __esModule: true,
}));

vi.mock('react-i18next', () => ({ initReactI18next: Symbol('initReactI18next') }));
vi.mock('i18next-http-backend', () => ({ default: Symbol('HttpBackend') }));
vi.mock('i18next-browser-languagedetector', () => ({
  default: Symbol('LanguageDetector'),
}));

// Reference the real shared constants so assertions stay in sync with source.
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  SUPPORTED_LOCALES_DEV,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_PATH,
  LOCALE_COOKIE_SAME_SITE,
} from '@scrumooth/shared';

// Must be imported AFTER the mocks are registered.
const { initI18n, i18nInstance } = await import('./config');

// Capture the post-processor once at module load (the .use() chain runs at
// import time, so we must not clear useArgs later).
const PENDING_GUARD_PROCESSOR = (() => {
  const processor = useArgs.find(
    (arg) =>
      arg !== null &&
      typeof arg === 'object' &&
      (arg as { type?: string }).type === 'postProcessor' &&
      (arg as { name?: string }).name === 'pendingGuard'
  );
  if (!processor) {
    throw new Error('pendingGuard post-processor was not registered via i18n.use()');
  }
  return processor as never;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the pendingGuard post-processor captured via i18n.use() */
function getPendingGuardProcessor(): PendingGuardProcessor {
  return PENDING_GUARD_PROCESSOR as PendingGuardProcessor;
}

// ---------------------------------------------------------------------------
// Helpers (types)
// ---------------------------------------------------------------------------
type PendingGuardProcessor = {
  type: string;
  name: string;
  process: (
    value: string,
    key: string | string[],
    options: Record<string, unknown>,
    translator: { translate: (k: string, o?: unknown) => string }
  ) => string;
};

/** Restore import.meta.env flags to a known state (PROD/DEV are mutually exclusive) */
function setEnv(prod: boolean) {
  vi.stubEnv('PROD', prod);
  vi.stubEnv('DEV', !prod);
}

const FAKE_TRANSLATOR = {
  translate: vi.fn((key: string) => `translated(${key})`),
};

describe('i18n config', () => {
  beforeEach(() => {
    initOptions = null;
    initShouldReject = false;
    initReturn = vi.fn();
    vi.clearAllMocks();
    setEnv(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('module registration', () => {
    it('should export a configured i18n instance', () => {
      expect(i18nInstance).toBeDefined();
      expect(i18nInstance).toBe(mockI18nInstance);
    });

    it('should register HttpBackend, LanguageDetector, initReactI18next and pendingGuard post-processor', () => {
      const types = useArgs.map((a) =>
        a && typeof a === 'object' && 'type' in (a as object)
          ? (a as { type: string }).type
          : 'module'
      );
      // 4 .use() calls: HttpBackend, LanguageDetector, initReactI18next, pendingGuard
      expect(useArgs).toHaveLength(4);
      expect(types).toContain('postProcessor');
    });
  });

  describe('pendingGuardPostProcessor.process', () => {
    it('should keep raw __pending__ value in DEV mode', () => {
      setEnv(false);
      const processor = getPendingGuardProcessor();
      const result = processor.process('__pending__', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);
      expect(result).toBe('__pending__');
      expect(FAKE_TRANSLATOR.translate).not.toHaveBeenCalled();
    });

    it('should replace __pending__ with fallback translation in PROD mode', () => {
      setEnv(true);
      const processor = getPendingGuardProcessor();
      const result = processor.process('__pending__', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);
      expect(FAKE_TRANSLATOR.translate).toHaveBeenCalledWith('common:translationPending', {
        lng: 'en',
      });
      expect(result).toBe('translated(common:translationPending)');
    });

    it('should pass through non-pending values unchanged in PROD mode', () => {
      setEnv(true);
      const processor = getPendingGuardProcessor();
      const result = processor.process('hello', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);
      expect(result).toBe('hello');
      expect(FAKE_TRANSLATOR.translate).not.toHaveBeenCalled();
    });

    it('should pass through non-pending values unchanged in DEV mode', () => {
      setEnv(false);
      const processor = getPendingGuardProcessor();
      const result = processor.process('hello', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);
      expect(result).toBe('hello');
    });

    it('should handle array keys', () => {
      setEnv(true);
      const processor = getPendingGuardProcessor();
      processor.process(
        '__pending__',
        ['common:foo', 'common:bar'],
        { lng: 'de' },
        FAKE_TRANSLATOR
      );
      expect(FAKE_TRANSLATOR.translate).toHaveBeenCalledWith('common:translationPending', {
        lng: 'de',
      });
    });

    it('should emit a sampled warning (~1%) when rendering pending in PROD', () => {
      setEnv(true);
      const processor = getPendingGuardProcessor();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.005); // < 0.01

      processor.process('__pending__', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);

      expect(warnSpy).toHaveBeenCalledWith('Pending translation rendered', {
        key: 'common:foo',
        lng: 'en',
      });
      randomSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should NOT emit a warning when sampling misses (>= 1%)', () => {
      setEnv(true);
      const processor = getPendingGuardProcessor();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // >= 0.01

      processor.process('__pending__', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);

      expect(warnSpy).not.toHaveBeenCalled();
      randomSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should NOT emit a warning in DEV mode even when sampling hits', () => {
      setEnv(false);
      const processor = getPendingGuardProcessor();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.001);

      processor.process('__pending__', 'common:foo', { lng: 'en' }, FAKE_TRANSLATOR);

      expect(warnSpy).not.toHaveBeenCalled();
      randomSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('initI18n', () => {
    it('should resolve with the t function from init()', async () => {
      const fakeT = vi.fn();
      initReturn = Promise.resolve(fakeT);
      const result = await initI18n();
      expect(result).toBe(fakeT);
    });

    it('should configure backend loadPath from VITE_BASE_PATH without double slash', async () => {
      vi.stubEnv('VITE_BASE_PATH', '/scrumooth/');
      await initI18n();
      expect((initOptions as { backend: { loadPath: string } }).backend.loadPath).toBe(
        '/scrumooth/locales/{{lng}}/{{ns}}.json'
      );
      vi.stubEnv('VITE_BASE_PATH', '/');
    });

    it('should configure backend loadPath with default base when VITE_BASE_PATH is unset', async () => {
      vi.stubEnv('VITE_BASE_PATH', '');
      await initI18n();
      expect((initOptions as { backend: { loadPath: string } }).backend.loadPath).toBe(
        '/locales/{{lng}}/{{ns}}.json'
      );
      vi.stubEnv('VITE_BASE_PATH', '/');
    });

    it('should configure detection order cookie -> navigator and align cookie options with shared config', async () => {
      await initI18n();
      const detection = (initOptions as { detection: Record<string, unknown> }).detection;
      expect(detection.order).toEqual(['cookie', 'navigator']);
      expect(detection.lookupCookie).toBe(LOCALE_COOKIE_NAME);
      expect(detection.caches).toEqual(['cookie']);
      const cookieOptions = detection.cookieOptions as Record<string, unknown>;
      expect(cookieOptions.path).toBe(LOCALE_COOKIE_PATH);
      expect(cookieOptions.sameSite).toBe(LOCALE_COOKIE_SAME_SITE);
    });

    it('should mark cookie secure only when running on https', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, protocol: 'https:' },
        configurable: true,
      });
      await initI18n();
      const cookieOptions = (initOptions as { detection: { cookieOptions: { secure: boolean } } })
        .detection.cookieOptions;
      expect(cookieOptions.secure).toBe(true);
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        configurable: true,
      });
    });

    it('should NOT mark cookie secure on http', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, protocol: 'http:' },
        configurable: true,
      });
      await initI18n();
      const cookieOptions = (initOptions as { detection: { cookieOptions: { secure: boolean } } })
        .detection.cookieOptions;
      expect(cookieOptions.secure).toBe(false);
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        configurable: true,
      });
    });

    it('should use DEV supported locales when DEV is true', async () => {
      setEnv(false); // DEV
      await initI18n();
      const supported = (initOptions as { supportedLngs: string[] }).supportedLngs;
      expect(supported).toEqual([...SUPPORTED_LOCALES_DEV]);
    });

    it('should use PROD supported locales when PROD is true', async () => {
      setEnv(true);
      await initI18n();
      const supported = (initOptions as { supportedLngs: string[] }).supportedLngs;
      expect(supported).toEqual([...SUPPORTED_LOCALES]);
    });

    it('should set fallbackLng to DEFAULT_LOCALE and core i18n flags', async () => {
      await initI18n();
      expect((initOptions as { fallbackLng: string }).fallbackLng).toBe(DEFAULT_LOCALE);
      expect((initOptions as { nonExplicitSupportedLngs: boolean }).nonExplicitSupportedLngs).toBe(
        true
      );
      expect((initOptions as { load: string }).load).toBe('currentOnly');
      expect((initOptions as { defaultNS: string }).defaultNS).toBe('common');
      expect((initOptions as { returnNull: boolean }).returnNull).toBe(false);
      expect((initOptions as { returnEmptyString: boolean }).returnEmptyString).toBe(false);
      expect((initOptions as { postProcess: string[] }).postProcess).toEqual(['pendingGuard']);
      expect(
        (initOptions as { interpolation: { escapeValue: boolean } }).interpolation.escapeValue
      ).toBe(false);
      expect((initOptions as { react: { useSuspense: boolean } }).react.useSuspense).toBe(true);
    });

    it('should register all expected namespaces', async () => {
      await initI18n();
      const ns = (initOptions as { ns: string[] }).ns;
      const expected = [
        'common',
        'auth',
        'dashboard',
        'backlog',
        'sprint',
        'daily-scrum',
        'impediments',
        'increments',
        'sprint-review',
        'retrospective',
        'reports',
        'team',
        'settings',
        'notifications',
        'errors',
        'validation',
        'scrum-master-dashboard',
        'timebox',
        'barriers',
        'agreements',
        // The Scrum Guide rule behind a refusal, loaded eagerly so a refusal never shows the fallback.
        'gate',
      ];
      expect(ns).toEqual(expected);
    });

    it('parseMissingKeyHandler should return key unchanged in DEV', async () => {
      setEnv(false);
      await initI18n();
      const handler = (initOptions as { parseMissingKeyHandler: (k: string) => string })
        .parseMissingKeyHandler;
      expect(handler('common:foo.bar')).toBe('common:foo.bar');
    });

    it('parseMissingKeyHandler should return last segment in PROD (namespaced key)', async () => {
      setEnv(true);
      await initI18n();
      const handler = (initOptions as { parseMissingKeyHandler: (k: string) => string })
        .parseMissingKeyHandler;
      expect(handler('common:foo.bar')).toBe('bar');
    });

    it('parseMissingKeyHandler should return key in PROD when no namespace separator', async () => {
      setEnv(true);
      await initI18n();
      const handler = (initOptions as { parseMissingKeyHandler: (k: string) => string })
        .parseMissingKeyHandler;
      expect(handler('standalone')).toBe('standalone');
    });

    it('parseMissingKeyHandler should handle single-segment dotted key in PROD', async () => {
      setEnv(true);
      await initI18n();
      const handler = (initOptions as { parseMissingKeyHandler: (k: string) => string })
        .parseMissingKeyHandler;
      expect(handler('onlyone')).toBe('onlyone');
    });

    it('should propagate init() rejection', async () => {
      initShouldReject = true;
      await expect(initI18n()).rejects.toThrow('init failed');
    });
  });
});
