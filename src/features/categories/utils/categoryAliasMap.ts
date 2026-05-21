import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AliasEntry { name: string; ru?: string }

export interface TaxSub { id: string; name: string; ru?: string; icon: string }

/** Top-level TAXONOMY entry — becomes a CategoryFolder in the app. */
export interface FolderBlueprint {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
}

/** Sub-level TAXONOMY entry — becomes a flat Category with folderId. */
export interface CategoryBlueprint {
  id: string;
  folderId: string;
  name: string;
  ru?: string;
  icon: string;
  /** Color inherited from the parent FolderBlueprint. */
  color: string;
}

// ─── Build flat structures (once at module load) ──────────────────────────────
// TAXONOMY is ONLY accessed here. All consumers get flat arrays / Maps.

function buildAll() {
  const aliasMap = new Map<string, AliasEntry>();
  const subsMap = new Map<string, TaxSub[]>();
  const folderBlueprints: FolderBlueprint[] = [];
  const categoryBlueprints: CategoryBlueprint[] = [];

  for (const entry of [...TAXONOMY, INCOME_TAXONOMY as (typeof TAXONOMY)[0]]) {
    aliasMap.set(entry.id, { name: entry.name, ru: entry.ru });
    folderBlueprints.push({ id: entry.id, name: entry.name, ru: entry.ru, icon: entry.icon, color: entry.color });

    const subs = (entry.subs ?? []) as TaxSub[];
    subsMap.set(entry.id, subs);
    for (const sub of subs) {
      aliasMap.set(sub.id, { name: sub.name, ru: sub.ru });
      categoryBlueprints.push({
        id: sub.id,
        folderId: entry.id,
        name: sub.name,
        ru: sub.ru,
        icon: sub.icon,
        color: entry.color,
      });
    }
  }

  return { aliasMap, subsMap, folderBlueprints, categoryBlueprints };
}

const { aliasMap, subsMap, folderBlueprints, categoryBlueprints } = buildAll();

// ─── Flat lookup maps ─────────────────────────────────────────────────────────

/**
 * Flat map: taxonomy stable slug → { name, ru }.
 * Used for legacy Firestore ID resolution and display name lookups.
 */
export const CATEGORY_ALIAS_MAP: Map<string, AliasEntry> = aliasMap;

// ─── Blueprint arrays ─────────────────────────────────────────────────────────

/**
 * All taxonomy folder blueprints (one per TAXONOMY top-level entry).
 * Consumed by: constructor wizard, default category seeding.
 * INCOME_TAXONOMY is last — filter by `f.id !== 'income'` for expense-only flows.
 */
export const FOLDER_BLUEPRINTS: readonly FolderBlueprint[] = folderBlueprints;

/**
 * All taxonomy category blueprints — flat, each with folderId and inherited color.
 * Consumed by: constructor wizard, default category seeding.
 * Filter by `c.folderId !== 'income'` for expense-only flows.
 */
export const CATEGORY_BLUEPRINTS: readonly CategoryBlueprint[] = categoryBlueprints;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the taxonomy display name for a stable slug in the given language.
 * Returns null for unknown slugs (e.g. custom user categories — use category.name).
 */
export function getTaxonomyName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}

/**
 * Returns the default sub-category list for a taxonomy folder slug.
 * Used in CategoryEditorSheet wizard (constructor/onboarding UI).
 */
export function getTaxonomySubs(folderId: string): TaxSub[] | undefined {
  return subsMap.get(folderId);
}
