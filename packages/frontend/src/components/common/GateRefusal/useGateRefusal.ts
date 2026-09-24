// A refusal, read as the rule it enforced rather than as a sentence.
//
// Every gate the backend enforces carries a stable code (`GATE_CODES`) and a contract entry
// (`GATE_DEFINITIONS`) naming where its copy lives. The server also sends a localized message, which
// is enough to *read* but not to *act*: a refusal the reader cannot act on is a dead end, and the
// review that produced this component found three of them (the adoption race, a team-scoped write
// while grouped, and a readiness edit by a non-Scrum-Master).
//
// The copy is looked up by code, never by matching the message text, so a reworded server message
// cannot silently detach a refusal from its rule. The namespace is deliberately partial: the gates
// the commitment surfaces can provoke have copy, and anything else falls back to the server's own
// message rather than showing nothing.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GATE_I18N_NAMESPACE, getGateDefinition } from '@scrumooth/shared';

import { useApiError } from '@/hooks/useApiError';

/** The fields a gate's copy tree holds. */
type GateCopyField = 'rule' | 'guideClause' | 'recovery';

/** One refusal, ready to render. */
export interface GateRefusalView {
  /** Whether the refusal carried a gate code this product knows. */
  isGate: boolean;
  /** The stable gate code, or null when the refusal was not a gate. */
  code: string | null;
  /**
   * What was enforced, in the reader's language.
   *
   * Falls back to the server's own message, which is already localized, so a gate without copy here
   * still says something true rather than nothing.
   */
  rule: string;
  /** The 2020 Scrum Guide clause the rule comes from, when one exists. Null for a team's own practice. */
  guideClause: string | null;
  /** What the reader can do about it. Null when no remedy is declared, in which case the caller's control is the remedy. */
  recovery: string | null;
  /** The server's message, kept because it sometimes carries the values the copy cannot interpolate. */
  message: string;
  /** The HTTP status, when the failure reached the server. */
  status: number | undefined;
}

/**
 * Read a refusal, or null when there is nothing to read.
 *
 * @param error the rejected value from a query or mutation -- an Axios error, an Error, or anything
 * else; `useApiError().extractError` normalises them all.
 */
export function useGateRefusal(error: unknown): GateRefusalView | null {
  const { i18n } = useTranslation(GATE_I18N_NAMESPACE);
  const { extractError } = useApiError();

  return useMemo(() => {
    if (error === null || error === undefined) {
      return null;
    }

    const apiError = extractError(error);
    const definition = getGateDefinition(apiError.code);

    /**
     * Read one field of the gate's copy tree, or null.
     *
     * `exists` rather than `t(key, { defaultValue: '' })`: the i18n configuration replaces a missing
     * key with the key's own last segment in production, so an empty-default test would report copy
     * that is not there and render the word "rule" as the rule.
     */
    const read = (field: GateCopyField): string | null => {
      if (!definition) {
        return null;
      }

      const key = `${GATE_I18N_NAMESPACE}:${definition.i18nKey}.${field}`;
      // The key is composed at runtime from a gate code, so the strongly-typed resource union cannot
      // verify it; `exists` is what decides whether the copy is there.
      return i18n.exists(key) ? i18n.t(key as never) : null;
    };

    const rule = read('rule');

    return {
      isGate: !!definition,
      code: definition ? definition.code : null,
      rule: rule ?? apiError.message,
      guideClause: read('guideClause'),
      recovery: read('recovery'),
      message: apiError.message,
      status: apiError.status,
    };
  }, [error, extractError, i18n]);
}
