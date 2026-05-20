export type { ItemEntry, ItemMatch, KeywordHit } from './types';
export { EMOJI } from './emoji';
export type { StoreEntry, StoreMatch } from './stores';
export { STORES, matchStore } from './stores';

import { FOOD_ITEMS } from './food';
import { HOME_ITEMS } from './home';
import { TRANSPORT_ITEMS } from './transport';
import { HEALTH_ITEMS } from './health';
import { SHOPPING_ITEMS } from './shopping';
import { SERVICES_ITEMS } from './services';
import type { ItemEntry, ItemMatch } from './types';

export const ITEMS: Record<string, ItemEntry> = {
  ...FOOD_ITEMS,
  ...HOME_ITEMS,
  ...TRANSPORT_ITEMS,
  ...HEALTH_ITEMS,
  ...SHOPPING_ITEMS,
  ...SERVICES_ITEMS,
};

const _sorted = Object.entries(ITEMS).sort((a, b) => b[0].length - a[0].length);

function matchesWord(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'iu').test(text);
}

export function matchItem(text: string): ItemMatch | null {
  for (const [kw, hit] of _sorted) {
    if (matchesWord(text, kw)) {
      return { categoryId: hit.categoryId, keyword: kw };
    }
  }
  return null;
}
