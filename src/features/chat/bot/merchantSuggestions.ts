import type { Category } from '@/shared/types';
import type { CategoryUsage, SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import { getTopMerchantCategories, normalizeMerchantKey } from '@/features/expenses/engine/merchantMemory';
import { exactMerchant } from '../parser/merchantDraft';

/** Read old model/dictionary spellings together, without rewriting account memory. */
export function alignMerchantMemory(name: string, memory: SuggestionMemoryState): SuggestionMemoryState {
  const store = exactMerchant(name);
  if (!store) return memory;
  const key = normalizeMerchantKey(name);
  const sameStore = (candidate: string) => candidate === key || exactMerchant(candidate)?.id === store.id;
  const usages = new Map<string, CategoryUsage>();
  for (const [candidate, entries] of Object.entries(memory.merchants)) {
    if (!sameStore(candidate)) continue;
    for (const entry of entries) {
      const prior = usages.get(entry.categoryId);
      usages.set(entry.categoryId, {
        ...entry,
        count: entry.count + (prior?.count ?? 0),
        lastUsed: prior && prior.lastUsed > entry.lastUsed ? prior.lastUsed : entry.lastUsed,
      });
    }
  }
  return {
    ...memory,
    merchants: { ...memory.merchants, [key]: [...usages.values()] },
    splitCombos: memory.splitCombos.map((combo) => sameStore(combo.merchantKey)
      ? { ...combo, merchantKey: key } : combo),
  };
}

/** One confirmed choice is enough for a suggestion, never for an automatic save. */
export function merchantCategorySuggestions(name: string, memory: SuggestionMemoryState, categories: Category[]): string[] {
  const active = categories.filter((category) => !category.archived && category.type === 'expense');
  const history = getTopMerchantCategories(name, memory, active, 3);
  if (history.length) return history.map((category) => category.id);
  if (exactMerchant(name)?.storeGroup !== 'supermarket') return [];
  const groceries = active.find((category) => category.id === 'groceries'
    || ['продукты', 'продукты питания', 'groceries'].includes(category.name.trim().toLowerCase()));
  return groceries ? [groceries.id] : [];
}
