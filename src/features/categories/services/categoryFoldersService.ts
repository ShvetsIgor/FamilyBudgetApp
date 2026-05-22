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
import type { CategoryFolder, CategoryType } from '@/shared/types';

function foldersRef(userId: string, type: CategoryType) {
  return collection(getDb(), 'categoryFolders', userId, type);
}

export async function fetchFolders(userId: string, type: CategoryType): Promise<CategoryFolder[]> {
  const q = query(foldersRef(userId, type), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryFolder));
}

export async function addFolder(userId: string, data: Omit<CategoryFolder, 'id' | 'userId'>): Promise<CategoryFolder> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, userId }).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(foldersRef(userId, data.type), clean);
  return { id: ref.id, userId, ...data };
}

export async function updateFolder(userId: string, folder: CategoryFolder): Promise<void> {
  const { id, ...data } = folder;
  await updateDoc(doc(getDb(), 'categoryFolders', userId, data.type, id), data);
}

export async function deleteFolder(userId: string, folderId: string, type: CategoryType): Promise<void> {
  await deleteDoc(doc(getDb(), 'categoryFolders', userId, type, folderId));
}

/**
 * Bulk-creates folders from preset blueprint entries.
 */
export async function bulkCreateFolders(
  userId: string,
  folders: Array<Omit<CategoryFolder, 'userId'>>,
): Promise<CategoryFolder[]> {
  const db = getDb();
  const batch = writeBatch(db);
  const results: CategoryFolder[] = [];

  for (const { id, ...data } of folders) {
    const clean = Object.fromEntries(
      Object.entries({ ...data, userId }).filter(([, v]) => v !== undefined),
    );
    batch.set(doc(db, 'categoryFolders', userId, data.type, id), clean);
    results.push({ id, userId, ...data });
  }

  await batch.commit();
  return results;
}
