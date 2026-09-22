import { useEffect, useMemo, useState } from 'react';

import { definitionService } from '@/services';
import { logger } from '@/utils/logger';

/**
 * What the Sprint boundary requires of a team's two agreements, as the interface can see them.
 *
 * This is a *hint*, not the gate. The service layer decides — `saveSprintBacklog` and `startSprint`
 * refuse with `GATE_DOD_REQUIRED`, `GATE_DOR_REQUIRED` or `GATE_DOR_NOT_VERIFIED` — and this hook
 * exists so the interface can explain the refusal before the user submits, instead of surfacing it
 * as a failure afterwards. It deliberately fails open: a transient read error must never disable the
 * action, because the server is still the authority and a client-side glitch is not a process
 * blocker.
 */
export interface SprintCommitmentReadiness {
  /** Whether the resolved Definition of Done holds at least one active criterion. */
  hasDefinitionOfDone: boolean;
  /** How many active criteria the readiness agreement holds (`0` = the team has none). */
  activeReadinessItemCount: number;
  /** Selected items that still have at least one unverified active readiness criterion. */
  unreadyPbiIds: string[];
  isLoading: boolean;
}

const READY: SprintCommitmentReadiness = {
  hasDefinitionOfDone: true,
  activeReadinessItemCount: 0,
  unreadyPbiIds: [],
  isLoading: false,
};

/**
 * Read the two agreements the Sprint boundary is gated on for the selected items.
 *
 * @param teamId - the team whose agreements apply
 * @param selectedPbiIds - the items the team is about to commit to
 */
export const useSprintCommitmentReadiness = (
  teamId: string | undefined,
  selectedPbiIds: string[]
): SprintCommitmentReadiness => {
  const [readiness, setReadiness] = useState<SprintCommitmentReadiness>(READY);

  // The effect keys off the *set* of items, so re-renders that hand back an equal selection (a new
  // array each time) do not re-read the agreements on every render.
  const pbiKey = useMemo(() => [...new Set(selectedPbiIds)].sort().join(','), [selectedPbiIds]);

  useEffect(() => {
    let cancelled = false;
    // Read through a call rather than the variable directly: the flag is only ever set by the
    // cleanup below, so both the reader and the type checker need the read to be opaque.
    const isCancelled = (): boolean => cancelled;

    const load = async (): Promise<void> => {
      if (!teamId) {
        setReadiness(READY);
        return;
      }

      setReadiness((previous) => ({ ...previous, isLoading: true }));

      try {
        const [dodResponse, dorResponse] = await Promise.all([
          definitionService.getDefinitionOfDone(teamId),
          definitionService.getDefinitionOfReady(teamId),
        ]);

        if (isCancelled()) return;

        const activeDoDItemCount = (dodResponse.data?.items ?? []).filter(
          (item) => item.isActive
        ).length;
        const activeDoRItemIds = (dorResponse.data?.items ?? [])
          .filter((item) => item.isActive)
          .map((item) => item.id);

        const pbiIds = pbiKey.length > 0 ? pbiKey.split(',') : [];
        let unreadyPbiIds: string[] = [];

        // Readiness verifications are per item, so this is one read per selected item — and only
        // when the team actually has an agreement to check against.
        if (activeDoRItemIds.length > 0 && pbiIds.length > 0) {
          const verifiedByPbi = await Promise.all(
            pbiIds.map(async (pbiId) => {
              const response = await definitionService.getDoRVerificationsForPBI(pbiId);
              const verifiedIds = new Set(
                (response.data ?? []).filter((entry) => entry.isVerified).map((e) => e.dorItemId)
              );
              return { pbiId, verifiedIds };
            })
          );

          if (isCancelled()) return;

          unreadyPbiIds = verifiedByPbi
            .filter(({ verifiedIds }) => activeDoRItemIds.some((id) => !verifiedIds.has(id)))
            .map(({ pbiId }) => pbiId);
        }

        setReadiness({
          hasDefinitionOfDone: activeDoDItemCount > 0,
          activeReadinessItemCount: activeDoRItemIds.length,
          unreadyPbiIds,
          isLoading: false,
        });
      } catch (error) {
        logger.error('Failed to read the Sprint boundary commitments', undefined, { error });
        // Fail open: the server still refuses what it must, and its gate code carries the reason.
        if (!isCancelled()) {
          setReadiness(READY);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [teamId, pbiKey]);

  return readiness;
};
