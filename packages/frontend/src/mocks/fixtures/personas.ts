import { fixtureId } from '../support/ids';

/**
 * The root of the demo universe: who exists, which teams they belong to, and the
 * role each of them holds in each team.
 *
 * Everything else in `fixtures/` derives from here, and this module imports only
 * the id helper. That keeps it cheap to load on its own, which matters because
 * the login page's persona panel reads the sign-in catalogue without pulling the
 * rest of the seed into the bundle.
 *
 * Only what the interface reads lives here. A field nothing renders or resolves
 * against is not "extra demo detail" — it is a second thing to keep true when the
 * interface changes, so none is carried.
 *
 * Everything here is invented. The people and the teams do not exist, and every
 * address sits on `example.com` — the domain RFC 2606 reserves for documentation —
 * so nothing can be mistaken for a real person or company, or for a real
 * customer's data. Family names are not borrowed from anywhere at all: each one is
 * composed from `FAMILY_NAME_PARTS` below, which puts the fabrication in the data
 * instead of leaving it to be taken on trust from this comment.
 */

/** RFC 2606 reserves this domain for examples; no mail can be delivered to it. */
export const FICTIONAL_DOMAIN = 'example.com';

/**
 * The password every demo persona signs in with.
 *
 * Not a secret: it is published in the login panel, it exists only in a browser
 * build with no server behind it, and it never reaches a real deployment because
 * mock mode cannot be enabled in a production build.
 */
export const DEMO_PASSWORD = 'scrum-guide-2020';

/** The roles the Scrum Guide defines, in the casing the API returns. */
export type ApiRole = 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS';

/** Short handle for a team, used to key the rest of the seed against it. */
export type TeamKey = 'cindra' | 'pell';

export interface TeamSeed {
  id: string;
  key: TeamKey;
  /** The team's name, as the switcher shows it. */
  name: string;
  /** One line on what the team exists to deliver; the team's description. */
  purpose: string;
}

export interface PersonSeed {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface MembershipSeed {
  userId: string;
  teamId: string;
  role: ApiRole;
}

/**
 * A one-click sign-in option offered on the login page.
 *
 * This is the whole of what a card needs: who it signs in, which team it lands
 * in, the role that team gives them, and a key that tells one person's two cards
 * apart. Role copy — the label and the line explaining what the role owns — is
 * interface text, so it lives in the translations, not in the data.
 */
export interface PersonaSeed {
  /** Stable key for the card, unique even when one person holds two roles. */
  key: string;
  userId: string;
  /** The team the card signs the visitor into. */
  teamId: string;
  /** The role the person holds *in that team*; may differ from their other card. */
  role: ApiRole;
}

export const TEAM_SEEDS: readonly TeamSeed[] = [
  {
    id: fixtureId('team', 'cindra'),
    key: 'cindra',
    name: 'Team Cindra',
    purpose: 'Schedules rail freight across the northern corridor.',
  },
  {
    id: fixtureId('team', 'pell'),
    key: 'pell',
    name: 'Team Pell',
    purpose: 'Plans depot capacity for the southern region.',
  },
];

/**
 * The closed morpheme inventory every family name is composed from.
 *
 * A family name is a root with an ending, both taken from these two lists. That
 * is what holds the demo's fiction up: nothing here is borrowed from a real
 * surname, place or word, so a reader who parses `Orv` + `ane` sees a name that
 * was built rather than found. Adding a persona means adding a root here — which
 * `personas.test.ts` enforces — instead of pasting in a name that already belongs
 * to somebody.
 *
 * The endings repeat across the set deliberately: three people end in `-ane`,
 * three in `-eth` and two in `-il`, so the construction is legible from the seed
 * list alone and not only from this comment.
 */
export const FAMILY_NAME_PARTS = {
  roots: ['Orv', 'Vel', 'Quor', 'Nym', 'Var', 'Morv', 'Pelv', 'Farv'],
  endings: ['ane', 'eth', 'il'],
} as const;

/**
 * Everyone in the universe.
 *
 * Each family name is one of the `FAMILY_NAME_PARTS` roots carrying one of its
 * endings — `kade-orvane` is `Orv` + `ane` — so no card, avatar or assignee can
 * carry a name that is somebody's. Given names stay ordinary on purpose: on its
 * own one identifies nobody, and the demo reads better for it. It is the composed
 * surname that makes the whole name unmistakably invented.
 *
 * Within a team the initials are unique (Cindra: KO/TV/MQ, Pell: AV/KO/RM), so an
 * avatar never has to be disambiguated. `KO` appears in both teams because it is
 * one person holding a role in each — the case the panel exists to demonstrate.
 *
 * The slug, the id derived from it, and the email all follow the composed name,
 * so the three cannot drift apart.
 */
export const PEOPLE_SEEDS: readonly PersonSeed[] = [
  {
    id: fixtureId('user', 'kade-orvane'),
    firstName: 'Kade',
    lastName: 'Orvane',
    email: `kade.orvane@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'tobin-veleth'),
    firstName: 'Tobin',
    lastName: 'Veleth',
    email: `tobin.veleth@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'mira-quoril'),
    firstName: 'Mira',
    lastName: 'Quoril',
    email: `mira.quoril@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'sera-nymeth'),
    firstName: 'Sera',
    lastName: 'Nymeth',
    email: `sera.nymeth@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'ansel-vareth'),
    firstName: 'Ansel',
    lastName: 'Vareth',
    email: `ansel.vareth@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'rhea-morvane'),
    firstName: 'Rhea',
    lastName: 'Morvane',
    email: `rhea.morvane@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'ivo-pelvane'),
    firstName: 'Ivo',
    lastName: 'Pelvane',
    email: `ivo.pelvane@${FICTIONAL_DOMAIN}`,
  },
  {
    id: fixtureId('user', 'lune-farvil'),
    firstName: 'Lune',
    lastName: 'Farvil',
    email: `lune.farvil@${FICTIONAL_DOMAIN}`,
  },
];

const [cindra, pell] = TEAM_SEEDS;
const [kade, tobin, mira, sera, ansel, rhea, ivo, lune] = PEOPLE_SEEDS;

if (!cindra || !pell || !kade || !tobin || !mira || !sera || !ansel || !rhea || !ivo || !lune) {
  throw new Error('The demo universe seed is incomplete');
}

/**
 * The role matrix.
 *
 * Each team keeps one Product Owner, one Scrum Master and its Developers, and
 * `kade-orvane` deliberately holds a *different* role in each team: Product Owner
 * on Cindra, Scrum Master on Pell. That is the case the interface must get right
 * — the same person, two teams, two sets of permissions — so every role-dependent
 * affordance can be exercised by switching team rather than by editing fixtures.
 */
export const MEMBERSHIP_SEEDS: readonly MembershipSeed[] = [
  { userId: kade.id, teamId: cindra.id, role: 'PRODUCT_OWNER' },
  { userId: tobin.id, teamId: cindra.id, role: 'SCRUM_MASTER' },
  { userId: mira.id, teamId: cindra.id, role: 'DEVELOPERS' },
  { userId: sera.id, teamId: cindra.id, role: 'DEVELOPERS' },

  { userId: ansel.id, teamId: pell.id, role: 'PRODUCT_OWNER' },
  { userId: kade.id, teamId: pell.id, role: 'SCRUM_MASTER' },
  { userId: rhea.id, teamId: pell.id, role: 'DEVELOPERS' },
  { userId: ivo.id, teamId: pell.id, role: 'DEVELOPERS' },
  { userId: lune.id, teamId: pell.id, role: 'DEVELOPERS' },
];

/**
 * The sign-in catalogue for the login page, ordered the way the panel shows it:
 * Cindra's three roles first, then Pell's, so the two cards belonging to Kade
 * Orvane sit in different groups and the role difference is visible at a glance.
 *
 * One card per role per team is the whole of what the panel needs. A team's other
 * Developers hold the same role in the same team, so a card for each of them would
 * sign in with the same permissions, against the same team, and exercise nothing
 * the first one does not. They stay in the universe as team members; they are just
 * not sign-in options.
 */
export const PERSONA_SEEDS: readonly PersonaSeed[] = [
  {
    key: 'cindra-po',
    userId: kade.id,
    teamId: cindra.id,
    role: 'PRODUCT_OWNER',
  },
  {
    key: 'cindra-sm',
    userId: tobin.id,
    teamId: cindra.id,
    role: 'SCRUM_MASTER',
  },
  {
    key: 'cindra-dev',
    userId: mira.id,
    teamId: cindra.id,
    role: 'DEVELOPERS',
  },
  {
    key: 'pell-po',
    userId: ansel.id,
    teamId: pell.id,
    role: 'PRODUCT_OWNER',
  },
  {
    key: 'pell-sm',
    userId: kade.id,
    teamId: pell.id,
    role: 'SCRUM_MASTER',
  },
  {
    key: 'pell-dev',
    userId: rhea.id,
    teamId: pell.id,
    role: 'DEVELOPERS',
  },
];

/** The seeded team carrying a given handle. */
export function teamSeed(key: TeamKey): TeamSeed {
  const seed = TEAM_SEEDS.find((team) => team.key === key);
  if (!seed) {
    throw new Error(`Unknown demo team: ${key}`);
  }
  return seed;
}

/** The id of the seeded team carrying a given handle. */
export function teamId(key: TeamKey): string {
  return teamSeed(key).id;
}
