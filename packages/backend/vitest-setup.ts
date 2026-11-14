import { expect } from 'vitest';
import { isValidUUID, isUUIDv7 } from './src/utils/uuid';

// Set test environment before any imports
process.env.NODE_ENV = 'test';

declare module 'vitest' {
  interface Assertion<R extends void | Promise<void> = void> {
    toBeValidUUID(): R;
    toBeUUIDv7(): R;
  }
  interface AsymmetricMatchersContaining {
    toBeValidUUID(): void;
    toBeUUIDv7(): void;
  }
}

expect.extend({
  toBeValidUUID(received: string) {
    const pass = isValidUUID(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },
  toBeUUIDv7(received: string) {
    const pass = isUUIDv7(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUIDv7`
          : `expected ${received} to be a valid UUIDv7`,
    };
  },
});
