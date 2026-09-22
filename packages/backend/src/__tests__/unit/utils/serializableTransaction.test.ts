import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withSerializableTransaction } from '../../../utils/serializableTransaction';
import prisma from '../../../utils/prisma';
import { Prisma } from '../../../generated/prisma/client';

vi.mock('../../../utils/prisma', () => ({
  default: {
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const transactionMock = prisma.$transaction as unknown as {
  mockImplementation: (
    implementation: (callback: (client: unknown) => Promise<unknown>) => Promise<unknown>
  ) => void;
};

/** A serialization conflict as Prisma reports it. */
const conflictError = () =>
  Object.assign(new Error('Transaction failed due to a write conflict'), { code: 'P2034' });

describe('withSerializableTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the operation at Serializable isolation', async () => {
    const operation = vi.fn().mockResolvedValue('done');
    transactionMock.mockImplementation((callback) => callback({ id: 'tx' }));

    const result = await withSerializableTransaction(operation);

    expect(result).toBe('done');
    expect(operation).toHaveBeenCalledWith({ id: 'tx' });
    expect(prisma.$transaction).toHaveBeenCalledWith(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('re-runs the operation after a serialization conflict, and returns the retried result', async () => {
    const operation = vi.fn().mockResolvedValue('second-attempt');
    let attempts = 0;
    transactionMock.mockImplementation((callback) => {
      attempts += 1;
      if (attempts === 1) {
        // The first attempt is aborted by the database, exactly as two concurrent adds would be.
        return Promise.reject(conflictError());
      }
      return callback({ id: 'tx' });
    });

    const result = await withSerializableTransaction(operation);

    expect(result).toBe('second-attempt');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
  });

  it('retries a raw serialization SQLSTATE, which a driver adapter may surface untranslated', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    let attempts = 0;
    transactionMock.mockImplementation((callback) => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(
          Object.assign(new Error('could not serialize access'), { code: '40001' })
        );
      }
      return callback({ id: 'tx' });
    });

    await expect(withSerializableTransaction(operation)).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });

  it('retries a conflict Prisma left wrapped under meta', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    let attempts = 0;
    transactionMock.mockImplementation((callback) => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(
          Object.assign(new Error('deadlock detected'), { meta: { code: '40P01' } })
        );
      }
      return callback({ id: 'tx' });
    });

    await expect(withSerializableTransaction(operation)).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });

  it('retries the driver adapter spelling of a write conflict, which carries no code', async () => {
    // `@prisma/adapter-pg` reports SQLSTATE 40001 as its own error: `name` is `DriverAdapterError`
    // and the SQLSTATE is mapped to a `kind` under `cause`, with no `code` anywhere on the error.
    const adapterConflict = Object.assign(new Error('TransactionWriteConflict'), {
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict', originalCode: '40001' },
    });
    const operation = vi.fn().mockResolvedValue('ok');
    let attempts = 0;
    transactionMock.mockImplementation((callback) => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(adapterConflict);
      }
      return callback({ id: 'tx' });
    });

    await expect(withSerializableTransaction(operation)).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });

  it('retries a deadlock the driver adapter left under cause.code', async () => {
    const adapterDeadlock = Object.assign(new Error('postgres'), {
      name: 'DriverAdapterError',
      cause: { kind: 'postgres', code: '40P01', message: 'deadlock detected' },
    });
    const operation = vi.fn().mockResolvedValue('ok');
    let attempts = 0;
    transactionMock.mockImplementation((callback) => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(adapterDeadlock);
      }
      return callback({ id: 'tx' });
    });

    await expect(withSerializableTransaction(operation)).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });

  it('never retries an adapter failure that is not a conflict', async () => {
    const adapterError = Object.assign(new Error('UniqueConstraintViolation'), {
      name: 'DriverAdapterError',
      cause: { kind: 'UniqueConstraintViolation' },
    });
    let attempts = 0;
    transactionMock.mockImplementation(() => {
      attempts += 1;
      return Promise.reject(adapterError);
    });

    await expect(withSerializableTransaction(vi.fn())).rejects.toBe(adapterError);
    expect(attempts).toBe(1);
  });

  it('never retries a refusal, because a gate decision is not a conflict', async () => {
    const refusal = Object.assign(new Error('GATE_LEADERSHIP_ROLE_TAKEN'), {
      code: 'GATE_LEADERSHIP_ROLE_TAKEN',
      statusCode: 409,
    });
    let attempts = 0;
    transactionMock.mockImplementation(() => {
      attempts += 1;
      return Promise.reject(refusal);
    });

    await expect(withSerializableTransaction(vi.fn())).rejects.toBe(refusal);
    expect(attempts).toBe(1);
  });

  it('gives up after a bounded number of attempts instead of retrying forever', async () => {
    let attempts = 0;
    transactionMock.mockImplementation(() => {
      attempts += 1;
      return Promise.reject(conflictError());
    });

    await expect(withSerializableTransaction(vi.fn())).rejects.toMatchObject({ code: 'P2034' });
    expect(attempts).toBe(3);
  });
});
