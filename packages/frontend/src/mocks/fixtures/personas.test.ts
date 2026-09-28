import { describe, it, expect } from 'vitest';

import { FICTIONAL_DOMAIN, FAMILY_NAME_PARTS, PEOPLE_SEEDS, PERSONA_SEEDS } from './personas';

/**
 * Keeps the demo universe's fiction auditable.
 *
 * `personas.ts` promises that every family name is composed from
 * `FAMILY_NAME_PARTS` rather than borrowed from a real person. A promise like
 * that is worth nothing unless something checks it, so this is the check: a
 * surname pasted in from somewhere else fails here, and the fix is to add a root
 * to the inventory on purpose rather than to widen the assertion.
 *
 * The last case is the one with teeth in the other direction. The seeds are
 * free to grow a person, but a sign-in card pointing at an id that no longer
 * exists would render a blank name on the login page, which is how the surname
 * and id edits behind this file could quietly break the panel.
 */
describe('the demo universe names', () => {
  const composition = new RegExp(
    `^(${FAMILY_NAME_PARTS.roots.join('|')})(${FAMILY_NAME_PARTS.endings.join('|')})$`
  );

  it('builds every family name out of the closed inventory', () => {
    for (const person of PEOPLE_SEEDS) {
      expect(person.lastName, `${person.firstName} ${person.lastName}`).toMatch(composition);
    }
  });

  it('gives every person a family name from a root of their own', () => {
    const roots = PEOPLE_SEEDS.map((person) => person.lastName.replace(composition, '$1'));

    expect(new Set(roots).size).toBe(PEOPLE_SEEDS.length);
  });

  it('derives every email from the person’s own name on the reserved domain', () => {
    for (const person of PEOPLE_SEEDS) {
      const derived = `${person.firstName}.${person.lastName}@${FICTIONAL_DOMAIN}`.toLowerCase();

      expect(person.email, `${person.firstName} ${person.lastName}`).toBe(derived);
    }
  });

  it('keeps the initials within a team unique, so no avatar is ambiguous', () => {
    const initialsByTeam = new Map<string, string[]>();

    for (const persona of PERSONA_SEEDS) {
      const person = PEOPLE_SEEDS.find((candidate) => candidate.id === persona.userId);
      const pooled = initialsByTeam.get(persona.teamId) ?? [];
      pooled.push(`${person?.firstName.charAt(0) ?? ''}${person?.lastName.charAt(0) ?? ''}`);
      initialsByTeam.set(persona.teamId, pooled);
    }

    for (const [teamId, initials] of initialsByTeam) {
      expect(new Set(initials).size, teamId).toBe(initials.length);
    }
  });

  it('signs every card in as an account that exists in the universe', () => {
    const ids = new Set(PEOPLE_SEEDS.map((person) => person.id));

    for (const persona of PERSONA_SEEDS) {
      expect(ids.has(persona.userId), persona.key).toBe(true);
    }
  });
});
