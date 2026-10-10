import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Category, CategoryFolder, Language } from '@/shared/types';
import { normalizeNameKey } from '@/shared/utils/normalizeName';
import { isActiveCategory, isAppManagedSavingsCategory } from '../policy/categoryPolicy';
import { CATEGORY_BLUEPRINTS, FOLDER_BLUEPRINTS } from '../preset/categoryPresets';

/**
 * First-expense setup offered inside the chat. New accounts have no active
 * expense categories (presets are library-only), so the very first message
 * cannot be filed anywhere. The chat offers these presets as preselected
 * toggles; nothing is materialized until the user taps the button.
 */
export const STARTER_CATEGORY_IDS = [
  'groceries', 'restaurant', 'coffee', 'public_transport',
  'fuel', 'utilities', 'pharmacy', 'clothes',
] as const;

/** The savings flow's own category (seeded or found by name) is never the user's choice. */
export function needsStarterCategories(categories: readonly Category[]): boolean {
  return !categories.some((category) =>
    category.type === 'expense' && isActiveCategory(category) && !isAppManagedSavingsCategory(category));
}

/** Materialized presets are named in the language the user is reading. */
export function presetLabel(preset: { name: string; ru?: string }, language: Language): string {
  return language === 'ru' ? (preset.ru ?? preset.name) : preset.name;
}

export interface StarterOption { id: string; name: string; icon: string; color: string }

export function starterOptions(language: Language): StarterOption[] {
  return STARTER_CATEGORY_IDS.flatMap((id) => {
    const preset = CATEGORY_BLUEPRINTS.find((entry) => entry.id === id);
    return preset ? [{ id, name: presetLabel(preset, language), icon: preset.icon, color: preset.color }] : [];
  });
}

export interface StarterActivation {
  /** Preset folders written by this activation. */
  folders: CategoryFolder[];
  created: Category[];
  /**
   * Categories that were in the given list and are active now: archived
   * presets brought back under their own id instead of duplicated, or ones
   * whose document changed underneath the list. Redux replaces them in place.
   */
  restored: Category[];
  /**
   * Documents that already existed under a preset id although the given lists
   * did not contain them (written meanwhile by another device). They are used
   * as they are — never overwritten — and Redux has to add them.
   */
  adopted: { folders: CategoryFolder[]; categories: Category[] };
  /** Every requested preset that is active now, including ones that already were. */
  activeIds: string[];
}

type StarterPlan = { preset: (typeof CATEGORY_BLUEPRINTS)[number]; inList: boolean };

/**
 * Writes the chosen preset folders and categories in ONE transaction under
 * their stable preset ids. Idempotent and non-destructive: active entries (by
 * id or by name) are left alone, and every target document is READ inside the
 * transaction first — an existing one is never overwritten (an archived one is
 * only un-archived), so usage history and the user's renames survive even when
 * the given lists are stale. Callers should still pass freshly read lists.
 */
export async function activateStarterCategories({ userId, blueprintIds, language, folders, categories }: {
  userId: string;
  blueprintIds: readonly string[];
  language: Language;
  folders: readonly CategoryFolder[];
  categories: readonly Category[];
}): Promise<StarterActivation> {
  const alreadyActive: string[] = [];
  const plans: StarterPlan[] = [];
  for (const id of new Set(blueprintIds)) {
    const preset = CATEGORY_BLUEPRINTS.find((entry) => entry.id === id);
    if (!preset || preset.folderId === 'income') continue;
    const names = [preset.name, preset.ru].filter(Boolean).map((name) => normalizeNameKey(name!));
    const sameId = categories.find((category) => category.id === preset.id && category.type === 'expense');
    const active = sameId && isActiveCategory(sameId) ? sameId : categories.find((category) =>
      category.type === 'expense' && isActiveCategory(category) && names.includes(normalizeNameKey(category.name)));
    if (active) alreadyActive.push(active.id);
    else plans.push({ preset, inList: !!sameId });
  }
  const empty = (): StarterActivation => ({
    folders: [], created: [], restored: [], adopted: { folders: [], categories: [] }, activeIds: [...alreadyActive],
  });
  if (plans.length === 0) return empty();

  const db = getDb();
  const categoryRef = (id: string) => doc(db, 'categories', userId, 'expense', id);
  const folderRef = (id: string) => doc(db, 'categoryFolders', userId, 'expense', id);
  const listFolder = (presetFolderId: string): string | null => {
    const preset = FOLDER_BLUEPRINTS.find((entry) => entry.id === presetFolderId);
    const keys = preset ? [preset.name, preset.ru].filter(Boolean).map((name) => normalizeNameKey(name!)) : [];
    return (folders.find((folder) => folder.id === presetFolderId)
      ?? folders.find((folder) => keys.includes(normalizeNameKey(folder.name))))?.id ?? null;
  };

  // A transaction may run more than once: everything below starts from scratch.
  return runTransaction(db, async (tx) => {
    const result = empty();

    // ── Reads (all of them before any write) ──
    const categorySnaps = await Promise.all(plans.map(({ preset }) => tx.get(categoryRef(preset.id))));
    // Preset folders that may have to be created, plus the folders of existing
    // documents the lists missed, so those can be adopted along with them
    const listedFolderIds = new Set(folders.map((folder) => folder.id));
    const folderCandidates = new Set([
      ...plans.map(({ preset }) => preset.folderId)
        .filter((id) => !listFolder(id) && FOLDER_BLUEPRINTS.some((entry) => entry.id === id)),
      ...categorySnaps.flatMap((snap) => {
        const folderId = snap.exists() ? (snap.data() as Partial<Category>).folderId : null;
        return folderId && !listedFolderIds.has(folderId) ? [folderId] : [];
      }),
    ]);
    const folderSnaps = new Map(await Promise.all([...folderCandidates].map(async (id) =>
      [id, await tx.get(folderRef(id))] as const)));

    // ── Writes ──
    const knownFolderIds = new Set(listedFolderIds);
    const adoptFolder = (folderId: string): boolean => {
      if (knownFolderIds.has(folderId)) return true;
      const snap = folderSnaps.get(folderId);
      if (!snap?.exists()) return false;
      knownFolderIds.add(folderId);
      result.adopted.folders.push({ ...(snap.data() as Omit<CategoryFolder, 'id'>), id: folderId });
      return true;
    };
    let nextFolderOrder = folders.reduce((max, folder) => Math.max(max, folder.order ?? 0), -1) + 1;
    const folderSizes = new Map<string, number>();
    for (const category of categories) {
      if (category.folderId && isActiveCategory(category)) {
        folderSizes.set(category.folderId, (folderSizes.get(category.folderId) ?? 0) + 1);
      }
    }
    const nextOrder = (folderId: string | null) => {
      const key = folderId ?? '';
      const order = folderSizes.get(key) ?? 0;
      folderSizes.set(key, order + 1);
      return order;
    };

    const useFolder = (presetFolderId: string): string | null => {
      const listed = listFolder(presetFolderId);
      if (listed) return listed;
      if (adoptFolder(presetFolderId)) return presetFolderId;
      const preset = FOLDER_BLUEPRINTS.find((entry) => entry.id === presetFolderId);
      if (!preset || !folderSnaps.has(presetFolderId)) return null;
      knownFolderIds.add(preset.id);
      const data = {
        name: presetLabel(preset, language), icon: preset.icon, color: preset.color,
        type: 'expense' as const, order: nextFolderOrder++,
      };
      tx.set(folderRef(preset.id), { ...data, userId });
      result.folders.push({ ...data, id: preset.id, userId });
      return preset.id;
    };

    plans.forEach(({ preset, inList }, index) => {
      const snap = categorySnaps[index];
      result.activeIds.push(preset.id);
      if (snap.exists()) {
        const existing = { ...(snap.data() as Omit<Category, 'id'>), id: preset.id } as Category;
        let current = existing;
        // Keep the folder the user had it in when that folder still exists
        const ownFolder = existing.folderId && adoptFolder(existing.folderId) ? existing.folderId : null;
        if (!isActiveCategory(existing)) {
          const folderId = ownFolder ?? useFolder(preset.folderId);
          tx.update(categoryRef(preset.id), { archived: false, folderId });
          current = { ...existing, archived: false, folderId };
        }
        (inList ? result.restored : result.adopted.categories).push(current);
        return;
      }
      const folderId = useFolder(preset.folderId);
      const data = {
        name: presetLabel(preset, language), icon: preset.icon, color: preset.color,
        folderId, isPrivate: false, order: nextOrder(folderId), type: 'expense' as const,
      };
      tx.set(categoryRef(preset.id), { ...data, userId });
      const created: Category = { ...data, id: preset.id, userId };
      // A listed category whose document vanished is replaced in Redux, not duplicated
      (inList ? result.restored : result.created).push(created);
    });
    return result;
  });
}
