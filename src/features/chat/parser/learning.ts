import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
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
const listeners = new Set<(userId: string) => void>();

/** Lets the chat pick up a word it was just taught, without a reload. */
export function subscribeLearnedKeywords(listener: (userId: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

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

/**
 * Teaches one word. `keyword` comes from `extractLearnableKeyword`, so it is
 * letters and spaces only — a safe document id. The latest choice wins.
 */
export async function learnKeyword(userId: string, keyword: string, categoryId: string): Promise<void> {
  // Usable at once — the very next message, even offline — and undone if the write fails
  const before = cache.get(userId);
  cache.set(userId, { ...(before ?? {}), [keyword]: { categoryId } });
  listeners.forEach((listener) => listener(userId));
  try {
    await setDoc(doc(getDb(), 'users', userId, 'learnedKeywords', keyword), { categoryId, updatedAt: serverTimestamp() });
  } catch (error) {
    if (before) cache.set(userId, before); else cache.delete(userId);
    listeners.forEach((listener) => listener(userId));
    throw error;
  }
}

export async function clearLearnedKeywords(userId: string): Promise<void> {
  cache.delete(userId);
  listeners.forEach((listener) => listener(userId));
  const snap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  await Promise.all(snap.docs.map((keyword) => deleteDoc(keyword.ref)));
}
