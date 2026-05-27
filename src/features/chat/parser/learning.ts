import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { KeywordHit } from './dictionary';

export async function saveLearnedKeyword(
  userId: string,
  keyword: string,
  hit: KeywordHit
): Promise<void> {
  const ref = doc(getDb(), 'users', userId, 'learnedKeywords', keyword.toLowerCase());
  await setDoc(ref, { categoryId: hit.categoryId });
}

export async function fetchLearnedKeywords(
  userId: string
): Promise<Record<string, KeywordHit>> {
  const snap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  const result: Record<string, KeywordHit> = {};
  snap.docs.forEach((d) => {
    const data = d.data() as { categoryId: string };
    result[d.id] = { categoryId: data.categoryId };
  });
  return result;
}

export async function clearLearnedKeywords(userId: string): Promise<void> {
  const snap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  await Promise.all(snap.docs.map((keyword) => deleteDoc(keyword.ref)));
}
