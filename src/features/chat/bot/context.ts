import type { RootState } from '@/store/store';
import type { Category, CategoryFolder, StoreProfile } from '@/shared/types';
import type { Currency } from '@/shared/types';


export interface BotContext {
  userId: string;
  currency: Currency;
  /** All expense categories indexed by id */
  categoriesById: Map<string, Category>;
  /** Expense folders indexed by id — for display path text only, never for routing logic */
  foldersById: Map<string, CategoryFolder>;
  /** Top categories by usage — for clarify chips */
  topCategoryIds: string[];
  /** All income categories indexed by id */
  incomeCategoriesById: Map<string, Category>;
  /** Top income categories — for income clarify chips */
  topIncomeCategoryIds: string[];
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

  const foldersById = new Map<string, CategoryFolder>();
  (state.categories.folders.expense ?? []).forEach((f) => foldersById.set(f.id, f));

  // Frequency of each category from expense history — domain layer uses categoryId only
  const freq: Record<string, number> = {};
  state.expenses.list.forEach((e) => {
    freq[e.categoryId] = (freq[e.categoryId] ?? 0) + 1;
  });

  // Top categories: root-level only (no legacy parentId), sorted by usage
  const rootCats = allCats.filter(isRootCategory);
  const topCategoryIds = rootCats
    .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0))
    .slice(0, 5)
    .map((c) => c.id);

  // Pad with fallbacks
  for (const fb of TOP_FALLBACK) {
    if (topCategoryIds.length >= 5) break;
    const found = rootCats.find(
      (c) => !topCategoryIds.includes(c.id) && c.id.includes(fb),
    );
    if (found) topCategoryIds.push(found.id);
  }

  // Top income categories
  const incomeRoots = allIncomeCats.filter(isRootCategory);
  const topIncomeCategoryIds = incomeRoots.slice(0, 6).map((c) => c.id);

  // Today's spent
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = state.expenses.list
    .filter((e) => e.date.startsWith(todayStr))
    .reduce((s, e) => s + e.amount, 0);

  const storeProfiles = state.storeProfiles?.profiles ?? {};

  return { userId, currency, categoriesById, foldersById, topCategoryIds, incomeCategoriesById, topIncomeCategoryIds, todaySpent, storeProfiles };
}
