import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { KeywordHit } from './dictionary';

/**
 * Per-account cache of the learned-keyword map.
 *
 * /home is the primary tab and this is an unbounded collection read, so
 * without a cache every return to the chat re-read every keyword the user had
 * ever taught the parser. It lives here rather than in the hook so that
 * `clearLearnedKeywords` — the category-reset path — can invalidate it; a
 * cache the reset does not know about would keep serving deleted keywords
 * until the next reload.
 */
const cache = new Map<string, Record<string, KeywordHit>>();

export function cachedLearnedKeywords(userId: string): Record<string, KeywordHit> | undefined {
  return cache.get(userId);
}

export async function fetchLearnedKeywords(
  userId: string
): Promise<Record<string, KeywordHit>> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const snap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  const result: Record<string, KeywordHit> = {};
  snap.docs.forEach((d) => {
    const data = d.data() as { categoryId: string };
    result[d.id] = { categoryId: data.categoryId };
  });
  cache.set(userId, result);
  return result;
}

export async function clearLearnedKeywords(userId: string): Promise<void> {
  cache.delete(userId);
  const snap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  await Promise.all(snap.docs.map((keyword) => deleteDoc(keyword.ref)));
}
