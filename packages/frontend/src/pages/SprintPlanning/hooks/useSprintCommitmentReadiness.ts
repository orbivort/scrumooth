// What the Sprint boundary requires of a team's two agreements, as the interface can see them.
//
// This is a *hint*, not the gate. The service layer decides -- `saveSprintBacklog` and `startSprint`
// refuse with `GATE_DOD_REQUIRED`, `GATE_DOR_REQUIRED` or `GATE_DOR_NOT_VERIFIED` -- and this hook
// exists so the interface can explain the refusal before the user submits, instead of surfacing it as
// a failure afterwards.
//
// It reads through the same query keys the Definition tab uses, so the two surfaces share one cached
// read of one agreement instead of fetching the same rows twice. That is not only an optimisation:
// two private readers of one commitment are how a boundary hint and the commitment it describes come
// to disagree about the version in force.
//
// It deliberately fails open. A read error must never disable the action, because the server is still
// the authority and a client-side glitch is not a process blocker.
import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { definitionService } from '@/services';
import { queryKeys } from '@/hooks/queryKeys';
import { logger } from '@/utils/logger';

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
 * Agreements change a handful of times per product, so a short cache removes the refetch without ever
 * showing a version that has moved on for long. Verifications change far more often -- a team records
 * them as it refines -- so they are cached for much less.
 */
const AGREEMENT_STALE_TIME = 60 * 1000;
const VERIFICATION_STALE_TIME = 15 * 1000;

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
  // Keyed off the *set* of items, so re-renders that hand back an equal selection (a new array each
  // time) do not start a new read on every render.
  const pbiIds = useMemo(() => [...new Set(selectedPbiIds)].sort(), [selectedPbiIds]);

  const dodQuery = useQuery({
    queryKey: queryKeys.definitionOfDone.byTeam(teamId ?? ''),
    queryFn: () => definitionService.getDefinitionOfDone(teamId as string),
    enabled: !!teamId,
    staleTime: AGREEMENT_STALE_TIME,
  });

  const dorQuery = useQuery({
    queryKey: queryKeys.definitionOfReady.byTeam(teamId ?? ''),
    queryFn: () => definitionService.getDefinitionOfReady(teamId as string),
    enabled: !!teamId,
    staleTime: AGREEMENT_STALE_TIME,
  });

  const activeDoDItemCount = (dodQuery.data?.data?.items ?? []).filter(
    (item) => item.isActive
  ).length;

  const activeDoRItemIds = useMemo(
    () => (dorQuery.data?.data?.items ?? []).filter((item) => item.isActive).map((item) => item.id),
    [dorQuery.data]
  );

  // One read per selected item -- and only when the team actually has an agreement to check against.
  // A team with no readiness criterion has nothing to verify, and the boundary treats it as
  // unconfigured rather than as ready.
  const verificationQueries = useQueries({
    queries: pbiIds.map((pbiId) => ({
      queryKey: queryKeys.definitionOfReady.verifications(pbiId),
      queryFn: () => definitionService.getDoRVerificationsForPBI(pbiId),
      enabled: !!teamId && activeDoRItemIds.length > 0,
      staleTime: VERIFICATION_STALE_TIME,
    })),
  });

  const agreementsFailed = !!teamId && (dodQuery.isError || dorQuery.isError);
  const verificationsFailed = verificationQueries.some((query) => query.isError);

  // Reported once per settled failure rather than on every render: a hint that fails is still worth
  // knowing about, and a render loop of identical log lines is not.
  useEffect(() => {
    if (agreementsFailed || verificationsFailed) {
      logger.error('Failed to read the Sprint boundary commitments', undefined, {
        teamId,
        agreementsFailed,
        verificationsFailed,
      });
    }
  }, [agreementsFailed, verificationsFailed, teamId]);

  const isLoading =
    !!teamId &&
    (dodQuery.isLoading ||
      dorQuery.isLoading ||
      verificationQueries.some((query) => query.isLoading));

  // Fail open: the server still refuses what it must, and its gate code carries the reason.
  if (!teamId || agreementsFailed || verificationsFailed) {
    return { ...READY, isLoading };
  }

  const unreadyPbiIds =
    activeDoRItemIds.length > 0
      ? pbiIds.filter((_pbiId, index) => {
          const verifiedIds = new Set(
            (verificationQueries[index]?.data?.data ?? [])
              .filter((entry) => entry.isVerified)
              .map((entry) => entry.dorItemId)
          );

          return activeDoRItemIds.some((id) => !verifiedIds.has(id));
        })
      : [];

  return {
    hasDefinitionOfDone: activeDoDItemCount > 0,
    activeReadinessItemCount: activeDoRItemIds.length,
    unreadyPbiIds,
    isLoading,
  };
};
