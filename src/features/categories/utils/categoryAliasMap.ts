import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

interface AliasEntry { name: string; ru?: string }

function buildAliasMap(): Map<string, AliasEntry> {
  const map = new Map<string, AliasEntry>();
  for (const entry of [...TAXONOMY, INCOME_TAXONOMY as (typeof TAXONOMY)[0]]) {
    map.set(entry.id, { name: entry.name, ru: entry.ru });
    for (const sub of entry.subs ?? []) {
      map.set(sub.id, { name: sub.name, ru: sub.ru });
    }
  }
  return map;
}

/**
 * Flat map of taxonomy stable slug → { name, ru }.
 * Built once at module load from TAXONOMY. All runtime lookups use this map —
 * no hierarchy traversal at runtime.
 */
export const CATEGORY_ALIAS_MAP: Map<string, AliasEntry> = buildAliasMap();

/**
 * Returns the taxonomy display name for a stable slug in the given language.
 * Returns null if the slug is not a known taxonomy entry (e.g. custom user category).
 */
export function getTaxonomyName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}
