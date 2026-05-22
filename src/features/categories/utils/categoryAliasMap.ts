import {
  FOLDER_BLUEPRINTS,
  CATEGORY_BLUEPRINTS,
  type FolderBlueprint,
  type CategoryBlueprint,
} from '../preset/categoryPresets';

// Re-export types and blueprints so existing consumers don't need import-path changes.
export type { FolderBlueprint, CategoryBlueprint };
export { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS };

// ─── Alias map ────────────────────────────────────────────────────────────────

/**
 * Flat map: preset stable slug → { name, ru }.
 * Used for legacy Firestore ID resolution and display name lookups.
 * Built in one linear pass — no nested traversal.
 */
export const CATEGORY_ALIAS_MAP: ReadonlyMap<string, { name: string; ru?: string }> = new Map([
  ...FOLDER_BLUEPRINTS.map((f) => [f.id, { name: f.name, ru: f.ru }] as const),
  ...CATEGORY_BLUEPRINTS.map((c) => [c.id, { name: c.name, ru: c.ru }] as const),
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the preset display name for a stable slug in the given language.
 * Returns null for unknown slugs (custom user categories — use category.name instead).
 */
export function getPresetDisplayName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}

/**
 * Returns the preset category blueprints for a given folder slug.
 * Used when activating a library folder (creates its default categories).
 */
export function getTaxonomySubs(folderId: string): CategoryBlueprint[] {
  return CATEGORY_BLUEPRINTS.filter((c) => c.folderId === folderId);
}
