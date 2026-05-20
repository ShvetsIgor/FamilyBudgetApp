import type { RootState } from '@/store/store';
import type { Category, CategoryFolder, StoreProfile } from '@/shared/types';
import type { Currency } from '@/shared/types';

export interface BotContext {
  userId: string;
  currency: Currency;
  /** All expense categories indexed by id */
  categoriesById: Map<string, Category>;
  /** Expense folders indexed by id — for display path resolution */
  foldersById: Map<string, CategoryFolder>;
  /** Top root categories by usage — for clarify chips */
  topParentIds: string[];
  /** All income categories indexed by id */
  incomeCategoriesById: Map<string, Category>;
  /** Top income root categories — for income clarify chips */
  topIncomeParentIds: string[];
  /** Today's total spent (from Redux expenses slice) */
  todaySpent: number;
  /** Store purchase history — keyed by storeId */
  storeProfiles: Record<string, StoreProfile>;
}

const TOP_FALLBACK = ['groceries', 'dining', 'transport', 'health', 'home', 'shopping'];

/** Returns true for categories that are "root" — not inside a folder */
function isRootCategory(c: Category) {
  return !c.folderId && !c.parentId && !c.archived && c.name !== 'Savings';
}

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

  // Build top category ids from frequency of existing expenses
  const freq: Record<string, number> = {};
  state.expenses.list.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    if (!cat) return;
    // Frequency key: folder ID if exists, else category's own ID
    const key = cat.folderId ?? cat.parentId ?? e.categoryId;
    freq[key] = (freq[key] ?? 0) + 1;
  });

  // Use root categories (no folder/parentId) for chips — those are selectable leaf categories too
  const rootCats = allCats.filter(isRootCategory);
  const topParentIds = rootCats
    .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0))
    .slice(0, 5)
    .map((c) => c.id);

  // Pad with fallbacks
  for (const fb of TOP_FALLBACK) {
    if (topParentIds.length >= 5) break;
    const found = rootCats.find(
      (c) => !topParentIds.includes(c.id) && c.id.includes(fb),
    );
    if (found) topParentIds.push(found.id);
  }

  // Top income root categories
  const incomeRoots = allIncomeCats.filter((c) => !c.parentId && !c.folderId && !c.archived);
  const topIncomeParentIds = incomeRoots.slice(0, 6).map((c) => c.id);

  // Today's spent
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = state.expenses.list
    .filter((e) => e.date.startsWith(todayStr))
    .reduce((s, e) => s + e.amount, 0);

  const storeProfiles = state.storeProfiles?.profiles ?? {};

  return { userId, currency, categoriesById, foldersById, topParentIds, incomeCategoriesById, topIncomeParentIds, todaySpent, storeProfiles };
}
