/**
 * Pure UI derivation: groups active categories into folder sections.
 *
 * ── Derivation paths ──────────────────────────────────────────────────────
 * selectFolderSections (store/selectors.ts) is the CANONICAL path for
 * components that read full Redux active-category state.
 *
 * Direct usage of buildFolderSections() is valid in exactly one case:
 *
 *   1. CategoryPicker — applies a search filter before grouping, so it
 *      passes a filtered subset rather than all active categories.
 *      selectFolderSections cannot accommodate a dynamic search list.
 *
 * (The chat had a second picker of its own with a categories override; it was
 * the reason categories inside folders went missing there, and it is gone —
 * the chat now uses the canonical CategoryFolderPickerSheet.)
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
    const cats = activeCats.filter((c) => c.folderId === folder.id || c.extraFolderIds?.includes(folder.id));
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
