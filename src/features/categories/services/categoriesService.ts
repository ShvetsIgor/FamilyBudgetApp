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

// Returns oldId→newId map for Redux expense remap
export async function resetCategoriesToDefaults(
  userId: string
): Promise<Record<string, string>> {
  const db = getDb();

  // 1. Snapshot old categories: id → { name, parentId }
  const oldCats: Record<string, { name: string; parentId?: string }> = {};
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    snap.docs.forEach((d) => {
      const data = d.data() as { name?: string; parentId?: string };
      if (data.name) oldCats[d.id] = { name: data.name, parentId: data.parentId };
    });
  }

  // 2. Delete old categories
  for (const type of ['expense', 'income'] as CategoryType[]) {
    const snap = await getDocs(colRef(userId, type));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // 3. Seed new categories via atomic batch
  const { nameToId, parentKeyToId } = await seedDefaultCategoriesForce(userId);

  // 4. Build oldId → newId:
  //    - parents matched by name (unique across taxonomy)
  //    - subs matched by parentName::subName to avoid "Other" collisions
  const oldIdToNewId: Record<string, string> = {};
  for (const [oldId, { name, parentId }] of Object.entries(oldCats)) {
    if (!parentId) {
      // parent category — match by name
      if (nameToId[name]) oldIdToNewId[oldId] = nameToId[name];
    } else {
      // sub — match by parentName::subName
      const parentName = oldCats[parentId]?.name;
      const key = parentName ? `${parentName}::${name}` : name;
      if (parentKeyToId[key]) oldIdToNewId[oldId] = parentKeyToId[key];
    }
  }

  // All valid new category IDs (to detect stale IDs from older resets)
  const newIds = new Set([...Object.values(nameToId), ...Object.values(parentKeyToId)]);
  // Fallback: first parent category (not Savings) for completely unknown IDs
  const fallbackId = Object.entries(nameToId).find(([name]) => name !== 'Savings')?.[1] ?? '';

  // 5. Migrate Firestore expenses
  const expSnap = await getDocs(collection(db, 'expenses', userId, 'items'));
  const expBatch = writeBatch(db);
  let count = 0;
  for (const expDoc of expSnap.docs) {
    const data = expDoc.data() as { categoryId?: string; subcategoryId?: string };
    const updates: Record<string, string> = {};

    if (data.categoryId) {
      if (oldIdToNewId[data.categoryId]) {
        updates.categoryId = oldIdToNewId[data.categoryId];
      } else if (!newIds.has(data.categoryId) && fallbackId) {
        // Stale ID from a previous failed reset — map to fallback
        oldIdToNewId[data.categoryId] = fallbackId;
        updates.categoryId = fallbackId;
      }
    }
    if (data.subcategoryId && oldIdToNewId[data.subcategoryId]) {
      updates.subcategoryId = oldIdToNewId[data.subcategoryId];
    }

    if (Object.keys(updates).length > 0) {
      expBatch.update(expDoc.ref, updates);
      if (++count === 499) break;
    }
  }
  if (count > 0) await expBatch.commit();

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

