// The definition surface used to live in Settings, as "Team Definitions" with a Definition of Ready
// and a Definition of Done tab. Both are the team's own agreements, so they now live where the team
// is -- the Definition tab of the Team module -- and the addresses that were published keep working,
// the same treatment the working-agreements route received when it became a tab.
//
// A retired address that named a tab names the section that replaced it, so a bookmark lands on the
// agreement it meant rather than at the top of a page it has to search.
import React from 'react';
import { Navigate, useLocation } from 'react-router';

/** The retired `?tab=` values, mapped to the section of the Definition tab each one meant. */
const SECTION_BY_RETIRED_TAB: Readonly<Record<string, string>> = {
  dor: 'definition-of-ready',
  dod: 'definition-of-done',
};

interface LegacyDefinitionRedirectProps {
  /**
   * The DOM id of the section this retired address meant, when the address itself named one.
   *
   * Named `id` because that is what it is: an anchor, not copy. An address with no section of its own
   * resolves from the tab it used to point at instead.
   */
  id?: string;
}

export const LegacyDefinitionRedirect: React.FC<LegacyDefinitionRedirectProps> = ({ id }) => {
  const { search } = useLocation();
  const retiredTab = new URLSearchParams(search).get('tab');
  const sectionId = id ?? (retiredTab ? SECTION_BY_RETIRED_TAB[retiredTab] : undefined);

  return (
    <Navigate
      to={sectionId ? `/team?tab=definition#${sectionId}` : '/team?tab=definition'}
      replace
    />
  );
};

export default LegacyDefinitionRedirect;
