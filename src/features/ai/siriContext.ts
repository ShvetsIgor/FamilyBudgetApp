import 'server-only';
import type { Category, CategoryFolder, Currency, Language } from '@/shared/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import { PARSER_CURRENCIES } from './expenseParser/schema';

export interface SiriContext {
  currency: Currency;
  language: Language;
  categories: Category[];
  folders: CategoryFolder[];
}

export class SiriProfileError extends Error {
  constructor() { super('Siri requires a profile with supported currency and language.'); }
}

/** Read only the authenticated owner's data; never seed or activate presets. */
export async function loadSiriContext(uid: string): Promise<SiriContext> {
  const db = getAdminDb();
  const profile = (await db.doc(`users/${uid}`).get()).data();
  if (!profile || !PARSER_CURRENCIES.includes(profile.currency)
    || (profile.language !== 'en' && profile.language !== 'ru')) {
    throw new SiriProfileError();
  }

  const [categories, folders] = await Promise.all([
    db.collection(`categories/${uid}/expense`).orderBy('order').get(),
    db.collection(`categoryFolders/${uid}/expense`).orderBy('order').get(),
  ]);
  return {
    currency: profile.currency,
    language: profile.language,
    categories: categories.docs
      .map((item) => ({ ...item.data(), id: item.id, userId: uid } as Category))
      .filter((category) => category.type === 'expense' && isActiveCategory(category)),
    // Folders have no archived/active flag: the owner's stored folders are
    // the active collection. They remain context, never category candidates.
    folders: folders.docs
      .map((item) => ({ ...item.data(), id: item.id, userId: uid } as CategoryFolder))
      .filter((folder) => folder.type === 'expense'),
  };
}
