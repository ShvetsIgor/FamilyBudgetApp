import type { RecurringType } from '@/shared/types';

/**
 * The category each recurring kind maps to.
 *
 * Kind and category are ONE choice, not two: the «Recurring» preset folder
 * holds a category per kind, so tapping «Rent» in the form both sets the kind
 * and files the money. They are ordinary library entries — rename, delete or
 * add your own, and the form's picker still lets any other category be used.
 *
 * (An earlier pass routed kinds into semantic folders instead — rent into
 * Home/Rent. It kept analytics tidy but meant answering the same question
 * twice, which is what this replaces.)
 */
export interface ImpliedCategory {
  /** Preset category id (stable, doubles as the Firestore doc id) */
  categoryId: string;
  /** Preset folder the category lives in, needed when materializing it */
  folderId: string;
}

const RECURRING_FOLDER = 'recurring';

export const RECURRING_TYPE_CATEGORY: Record<RecurringType, ImpliedCategory> = {
  subscription: { categoryId: 'rec_subscription', folderId: RECURRING_FOLDER },
  rent: { categoryId: 'rec_rent', folderId: RECURRING_FOLDER },
  utility: { categoryId: 'rec_utility', folderId: RECURRING_FOLDER },
  credit: { categoryId: 'rec_credit', folderId: RECURRING_FOLDER },
  mortgage: { categoryId: 'rec_mortgage', folderId: RECURRING_FOLDER },
  installment: { categoryId: 'rec_installment', folderId: RECURRING_FOLDER },
  custom: { categoryId: 'rec_other', folderId: RECURRING_FOLDER },
};

export function impliedCategoryFor(type: RecurringType): ImpliedCategory | null {
  return RECURRING_TYPE_CATEGORY[type] ?? null;
}

/** The kind whose category this is, if any — used to light up the right chip. */
export function typeForCategoryId(categoryId: string): RecurringType | null {
  const found = Object.entries(RECURRING_TYPE_CATEGORY)
    .find(([, implied]) => implied.categoryId === categoryId);
  return found ? (found[0] as RecurringType) : null;
}
