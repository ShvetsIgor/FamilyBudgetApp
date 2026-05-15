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

// Resets categories to TAXONOMY defaults while REUSING the same Firestore IDs
// for matched categories — so expense categoryIds stay valid without any migration.
// Returns oldId→newId only for categories that got NEW ids (truly new entries).
export async function resetCategoriesToDefaults(
  userId: string
): Promise<Record<string, string>> {
  const db = getDb();

  // 1. Read current categories (id → { name, parentId, parentName })
  type OldCat = { name: string; parentId?: string };
  const oldCats: Record<string, OldCat> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const data = d.data() as { name?: string; parentId?: string };
      if (data.name) oldCats[d.id] = { name: data.name, parentId: data.parentId };
    });
  }

  // Build lookup: name → existing id (parents); "parentName::subName" → existing id (subs)
  const existingParentId: Record<string, string> = {};   // parentName → existingId
  const existingSubId: Record<string, string> = {};      // "parentName::subName" → existingId
  for (const [id, { name, parentId }] of Object.entries(oldCats)) {
    if (!parentId) {
      existingParentId[name] = id;
    } else {
      const parentName = oldCats[parentId]?.name;
      if (parentName) existingSubId[`${parentName}::${name}`] = id;
    }
  }

  // 2. Delete all existing categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // 3. Recreate via batch — reusing the SAME id where name matches, new id otherwise
  const batch = writeBatch(db);
  const oldIdToNewId: Record<string, string> = {};  // only populated when id changes
  const keyToNewId: Record<string, string> = {};    // makeKey → new parent id (for child parentId resolution)
  const nameToNewId: Record<string, string> = {};   // parent name → new id

  const seedCats = (
    cats: typeof DEFAULT_EXPENSE_CATEGORIES,
    type: CategoryType
  ) => {
    // Parents first
    for (const cat of cats.filter((c) => !c.parentId)) {
      const { parentId: _omit, ...catData } = cat;
      const reuseId = existingParentId[cat.name];
      const ref = reuseId
        ? doc(colRef(userId, type), reuseId)
        : doc(colRef(userId, type));
      batch.set(ref, { ...catData, userId });
      const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
      keyToNewId[key] = ref.id;
      nameToNewId[cat.name] = ref.id;
      if (reuseId && reuseId !== ref.id) oldIdToNewId[reuseId] = ref.id;
    }
    // Children
    for (const cat of cats.filter((c) => c.parentId)) {
      const realParentId = keyToNewId[cat.parentId!] ?? null;
      const { parentId: _omit, ...catData } = cat;
      const parentName = Object.entries(nameToNewId).find(([, id]) => id === realParentId)?.[0];
      const reuseId = parentName ? existingSubId[`${parentName}::${cat.name}`] : undefined;
      const ref = reuseId
        ? doc(colRef(userId, type), reuseId)
        : doc(colRef(userId, type));
      batch.set(ref, { ...catData, parentId: realParentId, userId });
      if (reuseId && reuseId !== ref.id) oldIdToNewId[reuseId] = ref.id;
    }
  };

  seedCats(DEFAULT_EXPENSE_CATEGORIES, 'expense');
  seedCats(DEFAULT_INCOME_CATEGORIES, 'income');
  await batch.commit();

  return oldIdToNewId;
}

async function seedDefaultCategoriesForce(
  userId: string
): Promise<{ nameToId: Record<string, string>; parentKeyToId: Record<string, string> }> {
  const db = getDb();
  const nameToId: Record<string, string> = {};       // parentName → newId
  const parentKeyToId: Record<string, string> = {};  // "ParentName::SubName" → newId
  const keyToRef: Record<string, string> = {};       // makeKey → newId (for parentId resolution)

  const batch = writeBatch(db);

  const seedCats = (
    cats: typeof DEFAULT_EXPENSE_CATEGORIES,
    type: CategoryType
  ) => {
    // First pass: parents
    for (const cat of cats.filter((c) => !c.parentId)) {
      const { parentId: _omit, ...catData } = cat;
      const ref = doc(colRef(userId, type));
      batch.set(ref, { ...catData, userId });
      const key = `__${cat.name.toLowerCase().replace(/[\s/]+/g, '_')}__`;
      keyToRef[key] = ref.id;
      nameToId[cat.name] = ref.id;
    }
    // Second pass: children
    for (const cat of cats.filter((c) => c.parentId)) {
      const realParentId = keyToRef[cat.parentId!] ?? null;
      const { parentId: _omit, ...catData } = cat;
      const ref = doc(colRef(userId, type));
      batch.set(ref, { ...catData, parentId: realParentId, userId });
      // Find parent name to build "ParentName::SubName" key
      const parentName = Object.entries(nameToId).find(([, id]) => id === realParentId)?.[0];
      if (parentName) parentKeyToId[`${parentName}::${cat.name}`] = ref.id;
    }
  };

  seedCats(DEFAULT_EXPENSE_CATEGORIES, 'expense');
  seedCats(DEFAULT_INCOME_CATEGORIES, 'income');

  await batch.commit();
  return { nameToId, parentKeyToId };
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

