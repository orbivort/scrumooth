import { API_BASE_URL } from '@/services/core/api.core';

/**
 * The sign-in cards, fetched from the mock backend rather than imported.
 *
 * The catalogue is mock data, so it is served by the mock backend like every
 * other piece of data and never imported into application code. That is not
 * pedantry: importing it — even behind a flag the bundler can fold — left the
 * persona names, the team names and the published demo password inside the
 * production bundle. Fetching it means the app ships none of it, by construction,
 * and the panel simply shows nothing when no endpoint answers.
 *
 * Every card stands for one *role in one team*, which is why the same person can
 * appear twice: one person is the Product Owner of one team and the Scrum Master
 * of the other, and signing in through either card has to produce the matching
 * permissions.
 */

/** The three roles the Scrum Guide defines, in the casing the API uses. */
export type PersonaRole = 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS';

export interface PersonaCard {
  /** Unique per card, not per person. */
  key: string;
  /** The team the card signs the visitor into. */
  teamId: string;
  /** The credentials the card signs in with. */
  email: string;
  firstName: string;
  lastName: string;
  role: PersonaRole;
  /** The team the card belongs to, shown on the card and as its group label. */
  teamName: string;
}

export interface PersonaCatalogue {
  /** The password every demo persona shares, published by the mock backend. */
  password: string;
  cards: PersonaCard[];
}

/** `GET /auth/demo-personas` — only answered while mock mode is on. */
export async function fetchPersonaCatalogue(): Promise<PersonaCatalogue> {
  const url = new URL(`${API_BASE_URL}/auth/demo-personas`, location.origin).href;
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    throw new Error(`The demo persona catalogue is unavailable (${response.status})`);
  }

  const payload = (await response.json()) as {
    success: boolean;
    data?: PersonaCatalogue;
  };

  if (!payload.success || !payload.data) {
    throw new Error('The demo persona catalogue is unavailable');
  }

  return payload.data;
}

/** `'Mira Quoril'` — the name on the card. */
export function cardFullName(card: PersonaCard): string {
  return `${card.firstName} ${card.lastName}`;
}

/** `'MQ'` — shown in the avatar the way the rest of the product shows people. */
export function cardInitials(card: PersonaCard): string {
  return `${card.firstName.charAt(0)}${card.lastName.charAt(0)}`.toUpperCase();
}

/** The cards grouped by team, so the panel can label each group. */
export function groupCardsByTeam(cards: PersonaCard[]): Array<{
  teamId: string;
  teamName: string;
  cards: PersonaCard[];
}> {
  const groups = new Map<string, { teamId: string; teamName: string; cards: PersonaCard[] }>();

  for (const card of cards) {
    const group = groups.get(card.teamId) ?? {
      teamId: card.teamId,
      teamName: card.teamName,
      cards: [],
    };
    group.cards.push(card);
    groups.set(card.teamId, group);
  }

  return [...groups.values()];
}
