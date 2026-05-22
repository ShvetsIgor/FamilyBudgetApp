/**
 * Pure UI derivation: groups active categories into folder sections.
 *
 * Used by both selectors (selectFolderSections) and UI components that need
 * folder-grouped views from local state (CategoryPicker, CategorySheet).
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
