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

export interface TopCategory {
  catId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
}

/**
 * Aggregates per-category spend totals across monthly stats, returns top-N sorted by total.
 * Aggregates by categoryId only — folders are UI-only and must not affect domain analytics.
 */
export function aggregateTopCategories(
  months: { byCategory: Record<string, number> }[],
  allCats: Category[],
  limit: number,
): TopCategory[] {
  const totals = new Map<string, number>();
  for (const m of months) {
    for (const [catId, amount] of Object.entries(m.byCategory)) {
      totals.set(catId, (totals.get(catId) ?? 0) + amount);
    }
  }
  return Array.from(totals.entries())
    .filter(([, amt]) => amt > 0)
    .map(([catId, total]) => {
      const cat = allCats.find((c) => c.id === catId);
      return {
        catId,
        name: cat?.name ?? 'Other',
        color: cat?.color ?? '#6b7280',
        icon: cat?.icon ?? 'box',
        total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
