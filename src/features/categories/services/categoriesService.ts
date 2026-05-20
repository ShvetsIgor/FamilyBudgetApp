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
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './defaultCategories';

function colRef(userId: string, type: CategoryType) {
  return collection(getDb(), 'categories', userId, type);
}

export async function fetchCategories(userId: string, type: CategoryType): Promise<Category[]> {
  const q = query(colRef(userId, type), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

export async function addCategory(userId: string, data: Omit<Category, 'id' | 'userId'>): Promise<Category> {
  // Strip undefined fields — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries({ ...data, userId }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(colRef(userId, data.type), clean);
  return { id: ref.id, userId, ...data };
}

// Add category with a stable known ID (e.g. TAXONOMY slug) instead of auto-generated
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

export async function deleteCategory(userId: string, categoryId: string, type: CategoryType): Promise<void> {
  await deleteDoc(doc(getDb(), 'categories', userId, type, categoryId));
}

// Resets categories to TAXONOMY defaults using stable taxonomy IDs.
// Returns oldId→newId map for expenses that need re-linking.
export async function resetCategoriesToDefaults(
  userId: string
): Promise<Record<string, string>> {
  const db = getDb();

  // Build old name→id maps so we can return a migration map for expenses
  type OldCat = { name: string; parentId?: string };
  const oldCats: Record<string, OldCat> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const data = d.data() as { name?: string; parentId?: string };
      if (data.name) oldCats[d.id] = { name: data.name, parentId: data.parentId };
    });
  }

  // Delete all existing categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // Recreate with stable taxonomy IDs
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

  // Build oldId→newTaxonomyId map for expenses migration
  const oldIdToNewId: Record<string, string> = {};
  for (const [oldId, { name, parentId }] of Object.entries(oldCats)) {
    // Find matching taxonomy entry by name
    for (const cat of [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]) {
      if (cat.name === name && String(cat.parentId ?? '') === String(parentId ?? '')) {
        if (oldId !== cat.id) oldIdToNewId[oldId] = cat.id;
        break;
      }
    }
  }
  return oldIdToNewId;
}


export async function seedDefaultCategories(userId: string): Promise<void> {
  const [existingExpense, existingIncome] = await Promise.all([
    fetchCategories(userId, 'expense'),
    fetchCategories(userId, 'income'),
  ]);

  const needsExpense = existingExpense.length === 0;
  const needsIncome = existingIncome.filter((c) => c.parentId).length === 0;

  if (!needsExpense && !needsIncome) return;

  if (needsExpense) {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const { id, ...rest } = cat;
      const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
      await setDoc(doc(colRef(userId, 'expense'), id), clean);
    }
  }

  if (needsIncome) {
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      const { id, ...rest } = cat;
      const clean = Object.fromEntries(Object.entries({ ...rest, userId }).filter(([, v]) => v !== undefined));
      await setDoc(doc(colRef(userId, 'income'), id), clean);
    }
  }
}

export async function bulkApplyConstructorDiff(
  userId: string,
  toAdd: Array<{ id: string; name: string; ru?: string; icon: string; color?: string; parentId?: string; type: CategoryType; order: number; isPrivate: boolean }>,
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  for (const { id, ...cat } of toAdd) {
    const clean = Object.fromEntries(Object.entries({ ...cat, userId }).filter(([, v]) => v !== undefined));
    batch.set(doc(db, 'categories', userId, cat.type, id), clean);
  }
  await batch.commit();
}
