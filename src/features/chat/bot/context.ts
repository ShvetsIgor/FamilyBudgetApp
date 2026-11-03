import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import { computeDailyBudget } from '@/features/budget/utils/dailyBudget';
import type { Category, CategoryFolder, Currency, SerializableExpense } from '@/shared/types';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';
import { splitOwnCurrency } from '@/shared/utils/currencyTotals';
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
  const todaySpent = splitOwnCurrency(
    state.expenses.list.filter((expense) => toLocalDateKey(expense.date) === todayStr),
    currency,
  ).ownTotal;

  return {
    userId,
    currency,
    language: state.ui.language,
    categoriesById,
    foldersById,
    topCategoryIds,
    incomeCategoriesById,
    topIncomeCategoryIds,
    todaySpent,
    suggestionMemory: state.suggestionMemory,
  };
}

/** What the morning card, the weekly summary and the slash reports add up. */
export interface DigestContext extends BotContext {
  /** Account currency only: amounts in different currencies do not add up. */
  allExpenses: SerializableExpense[];
  budgetLimits: Record<string, number>;
  dailyBudget: number;
  todayFree: number;
  firstGoalName?: string;
}

/** Read from the store when it is needed, so the totals cover what has loaded by then. */
export function collectDigestContext(state: RootState, now: Date = new Date()): DigestContext | null {
  const ctx = collectBotContext(state);
  if (!ctx) return null;
  const month = toLocalMonthKey(now);
  const inMonth = (entry: { date: string }) => toLocalMonthKey(entry.date) === month;
  const dailyBudget = computeDailyBudget({
    mode: state.ui.budgetMode,
    dailyLimit: state.ui.budgetDailyLimit,
    monthlyLimit: state.ui.budgetMonthlyLimit,
    monthSpent: splitOwnCurrency(state.expenses.list.filter(inMonth), ctx.currency).ownTotal,
    monthIncome: splitOwnCurrency(state.income.list.filter(inMonth), ctx.currency).ownTotal,
    now,
  });
  return {
    ...ctx,
    allExpenses: state.expenses.list.filter((expense) => expense.currency === ctx.currency),
    budgetLimits: state.budget.limits,
    dailyBudget,
    // Monthly and auto allowances are worked out from the month's spend, today's
    // included; only a fixed daily limit still has today's spend to come off.
    todayFree: state.ui.budgetMode === 'daily' ? Math.max(0, dailyBudget - ctx.todaySpent) : dailyBudget,
    firstGoalName: state.savings.list.find((goal) => !goal.name?.toLowerCase().includes('savings'))?.name,
  };
}
