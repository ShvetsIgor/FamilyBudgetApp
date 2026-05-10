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
  const ref = await addDoc(colRef(userId, data.type), { ...data, userId });
  return { id: ref.id, userId, ...data };
}

export async function updateCategory(userId: string, category: Category): Promise<void> {
  const { id, ...data } = category;
  await updateDoc(doc(getDb(), 'categories', userId, data.type, id), data);
}

export async function deleteCategory(userId: string, categoryId: string, type: CategoryType): Promise<void> {
  await deleteDoc(doc(getDb(), 'categories', userId, type, categoryId));
}

export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await fetchCategories(userId, 'expense');
  if (existing.length > 0) return;

  const parentIdMap: Record<string, string> = {};

  // Parents first
  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => !c.parentId)) {
    const ref = await addDoc(colRef(userId, 'expense'), { ...cat, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    parentIdMap[key] = ref.id;
  }

  // Children
  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = cat.parentId ? parentIdMap[cat.parentId] : undefined;
    await addDoc(colRef(userId, 'expense'), { ...cat, parentId: realParentId ?? null, userId });
  }

  // Income (flat, no children)
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    await addDoc(colRef(userId, 'income'), { ...cat, userId });
  }
}
