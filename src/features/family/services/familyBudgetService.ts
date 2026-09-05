import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { fetchSharedMonthExpenses, fetchSharedExpensesInRange } from '@/features/expenses/services/expensesService';
import { fetchSharedMonthIncome, fetchSharedIncomeInRange } from '@/features/income/services/incomeService';
import { fetchSharedGoals } from '@/features/savings/services/savingsService';
import type { Category, Currency, SavingsGoal, SerializableExpense, SerializableIncome, UserProfile } from '@/shared/types';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { groupByCurrency, type CurrencyTotal } from '@/features/family/utils/familyCurrency';

export interface FamilyExpense extends SerializableExpense {
  memberId: string;
  memberName: string;
}

export interface FamilyCategoryMeta {
  name: string;
  icon: string;
  color: string;
}

export interface FamilyMonthData {
  expenses: FamilyExpense[];
  categoryMeta: Record<string, FamilyCategoryMeta>;
}

/**
 * Aggregates the month's shared (non-secret) expenses of every family
 * member. Own categories come from Redux; other members' category names
 * are resolved with per-doc reads — security rules deny private ones,
 * which then simply fall back to a generic label in the UI.
 */
/**
 * A family member's category names, resolved one document at a time.
 *
 * The per-document read is not an oversight: `firestore.rules` allows `list`
 * on `categories/{uid}` to the owner ONLY, so a member can `get` a sibling's
 * non-private category but can never enumerate the collection. What was
 * wasteful was doing it again on every month switch and every navigation into
 * a family view — category names change about never — so the answers (misses
 * included) are cached for the session.
 */
const foreignCategoryCache = new Map<string, FamilyCategoryMeta | null>();

async function resolveForeignCategories(
  entries: Iterable<[string, string]>,
  type: 'expense' | 'income',
  into: Record<string, FamilyCategoryMeta>,
): Promise<void> {
  await Promise.all([...entries].map(async ([catId, memberId]) => {
    const key = `${memberId}|${type}|${catId}`;
    if (foreignCategoryCache.has(key)) {
      const cached = foreignCategoryCache.get(key);
      if (cached) into[catId] = cached;
      return;
    }
    try {
      const snap = await getDoc(doc(getDb(), 'categories', memberId, type, catId));
      if (snap.exists()) {
        const d = snap.data();
        const meta: FamilyCategoryMeta = { name: d.name, icon: d.icon, color: d.color };
        foreignCategoryCache.set(key, meta);
        into[catId] = meta;
      } else {
        foreignCategoryCache.set(key, null);
      }
    } catch {
      // private category — keep hidden, and remember not to ask again
      foreignCategoryCache.set(key, null);
    }
  }));
}

export async function fetchFamilyMonthExpenses(
  members: UserProfile[],
  month: string,
  selfId: string,
  selfCategories: Category[],
): Promise<FamilyMonthData> {
  const perMember = await Promise.all(
    members.map(async (m) => {
      try {
        const list = await fetchSharedMonthExpenses(m.id, month);
        return list.map((e) => ({ ...e, memberId: m.id, memberName: m.name }));
      } catch {
        // Member detached or rules denied — skip instead of failing the view
        return [] as FamilyExpense[];
      }
    }),
  );
  const expenses = perMember.flat().sort((a, b) => b.date.localeCompare(a.date));

  const categoryMeta: Record<string, FamilyCategoryMeta> = {};
  for (const c of selfCategories) {
    categoryMeta[c.id] = { name: c.name, icon: c.icon, color: c.color };
  }

  const foreign = new Map<string, string>();
  for (const e of expenses) {
    if (e.memberId !== selfId && !categoryMeta[e.categoryId]) foreign.set(e.categoryId, e.memberId);
  }
  await resolveForeignCategories(foreign.entries(), 'expense', categoryMeta);

  return { expenses, categoryMeta };
}

export interface FamilyIncome extends SerializableIncome {
  memberId: string;
  memberName: string;
}

export interface FamilyIncomeData {
  incomes: FamilyIncome[];
  categoryMeta: Record<string, FamilyCategoryMeta>;
}

/** Same aggregation as expenses, for the family's non-secret incomes. */
export async function fetchFamilyMonthIncomes(
  members: UserProfile[],
  month: string,
  selfId: string,
  selfIncomeCategories: Category[],
): Promise<FamilyIncomeData> {
  const perMember = await Promise.all(
    members.map(async (m) => {
      try {
        const list = await fetchSharedMonthIncome(m.id, month);
        return list.map((i) => ({ ...i, memberId: m.id, memberName: m.name }));
      } catch {
        return [] as FamilyIncome[];
      }
    }),
  );
  const incomes = perMember.flat().sort((a, b) => b.date.localeCompare(a.date));

  const categoryMeta: Record<string, FamilyCategoryMeta> = {};
  for (const c of selfIncomeCategories) {
    categoryMeta[c.id] = { name: c.name, icon: c.icon, color: c.color };
  }
  const foreign = new Map<string, string>();
  for (const i of incomes) {
    if (i.memberId !== selfId && !categoryMeta[i.categoryId]) foreign.set(i.categoryId, i.memberId);
  }
  await resolveForeignCategories(foreign.entries(), 'income', categoryMeta);

  return { incomes, categoryMeta };
}

export interface FamilyGoal extends SavingsGoal {
  memberId: string;
  memberName: string;
}

/** Savings goals of every family member, with progress. */
export async function fetchFamilyGoals(members: UserProfile[]): Promise<FamilyGoal[]> {
  const perMember = await Promise.all(
    members.map(async (m) => {
      try {
        const goals = await fetchSharedGoals(m.id);
        return goals.map((g) => ({ ...g, memberId: m.id, memberName: m.name }));
      } catch {
        return [] as FamilyGoal[];
      }
    }),
  );
  return perMember.flat();
}

export interface FamilyAnalyticsData {
  byMonth: { name: string; expenses: number; income: number }[];
  byMember: { memberId: string; memberName: string; total: number }[];
  topCategories: { key: string; name: string; icon: string; color: string; total: number }[];
  totalSpent: number;
  totalIncome: number;
  /** Per-currency spent/income — never summed across currencies. */
  spentByCurrency: CurrencyTotal[];
  incomeByCurrency: CurrencyTotal[];
  /** Currency the breakdowns (byMonth/byMember/topCategories) are computed in. */
  primaryCurrency: Currency;
  /** Other currencies present, shown separately in the stat cards. */
  otherCurrencies: Currency[];
}

/**
 * Family analytics over a month range, computed from the same shared
 * (privacy == 'regular') queries as the list views — never from
 * monthlyStats, which include secret entries and would leak their totals.
 * Two range queries per member; category totals merge by category NAME so
 * "Groceries" of different members lands in one bar.
 */
export async function fetchFamilyAnalytics(
  members: UserProfile[],
  monthKeys: string[],
  selfId: string,
  selfCategories: Category[],
  viewerCurrency: Currency,
): Promise<FamilyAnalyticsData> {
  const [fy, fm] = monthKeys[0].split('-').map(Number);
  const [ly, lm] = monthKeys[monthKeys.length - 1].split('-').map(Number);
  const from = new Date(fy, fm - 1, 1);
  const to = new Date(ly, lm, 1);

  const perMember = await Promise.all(members.map(async (m) => {
    const [expenses, incomes] = await Promise.all([
      fetchSharedExpensesInRange(m.id, from, to).catch(() => [] as SerializableExpense[]),
      fetchSharedIncomeInRange(m.id, from, to).catch(() => [] as SerializableIncome[]),
    ]);
    return { member: m, expenses, incomes };
  }));

  const allExpenses = perMember.flatMap((p) => p.expenses);
  const allIncomes = perMember.flatMap((p) => p.incomes);

  // Per-currency totals — the honest headline numbers, never summed across
  // currencies. The comparative breakdowns below are computed in a single
  // primary currency (the largest spend) so bars stay comparable.
  const spentByCurrency = groupByCurrency(allExpenses);
  const incomeByCurrency = groupByCurrency(allIncomes);
  const primaryCurrency = spentByCurrency[0]?.currency ?? incomeByCurrency[0]?.currency ?? viewerCurrency;
  const otherCurrencies = [
    ...new Set([...spentByCurrency, ...incomeByCurrency].map((g) => g.currency)),
  ].filter((c) => c !== primaryCurrency);

  const monthAgg = new Map(monthKeys.map((k) => [k, { name: k.slice(5), expenses: 0, income: 0 }]));
  const byMember: FamilyAnalyticsData['byMember'] = [];
  const catTotals = new Map<string, { total: number; memberId: string }>();

  for (const { member, expenses, incomes } of perMember) {
    let memberTotal = 0;
    for (const e of expenses) {
      if (e.currency !== primaryCurrency) continue; // breakdowns stay single-currency
      // Bucket by the LOCAL calendar month — e.date is a UTC ISO string, and
      // slicing it shifts entries recorded near local midnight into the
      // wrong month (the range queries themselves are local-time based).
      monthAgg.get(toLocalMonthKey(e.date)) && (monthAgg.get(toLocalMonthKey(e.date))!.expenses += e.amount);
      memberTotal += e.amount;
      const cur = catTotals.get(e.categoryId);
      if (cur) cur.total += e.amount;
      else catTotals.set(e.categoryId, { total: e.amount, memberId: member.id });
    }
    for (const i of incomes) {
      if (i.currency !== primaryCurrency) continue;
      monthAgg.get(toLocalMonthKey(i.date)) && (monthAgg.get(toLocalMonthKey(i.date))!.income += i.amount);
    }
    byMember.push({ memberId: member.id, memberName: member.name, total: memberTotal });
  }
  byMember.sort((a, b) => b.total - a.total);

  const totalSpent = spentByCurrency.find((g) => g.currency === primaryCurrency)?.total ?? 0;
  const totalIncome = incomeByCurrency.find((g) => g.currency === primaryCurrency)?.total ?? 0;

  const meta: Record<string, FamilyCategoryMeta> = {};
  for (const c of selfCategories) meta[c.id] = { name: c.name, icon: c.icon, color: c.color };
  await resolveForeignCategories(
    [...catTotals.entries()].filter(([catId]) => !meta[catId]).map(([catId, v]) => [catId, v.memberId] as [string, string]),
    'expense',
    meta,
  );

  const byName = new Map<string, { name: string; icon: string; color: string; total: number }>();
  for (const [catId, v] of catTotals) {
    const m = meta[catId];
    const name = m?.name ?? '—';
    const key = name.toLowerCase();
    const cur = byName.get(key);
    if (cur) cur.total += v.total;
    else byName.set(key, { name, icon: m?.icon ?? 'box', color: m?.color ?? '#8AA9D6', total: v.total });
  }
  const topCategories = [...byName.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return {
    byMonth: [...monthAgg.values()], byMember, topCategories, totalSpent, totalIncome,
    spentByCurrency, incomeByCurrency, primaryCurrency, otherCurrencies,
  };
}

/**
 * Sets or clears the caller's emoji reaction on a family member's expense.
 * Security rules restrict cross-user updates to the reactions field only.
 */
export async function setExpenseReaction(
  ownerId: string,
  expenseId: string,
  reactorId: string,
  emoji: string | null,
): Promise<void> {
  await updateDoc(doc(getDb(), 'expenses', ownerId, 'items', expenseId), {
    [`reactions.${reactorId}`]: emoji ?? deleteField(),
  });
}
