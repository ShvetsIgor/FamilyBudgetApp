import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import type { Category, CategoryFolder, Currency, StoreProfile } from '@/shared/types';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import type { RootState } from '@/store/store';

export interface BotContext {
  userId: string;
  currency: Currency;
  language: string;
  categoriesById: Map<string, Category>;
  foldersById: Map<string, CategoryFolder>;
  topCategoryIds: string[];
  incomeCategoriesById: Map<string, Category>;
  topIncomeCategoryIds: string[];
  todaySpent: number;
  storeProfiles: Record<string, StoreProfile>;
  suggestionMemory: SuggestionMemoryState;
}

const TOP_FALLBACK = ['groceries', 'dining', 'transport', 'health', 'home', 'shopping'];

export function collectBotContext(state: RootState): BotContext | null {
  const userId = state.auth.user?.id;
  if (!userId) return null;

  const currency = state.ui.currency;
  const allCats = state.categories.expense;
  const allIncomeCats = state.categories.income;

  const categoriesById = new Map<string, Category>();
  allCats.forEach((category) => categoriesById.set(category.id, category));

  const incomeCategoriesById = new Map<string, Category>();
  allIncomeCats.forEach((category) => incomeCategoriesById.set(category.id, category));

  const foldersById = new Map<string, CategoryFolder>();
  (state.categories.folders.expense ?? []).forEach((folder) => foldersById.set(folder.id, folder));

  const freq: Record<string, number> = {};
  state.expenses.list.forEach((expense) => {
    freq[expense.categoryId] = (freq[expense.categoryId] ?? 0) + 1;
  });

  const rootCats = allCats.filter((category) => !category.archived);
  const topCategoryIds = rootCats
    .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0))
    .slice(0, 5)
    .map((category) => category.id);

  for (const fallback of TOP_FALLBACK) {
    if (topCategoryIds.length >= 5) break;
    const found = rootCats.find(
      (category) => !topCategoryIds.includes(category.id) && category.id.includes(fallback),
    );
    if (found) topCategoryIds.push(found.id);
  }

  const incomeRoots = allIncomeCats.filter((category) => !category.archived);
  const topIncomeCategoryIds = incomeRoots.slice(0, 6).map((category) => category.id);

  const todayStr = toLocalDateKey(new Date());
  const todaySpent = state.expenses.list
    .filter((expense) => expense.date.startsWith(todayStr))
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    userId,
    currency,
    categoriesById,
    foldersById,
    topCategoryIds,
    incomeCategoriesById,
    topIncomeCategoryIds,
    todaySpent,
    storeProfiles: state.storeProfiles?.profiles ?? {},
    suggestionMemory: state.suggestionMemory,
  };
}
