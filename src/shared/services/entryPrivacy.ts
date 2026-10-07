import { doc, type Transaction } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { CategoryType, Privacy } from '@/shared/types';

export async function readEntryPrivacy(tx: Transaction, userId: string, type: CategoryType,
  categoryIds: string[], previous: Privacy = 'regular', allowArchived = false): Promise<Privacy> {
  const categories = await Promise.all([...new Set(categoryIds)].map(id =>
    tx.get(doc(getDb(), 'categories', userId, type, id))));
  if (categories.some(c => !c.exists() || (!allowArchived && c.data()?.archived))) throw new Error('category-unavailable');
  return previous === 'secret' || categories.some(c => c.data()?.isPrivate === true) ? 'secret' : 'regular';
}
