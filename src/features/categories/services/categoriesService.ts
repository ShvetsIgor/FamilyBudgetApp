import {
  collection,
  doc,
  getDocs,
  addDoc,
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

export async function updateCategory(userId: string, category: Category): Promise<void> {
  const { id, ...data } = category;
  await updateDoc(doc(getDb(), 'categories', userId, data.type, id), data);
}

export async function deleteCategory(userId: string, categoryId: string, type: CategoryType): Promise<void> {
  await deleteDoc(doc(getDb(), 'categories', userId, type, categoryId));
}

export async function resetCategoriesToDefaults(userId: string): Promise<void> {
  const db = getDb();

  // 1. Snapshot old categories: name → id (for both expense types)
  const oldNameToId: Record<string, string> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const name = (d.data().name as string | undefined) ?? '';
      if (name) oldNameToId[name] = d.id;
    });
  }

  // 2. Delete all existing categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // 3. Seed new categories and build new name → id map
  const newNameToId = await seedDefaultCategoriesForce(userId);

  // 4. Migrate expenses: remap categoryId and subcategoryId
  const expSnap = await getDocs(collection(db, 'expenses', userId, 'items'));
  const batch = writeBatch(db);
  let batchCount = 0;

  for (const expDoc of expSnap.docs) {
    const data = expDoc.data() as { categoryId?: string; subcategoryId?: string };
    const updates: Record<string, string> = {};

    if (data.categoryId) {
      // find old name for this id, then map to new id
      const oldName = Object.entries(oldNameToId).find(([, id]) => id === data.categoryId)?.[0];
      if (oldName && newNameToId[oldName]) updates.categoryId = newNameToId[oldName];
    }
    if (data.subcategoryId) {
      const oldName = Object.entries(oldNameToId).find(([, id]) => id === data.subcategoryId)?.[0];
      if (oldName && newNameToId[oldName]) updates.subcategoryId = newNameToId[oldName];
    }

    if (Object.keys(updates).length > 0) {
      batch.update(expDoc.ref, updates);
      batchCount++;
      // Firestore batch limit is 500 ops
      if (batchCount === 499) break;
    }
  }

  if (batchCount > 0) await batch.commit();
}

async function seedDefaultCategoriesForce(userId: string): Promise<Record<string, string>> {
  const nameToId: Record<string, string> = {};
  const parentIdMap: Record<string, string> = {};

  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'expense'), { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    parentIdMap[key] = ref.id;
    nameToId[cat.name] = ref.id;
  }

  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = parentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'expense'), { ...catData, parentId: realParentId, userId });
    nameToId[cat.name] = ref.id;
  }

  const incomeParentIdMap: Record<string, string> = {};
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'income'), { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    incomeParentIdMap[key] = ref.id;
    nameToId[cat.name] = ref.id;
  }
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = incomeParentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'income'), { ...catData, parentId: realParentId, userId });
    nameToId[cat.name] = ref.id;
  }

  return nameToId;
}

export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await fetchCategories(userId, 'expense');
  if (existing.length > 0) return;

  const parentIdMap: Record<string, string> = {};

  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'expense'), { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    parentIdMap[key] = ref.id;
  }

  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = parentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    await addDoc(colRef(userId, 'expense'), { ...catData, parentId: realParentId, userId });
  }

  const incomeParentIdMap: Record<string, string> = {};
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = await addDoc(colRef(userId, 'income'), { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    incomeParentIdMap[key] = ref.id;
  }
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = incomeParentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    await addDoc(colRef(userId, 'income'), { ...catData, parentId: realParentId, userId });
  }
}

