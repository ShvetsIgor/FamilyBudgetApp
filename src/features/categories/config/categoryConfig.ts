/**
 * Runtime configuration for the categories feature.
 *
 * This is the single boundary between preset/seed data and runtime code.
 * Runtime modules (selectors, utils, components) import from here — never
 * directly from the preset module.
 *
 * Preset modules (categoryPresets, useConstructorState, defaultCategories)
 * keep their own preset imports for onboarding/seeding purposes.
 */
import {
  FOLDER_BLUEPRINTS,
  CATEGORY_BLUEPRINTS,
  type FolderBlueprint,
} from '../preset/categoryPresets';

export type { FolderBlueprint };

// ─── Library folders ──────────────────────────────────────────────────────────

/**
 * All preset folder definitions available in the "add from library" flow.
 * Selectors filter this list against store state to show unactivated folders.
 * Expense folders: all entries where id !== 'income'.
 * Income folder:   the single entry where id === 'income'.
 */
export const LIBRARY_FOLDERS: readonly FolderBlueprint[] = FOLDER_BLUEPRINTS;

// ─── Display name map ─────────────────────────────────────────────────────────

/**
 * Flat map: preset stable slug → { name, ru }.
 * Used for display name resolution of preset IDs stored in Firestore.
 * Built once from the explicit flat blueprints — no nested traversal.
 */
export const CATEGORY_ALIAS_MAP: ReadonlyMap<string, { name: string; ru?: string }> = new Map([
  ...FOLDER_BLUEPRINTS.map((f) => [f.id, { name: f.name, ru: f.ru }] as const),
  ...CATEGORY_BLUEPRINTS.map((c) => [c.id, { name: c.name, ru: c.ru }] as const),
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the localized display name for a preset stable slug.
 * Returns null for unknown IDs — callers should fall back to category.name.
 */
export function getPresetDisplayName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}
