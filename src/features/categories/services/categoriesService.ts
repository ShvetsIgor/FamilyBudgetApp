import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Category, CategoryType } from '@/shared/types';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_FOLDER_SEEDS,
  DEFAULT_INCOME_FOLDER_SEEDS,
} from './defaultCategories';
import { bulkCreateFolders, fetchFolders } from './categoryFoldersService';
import { legacyCategoryMap } from '../compat/legacyCategoryMap';
import { CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

function colRef(userId: string, type: CategoryType) {
  return collection(getDb(), 'categories', userId, type);
}

export async function fetchCategories(userId: string, type: CategoryType): Promise<Category[]> {
  const q = query(colRef(userId, type), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

export async function addCategory(userId: string, data: Omit<Category, 'id' | 'userId'>): Promise<Category> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, userId }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(colRef(userId, data.type), clean);
  return { id: ref.id, userId, ...data };
}

export async function addCategoryWithId(userId: string, id: string, data: Omit<Category, 'id' | 'userId'>): Promise<Category> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, userId }).filter(([, v]) => v !== undefined)
  );
  await setDoc(doc(getDb(), 'categories', userId, data.type, id), clean);
  return { id, userId, ...data };
}

export async function updateCategory(userId: string, category: Category): Promise<void> {
  const { id, ...data } = category;
  await updateDoc(doc(getDb(), 'categories', userId, data.type, id), data);
}

/**
 * Patch only the metadata fields of a category (tags, aliases, keywords, usageCount, lastUsedAt).
 * Does not overwrite other fields.
 */
export async function updateCategoryMetadata(
  userId: string,
  categoryId: string,
  type: CategoryType,
  patch: {
    tags?: string[];
    aliases?: string[];
    keywords?: string[];
    usageCount?: number;
    lastUsedAt?: string;
  },
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(clean).length === 0) return;
  await updateDoc(doc(getDb(), 'categories', userId, type, categoryId), clean);
}

/** Hard-deletes a category. Only call when the category has never been used in any expense. */
export async function deleteCategory(userId: string, categoryId: string, type: CategoryType): Promise<void> {
  await deleteDoc(doc(getDb(), 'categories', userId, type, categoryId));
}

/** Soft-deletes: marks archived=true. Use when the category may have expenses. */
export async function archiveCategoryInFirestore(userId: string, categoryId: string, type: CategoryType): Promise<void> {
  await updateDoc(doc(getDb(), 'categories', userId, type, categoryId), { archived: true });
}

// Resets categories and folders to preset defaults using stable IDs.
// Returns oldId→newId map for expenses that need re-linking.
export async function resetCategoriesToDefaults(userId: string): Promise<Record<string, string>> {
  const db = getDb();

  // Capture old names before deleting
  const oldNames: Record<string, string> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const data = d.data() as { name?: string };
      if (data.name) oldNames[d.id] = data.name;
    });
  }

  // Delete all existing categories and folders
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const [catSnap, folderSnap] = await Promise.all([
      getDocs(colRef(userId, type)),
      getDocs(collection(db, 'categoryFolders', userId, type)),
    ]);
    await Promise.all([
      ...catSnap.docs.map((d) => deleteDoc(d.ref)),
      ...folderSnap.docs.map((d) => deleteDoc(d.ref)),
    ]);
  }

  // Recreate categories with stable preset IDs
  const batch = writeBatch(db);
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const { id, ...rest } = cat;
    const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
    batch.set(doc(colRef(userId, 'expense'), id), clean);
  }
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const { id, ...rest } = cat;
    const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
    batch.set(doc(colRef(userId, 'income'), id), clean);
  }
  await batch.commit();

  // Recreate folders
  await Promise.all([
    bulkCreateFolders(userId, DEFAULT_EXPENSE_FOLDER_SEEDS),
    bulkCreateFolders(userId, DEFAULT_INCOME_FOLDER_SEEDS),
  ]);

  // Build oldId→newId map: match by name, then apply legacyCategoryMap for unmapped old IDs
  const oldIdToNewId: Record<string, string> = {};
  for (const [oldId, name] of Object.entries(oldNames)) {
    const match = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].find((c) => c.name === name);
    if (match && oldId !== match.id) oldIdToNewId[oldId] = match.id;
  }
  // Apply legacy map for any IDs not matched by name
  for (const [legacyId, newId] of Object.entries(legacyCategoryMap)) {
    if (!oldIdToNewId[legacyId]) oldIdToNewId[legacyId] = newId;
  }
  return oldIdToNewId;
}

export async function seedDefaultCategories(userId: string): Promise<void> {
  const [existingExpense, existingIncome, existingExpFolders, existingIncFolders] = await Promise.all([
    fetchCategories(userId, 'expense'),
    fetchCategories(userId, 'income'),
    fetchFolders(userId, 'expense'),
    fetchFolders(userId, 'income'),
  ]);

  const db = getDb();

  // ── Seed missing categories ──────────────────────────────────────────────────
  if (existingExpense.length === 0) {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const { id, ...rest } = cat;
      const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
      await setDoc(doc(colRef(userId, 'expense'), id), clean);
    }
  }
  if (existingIncome.length === 0) {
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      const { id, ...rest } = cat;
      const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
      await setDoc(doc(colRef(userId, 'income'), id), clean);
    }
  }

  // ── Seed missing folders (checked independently — folders may be missing even if cats exist) ──
  if (existingExpFolders.length === 0) {
    await bulkCreateFolders(userId, DEFAULT_EXPENSE_FOLDER_SEEDS);
  } else {
    // Ensure individual missing default folders are created (partial migration)
    const existingFolderIds = new Set(existingExpFolders.map((f) => f.id));
    const missingFolders = DEFAULT_EXPENSE_FOLDER_SEEDS.filter((f) => !existingFolderIds.has(f.id));
    if (missingFolders.length > 0) await bulkCreateFolders(userId, missingFolders);
  }

  if (existingIncFolders.length === 0) {
    await bulkCreateFolders(userId, DEFAULT_INCOME_FOLDER_SEEDS);
  } else {
    const existingFolderIds = new Set(existingIncFolders.map((f) => f.id));
    const missingFolders = DEFAULT_INCOME_FOLDER_SEEDS.filter((f) => !existingFolderIds.has(f.id));
    if (missingFolders.length > 0) await bulkCreateFolders(userId, missingFolders);
  }

  // ── Migrate categories missing folderId (existing users) ────────────────────
  // Build categoryId → folderId from blueprints
  const blueprintFolderMap = new Map<string, string>(
    CATEGORY_BLUEPRINTS.map((b) => [b.id, b.folderId]),
  );

  const catsToMigrate = existingExpense.filter(
    (c) => !c.folderId && blueprintFolderMap.has(c.id),
  );
  if (catsToMigrate.length > 0) {
    const batch = writeBatch(db);
    for (const cat of catsToMigrate) {
      const folderId = blueprintFolderMap.get(cat.id)!;
      batch.update(doc(colRef(userId, 'expense'), cat.id), { folderId });
    }
    await batch.commit();
  }
}

export async function bulkApplyConstructorDiff(
  userId: string,
  toAdd: Array<{ id: string; name: string; ru?: string; icon: string; color?: string; type: CategoryType; order: number; isPrivate: boolean; folderId?: string }>,
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  for (const { id, ...cat } of toAdd) {
    const clean = Object.fromEntries(Object.entries({ ...cat, userId }).filter(([, v]) => v !== undefined));
    batch.set(doc(db, 'categories', userId, cat.type, id), clean);
  }
  await batch.commit();
}
