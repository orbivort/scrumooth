// What a criterion says, in the reader's language.
//
// A built-in criterion is shown from its key, so a team may reword "Code is properly documented" and
// still read it in German, Spanish, French or Italian. The key is what the row carries; the sentence
// is only its English wording.
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

/** The criterion's wording in the reader's language, or its own text when it is not a built-in one. */
export function criterionLabel(
  t: TFunction<'settings'>,
  scope: DefinitionType,
  criterion: LabelledCriterion
): string {
  const seeded = criterion.defaultKey
    ? findDefaultByKey(scope, criterion.defaultKey)
    : findDefaultByDescription(scope, criterion.description);

  return seeded ? t(seeded.i18nKey as never) : criterion.description;
}
