import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

/**
 * Flat map: preset stable slug → { name, ru }.
 * Built in one linear pass from the explicit flat blueprints.
 * Used for display name resolution of known preset IDs stored in Firestore.
 */
export const CATEGORY_ALIAS_MAP: ReadonlyMap<string, { name: string; ru?: string }> = new Map([
  ...FOLDER_BLUEPRINTS.map((f) => [f.id, { name: f.name, ru: f.ru }] as const),
  ...CATEGORY_BLUEPRINTS.map((c) => [c.id, { name: c.name, ru: c.ru }] as const),
]);

/**
 * Returns the preset display name for a stable slug in the given language.
 * Returns null for unknown slugs (custom user categories — use category.name instead).
 */
export function getPresetDisplayName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}
