/**
 * Pure UI derivation: groups active categories into folder sections.
 *
 * ── Derivation paths ──────────────────────────────────────────────────────
 * selectFolderSections (store/selectors.ts) is the CANONICAL path for
 * components that read full Redux active-category state.
 *
 * Direct usage of buildFolderSections() is valid in exactly two cases:
 *
 *   1. CategoryPicker — applies a search filter before grouping, so it
 *      passes a filtered subset rather than all active categories.
 *      selectFolderSections cannot accommodate a dynamic search list.
 *
 *   2. CategorySheet (chat feature) — supports a categoriesOverride prop
 *      that substitutes non-Redux data. When overriding, selector paths
 *      do not apply.
 *
 * No other component should call buildFolderSections() directly.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Has no Redux dependency — accepts plain arrays, returns plain view models.
 */
import type { Category, CategoryFolder } from '@/shared/types';

export interface FolderSection {
  folderId: string | null;
  folderName: string;
  folderColor?: string;
  cats: Category[];
}

/**
 * Groups active categories into folder sections for UI display.
 * Expects already-filtered active-only cats — callers must filter archived before calling.
 * Ungrouped categories (no folderId) appear in a trailing section with folderId=null.
 */
export function buildFolderSections(
  folders: CategoryFolder[],
  activeCats: Category[],
): FolderSection[] {
  const sections: FolderSection[] = [];
  for (const folder of folders) {
    const cats = activeCats.filter((c) => c.folderId === folder.id);
    if (cats.length > 0) {
      sections.push({ folderId: folder.id, folderName: folder.name, folderColor: folder.color, cats });
    }
  }
  const ungrouped = activeCats.filter((c) => !c.folderId);
  if (ungrouped.length > 0) {
    sections.push({ folderId: null, folderName: '', cats: ungrouped });
  }
  return sections;
}
