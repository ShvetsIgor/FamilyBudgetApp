import {
  FOLDER_BLUEPRINTS,
  CATEGORY_BLUEPRINTS,
} from '../preset/categoryPresets';

/**
 * Flat map: preset stable slug → { name, ru }.
 * Used for display name resolution of preset IDs stored in Firestore.
 * Built once from explicit flat blueprints — no nested traversal.
 */
export const CATEGORY_ALIAS_MAP: ReadonlyMap<string, { name: string; ru?: string }> = new Map([
  ...FOLDER_BLUEPRINTS.map((f) => [f.id, { name: f.name, ru: f.ru }] as const),
  ...CATEGORY_BLUEPRINTS.map((c) => [c.id, { name: c.name, ru: c.ru }] as const),
]);

/**
 * Returns the localized display name for a preset stable slug.
 * Returns null for unknown IDs — callers should fall back to category.name.
 */
export function getPresetDisplayName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}
