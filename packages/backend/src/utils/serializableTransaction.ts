// Serializable transactions with a bounded retry.
//
// Two Scrum Guide guarantees on a team -- "one Product Owner and one Scrum Master" and "10 or fewer
// people" -- are read-modify-write rules: count the holders, then write. At the default isolation
// level two requests can each read "no Product Owner yet" and both insert, and the Guide's rule is
// then violated with nothing to catch it. At `Serializable`, PostgreSQL's snapshot isolation
// detects the conflicting predicate reads and aborts one of the two with a serialization failure;
// the retry then re-runs it, sees the row the winner wrote, and refuses it properly.
//
// The abort is expected, not exceptional: it is the mechanism working. So it is retried with a
// short jittered backoff and logged at `warn` with the attempt number only -- never with the
// payload, which for these callers would mean a member's email address.
import prisma from './prisma';
import { logger } from './logger';
import { Prisma } from '../generated/prisma/client';

/** How many times a serialization conflict is re-attempted before it is reported as a failure. */
const MAX_ATTEMPTS = 3;

/** Base backoff between attempts; jitter keeps two contending requests from re-colliding. */
const BASE_BACKOFF_MS = 15;

/** The transaction client handed to the callback, so callers can type their own helpers. */
export type TransactionClient = Prisma.TransactionClient;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Codes that mean "the database refused this transaction's interleaving; running it again may succeed". */
const SERIALIZATION_CONFLICT_CODES = new Set(['P2034', '40001', '40P01']);

/** The `@prisma/adapter-pg` spelling of SQLSTATE `40001`, which carries no code of its own. */
const WRITE_CONFLICT_KIND = 'TransactionWriteConflict';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The code a failure carries directly, read structurally. */
const errorCode = (error: unknown): string | undefined => {
  const code = isRecord(error) ? error.code : undefined;

  return typeof code === 'string' ? code : undefined;
};

/**
 * The payload of a `@prisma/adapter-pg` `DriverAdapterError`, when the failure is one.
 *
 * Prisma surfaces a write conflict as `P2034` ("Transaction failed due to a write conflict or a
 * deadlock"). With a driver adapter the same failure can instead arrive as the adapter's own
 * error, which carries no `code` at all: the driver maps the SQLSTATE into `cause.kind`
 * (`TransactionWriteConflict` for `40001`) and, for any SQLSTATE without a mapping of its own such
 * as a deadlock, into `cause.code`. Recognising only the Prisma spelling means the conflict is
 * treated as an unknown failure: the refusal is never retried and it reaches the caller as a 500.
 */
const driverAdapterPayload = (error: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(error) || error.name !== 'DriverAdapterError' || !isRecord(error.cause)) {
    return undefined;
  }

  return error.cause;
};

const isSerializationConflict = (error: unknown): boolean => {
  const code = errorCode(error);

  if (code !== undefined && SERIALIZATION_CONFLICT_CODES.has(code)) {
    return true;
  }

  // Prisma sometimes wraps the driver's failure, leaving the SQLSTATE under `meta`.
  const metaCode = isRecord(error) && isRecord(error.meta) ? error.meta.code : undefined;

  if (typeof metaCode === 'string' && SERIALIZATION_CONFLICT_CODES.has(metaCode)) {
    return true;
  }

  const adapterPayload = driverAdapterPayload(error);

  if (adapterPayload?.kind === WRITE_CONFLICT_KIND) {
    return true;
  }

  return (
    typeof adapterPayload?.code === 'string' &&
    SERIALIZATION_CONFLICT_CODES.has(adapterPayload.code)
  );
};

/**
 * Run `operation` in a `Serializable` transaction, retrying a serialization conflict a bounded
 * number of times.
 *
 * Every other error -- including the deliberate refusals thrown from inside the callback, such as
 * `GATE_LEADERSHIP_ROLE_TAKEN` -- propagates unchanged and is never retried: a refusal is a
 * decision, not a conflict.
 */
export async function withSerializableTransaction<T>(
  operation: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  let attempt = 0;

  for (;;) {
    attempt += 1;

    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt >= MAX_ATTEMPTS) {
        throw error;
      }

      logger.warn('Serializable transaction hit a write conflict; retrying', { attempt });

      await sleep(BASE_BACKOFF_MS * attempt + Math.floor(Math.random() * BASE_BACKOFF_MS));
    }
  }
}
