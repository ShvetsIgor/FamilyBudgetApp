import type { RootState } from '@/store/store';
import type { Category, StoreProfile } from '@/shared/types';
import type { Currency } from '@/shared/types';

export interface BotContext {
  userId: string;
  currency: Currency;
  /** All expense categories indexed by id */
  categoriesById: Map<string, Category>;
  /** Top parent categories by usage — for clarify chips */
  topParentIds: string[];
  /** All income categories indexed by id */
  incomeCategoriesById: Map<string, Category>;
  /** Top income parent categories — for income clarify chips */
  topIncomeParentIds: string[];
  /** Today's total spent (from Redux expenses slice) */
  todaySpent: number;
  /** Store purchase history — keyed by storeId */
  storeProfiles: Record<string, StoreProfile>;
}

const TOP_FALLBACK = ['groceries', 'dining', 'transport', 'health', 'home', 'shopping'];

export function collectBotContext(state: RootState): BotContext | null {
  const userId = state.auth.user?.id;
  if (!userId) return null;

  const currency = state.ui.currency;
  const allCats = state.categories.expense;
  const allIncomeCats = state.categories.income;

  const categoriesById = new Map<string, Category>();
  allCats.forEach((c) => categoriesById.set(c.id, c));

  const incomeCategoriesById = new Map<string, Category>();
  allIncomeCats.forEach((c) => incomeCategoriesById.set(c.id, c));

  // Build top parent ids from frequency of existing expenses
  const freq: Record<string, number> = {};
  state.expenses.list.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId
      ? (categoriesById.get(cat.parentId)?.id ?? e.categoryId)
      : e.categoryId;
    freq[parentId] = (freq[parentId] ?? 0) + 1;
  });

  const parents = allCats.filter((c) => !c.parentId && c.name !== 'Savings');
  const topParentIds = parents
    .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0))
    .slice(0, 5)
    .map((c) => c.id);

  // If not enough from history, pad with fallbacks
  for (const fb of TOP_FALLBACK) {
    if (topParentIds.length >= 5) break;
    const found = parents.find(
      (c) => !topParentIds.includes(c.id) && c.name.toLowerCase().includes(fb)
    );
    if (found) topParentIds.push(found.id);
  }

  // Top income parent ids (all income parent categories)
  const incomeParents = allIncomeCats.filter((c) => !c.parentId);
  const topIncomeParentIds = incomeParents.slice(0, 6).map((c) => c.id);

  // Today's spent
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = state.expenses.list
    .filter((e) => e.date.startsWith(todayStr))
    .reduce((s, e) => s + e.amount, 0);

  const storeProfiles = state.storeProfiles?.profiles ?? {};

  return { userId, currency, categoriesById, topParentIds, incomeCategoriesById, topIncomeParentIds, todaySpent, storeProfiles };
}
