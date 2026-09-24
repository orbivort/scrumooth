// The version history of the agreements a team holds itself to.
//
// The Definition of Done and the Definition of Ready each keep every superseded version, and the
// product displayed only the number in force. A claim about append-only history that no surface can
// reach is a claim, not a record -- so these reads exist to make the badge on each agreement open
// what it names.
//
// Both reads are gated by `enabled`, and every caller passes the popover's open state: a page load
// never pays for a history nobody asked to see.
import { useQuery } from '@tanstack/react-query';

import { definitionService } from '../services';

import { queryKeys } from './queryKeys';

/**
 * Versions of an agreement that changes a handful of times per product, so a five-minute cache
 * removes the refetch without ever showing a superseded version as current for long.
 */
const HISTORY_STALE_TIME = 5 * 60 * 1000;

/** The appended versions of the team's effective Definition of Done, newest first. */
export const useDefinitionOfDoneHistory = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.definitionOfDone.history(teamId ?? ''),
    queryFn: () => definitionService.getDoDHistory(teamId as string),
    enabled: !!teamId && enabled,
    staleTime: HISTORY_STALE_TIME,
  });

/** The appended versions of the team's Definition of Ready, newest first. */
export const useDefinitionOfReadyHistory = (teamId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.definitionOfReady.history(teamId ?? ''),
    queryFn: () => definitionService.getDoRHistory(teamId as string),
    enabled: !!teamId && enabled,
    staleTime: HISTORY_STALE_TIME,
  });
