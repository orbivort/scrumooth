// What a criterion says, in the reader's language.
//
// A built-in criterion is shown from its key *while it still says what the product seeded*. The row
// carries `defaultKey`, and the sentence stored beside it is the canonical English wording, so
// resolving the key is what lets a team read "Code is properly documented" in German, Spanish,
// French or Italian.
//
// The moment the team rewords a criterion, the sentence it wrote is the agreement and it wins. The
// service preserves `defaultKey` across an edit -- a client can never relabel a criterion it invented
// as a built-in one, and the row keeps recording which seed it descends from -- but there is nothing
// to translate in wording the team chose. Showing the seeded sentence in that case hides the very
// edit that was just saved, so a reworded criterion reads as though the save never happened.
//
// The fallback is for rows written before the key existed: those are matched to a seeded criterion by
// their sentence, which is what this surface used to do for *every* criterion -- and which silently
// stopped translating anything the moment a sentence was polished. It is kept only so an installation
// that upgraded still sees its old agreements translated, and it can be deleted once no stored row can
// lack a key.
import type { TFunction } from 'i18next';
import { findDefaultByDescription, findDefaultByKey } from '@scrumooth/shared';
import type { DefinitionType } from '@scrumooth/shared';

/** The minimum a criterion needs for its wording to be resolved. */
export interface LabelledCriterion {
  description: string;
  defaultKey?: string | null;
}

/**
 * The criterion's wording in the reader's language, or its own text when it is not a built-in one.
 *
 * A criterion that still reads as the seed is translated from its key; one the team has reworded is
 * shown exactly as the team wrote it, in every locale, because that sentence is the agreement.
 */
export function criterionLabel(
  t: TFunction<'settings'>,
  scope: DefinitionType,
  criterion: LabelledCriterion
): string {
  const seeded = criterion.defaultKey
    ? findDefaultByKey(scope, criterion.defaultKey)
    : findDefaultByDescription(scope, criterion.description);

  // No seed to resolve: either a row the seed list no longer names -- written before the key existed,
  // or holding a key that outlived its seed -- or a criterion the team wrote itself. Its own sentence
  // is all there is.
  if (!seeded) {
    return criterion.description;
  }

  // The seed decides the wording only while the row still says what the seed said. Comparing the
  // stored sentence rather than a "customised" flag is deliberate: there is one source of truth for
  // what the product seeded, and a row that was reworded and later restored to the seed reads as a
  // built-in criterion again -- which is what it now is.
  return criterion.description === seeded.description
    ? t(seeded.i18nKey as never)
    : criterion.description;
}
