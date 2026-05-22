/**
 * LAYER: runtime config — display label resolution.
 *
 * Responsibility: alias/display name resolution for UI rendering.
 * - Maps preset stable IDs → localized display names (en/ru).
 * - Used by UI components (CategoryRow, FolderSection) and resolveCategory.
 *
 * ── Architectural decision on label ownership ─────────────────────────────
 * CATEGORY_ALIAS_MAP is intentionally preset-derived, built once at module
 * initialization from FOLDER_BLUEPRINTS + CATEGORY_BLUEPRINTS.
 *
 * Rationale:
 * - Labels are immutable constants tied to stable preset IDs.
 * - Duplicating them as independent runtime config would mean two sources of
 *   truth for the same strings, with no runtime benefit.
 * - The map is computed once and never re-evaluated — no runtime coupling.
 * - All callers fall back to category.name for non-preset IDs, so the map
 *   is purely supplemental to live Firestore data.
 *
 * This is "preset-derived static runtime config" by intentional design.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NOT responsible for: library/onboarding config, seeding, blueprint data.
 */
import {
  FOLDER_BLUEPRINTS,
  CATEGORY_BLUEPRINTS,
} from '../preset/categoryPresets';

/**
 * Flat map: preset stable slug → { name, ru }.
 * Built once at module load — no per-render cost.
 * Covers both folder IDs and category IDs stored in Firestore.
 */
export const CATEGORY_ALIAS_MAP: ReadonlyMap<string, { name: string; ru?: string }> = new Map([
  ...FOLDER_BLUEPRINTS.map((f) => [f.id, { name: f.name, ru: f.ru }] as const),
  ...CATEGORY_BLUEPRINTS.map((c) => [c.id, { name: c.name, ru: c.ru }] as const),
]);

/**
 * Returns the localized display name for a preset stable slug.
 * Returns null for unknown IDs — callers must fall back to category.name.
 */
export function getPresetDisplayName(id: string, lang: string): string | null {
  const entry = CATEGORY_ALIAS_MAP.get(id);
  if (!entry) return null;
  return lang === 'ru' && entry.ru ? entry.ru : entry.name;
}
