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

// Returns { oldIdToNewId } for Redux expense remap
export async function resetCategoriesToDefaults(
  userId: string
): Promise<Record<string, string>> {
  const db = getDb();

  // 1. Snapshot old categories: id → name
  const oldIdToName: Record<string, string> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const name = (d.data().name as string | undefined) ?? '';
      if (name) oldIdToName[d.id] = name;
    });
  }

  // 2. Delete old categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // 3. Seed new categories via batch (atomic, consistent)
  const nameToNewId = await seedDefaultCategoriesForce(userId);

  // 4. Build oldId → newId map
  const oldIdToNewId: Record<string, string> = {};
  for (const [oldId, name] of Object.entries(oldIdToName)) {
    if (nameToNewId[name]) oldIdToNewId[oldId] = nameToNewId[name];
  }

  // 5. Migrate Firestore expenses
  const expSnap = await getDocs(collection(db, 'expenses', userId, 'items'));
  const expBatch = writeBatch(db);
  let count = 0;
  for (const expDoc of expSnap.docs) {
    const data = expDoc.data() as { categoryId?: string; subcategoryId?: string };
    const updates: Record<string, string> = {};
    if (data.categoryId && oldIdToNewId[data.categoryId]) updates.categoryId = oldIdToNewId[data.categoryId];
    if (data.subcategoryId && oldIdToNewId[data.subcategoryId]) updates.subcategoryId = oldIdToNewId[data.subcategoryId];
    if (Object.keys(updates).length > 0) {
      expBatch.update(expDoc.ref, updates);
      if (++count === 499) break;
    }
  }
  if (count > 0) await expBatch.commit();

  return oldIdToNewId;
}

async function seedDefaultCategoriesForce(userId: string): Promise<Record<string, string>> {
  const db = getDb();
  const nameToId: Record<string, string> = {};
  const parentIdMap: Record<string, string> = {};

  // Pre-generate doc refs so we can use batch.set() (atomic write)
  const batch = writeBatch(db);

  // Expense parents
  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = doc(colRef(userId, 'expense'));
    batch.set(ref, { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    parentIdMap[key] = ref.id;
    nameToId[cat.name] = ref.id;
  }
  // Expense children
  for (const cat of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = parentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    const ref = doc(colRef(userId, 'expense'));
    batch.set(ref, { ...catData, parentId: realParentId, userId });
    // Don't overwrite parent names with sub names in nameToId — use unique key
    nameToId[`${cat.parentId}::${cat.name}`] = ref.id;
    nameToId[cat.name] = nameToId[cat.name] ?? ref.id; // first sub wins for plain name
  }

  // Income parent
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => !c.parentId)) {
    const { parentId: _omit, ...catData } = cat;
    const ref = doc(colRef(userId, 'income'));
    batch.set(ref, { ...catData, userId });
    const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
    parentIdMap[key] = ref.id;
    nameToId[cat.name] = ref.id;
  }
  // Income children
  for (const cat of DEFAULT_INCOME_CATEGORIES.filter((c) => c.parentId)) {
    const realParentId = parentIdMap[cat.parentId!] ?? null;
    const { parentId: _omit, ...catData } = cat;
    const ref = doc(colRef(userId, 'income'));
    batch.set(ref, { ...catData, parentId: realParentId, userId });
    nameToId[`${cat.parentId}::${cat.name}`] = ref.id;
    nameToId[cat.name] = nameToId[cat.name] ?? ref.id;
  }

  await batch.commit();
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

