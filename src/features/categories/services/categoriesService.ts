import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
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
  // Delete all existing categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await seedDefaultCategoriesForce(userId);
}

async function seedDefaultCategoriesForce(userId: string): Promise<void> {
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

