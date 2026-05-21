import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AliasEntry { name: string; ru?: string }

export interface TaxSub { id: string; name: string; ru?: string; icon: string }

// ─── Build flat maps (once at module load) ────────────────────────────────────

function buildMaps() {
  const aliasMap = new Map<string, AliasEntry>();
  const subsMap = new Map<string, TaxSub[]>();

  for (const entry of [...TAXONOMY, INCOME_TAXONOMY as (typeof TAXONOMY)[0]]) {
    aliasMap.set(entry.id, { name: entry.name, ru: entry.ru });
    const subs = (entry.subs ?? []) as TaxSub[];
    subsMap.set(entry.id, subs);
    for (const sub of subs) {
      aliasMap.set(sub.id, { name: sub.name, ru: sub.ru });
    }
  }

  return { aliasMap, subsMap };
}

const { aliasMap: CATEGORY_ALIAS_MAP_INTERNAL, subsMap: CATEGORY_SUBS_MAP } = buildMaps();

/**
 * Flat map: taxonomy stable slug → { name, ru }.
 * Built once at module load. Used for legacy Firestore ID resolution and display name lookups.
 * TAXONOMY is never traversed outside this module.
 */
export const CATEGORY_ALIAS_MAP: Map<string, AliasEntry> = CATEGORY_ALIAS_MAP_INTERNAL;

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the taxonomy display name for a stable slug in the given language.
 * Returns null if the slug is unknown (e.g. custom user category — use category.name instead).
 */
export function getTaxonomyName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}

/**
 * Returns the default subcategory list for a taxonomy folder slug.
 * Used in the category editor wizard (constructor/onboarding).
 * Returns undefined if the slug is not a top-level taxonomy folder.
 */
export function getTaxonomySubs(folderId: string): TaxSub[] | undefined {
  return CATEGORY_SUBS_MAP.get(folderId);
}
