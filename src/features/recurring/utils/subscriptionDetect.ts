import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { normalizeNameKey } from '@/shared/utils/normalizeName';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import type { Currency, SerializableExpense, SerializableRecurringPayment } from '@/shared/types';

/**
 * Detects subscription-shaped spending in expense history: same merchant,
 * near-equal amount, ~monthly cadence. A suggestion signal only — nothing is
 * ever auto-created.
 *
 * A merchant qualifies when:
 *  - it has ≥ 3 charges (after collapsing same-day duplicates), and the last
 *    three consecutive gaps between charges are each 25–35 days;
 *  - those last three amounts stay within ±15% of their median;
 *  - the latest charge is ≤ 40 days old (otherwise it likely ended);
 *  - none of its charges came from an existing recurring template
 *    (recurringId / 'recurring' tag), no splits;
 *  - the merchant is not already covered by a template with the same
 *    normalized name and is not in the dismissed list.
 */

export interface SubscriptionCandidate {
  /** Stable dismissal key: merchant id/name + currency */
  key: string;
  displayName: string;
  /** Latest charged amount — the current price */
  amount: number;
  currency: Currency;
  categoryId: string;
  occurrences: number;
  /** First strictly-future expected charge, ISO — safe as a template start
   *  date (no initial-occurrence backfill duplicating logged expenses) */
  suggestedStartDate: string;
}

type DetectExpense = Pick<
  SerializableExpense,
  'amount' | 'currency' | 'categoryId' | 'date' | 'store' | 'storeId' | 'recurringId' | 'isRecurring' | 'tags' | 'splits'
>;

const MIN_GAP_DAYS = 25;
const MAX_GAP_DAYS = 35;
const MAX_AMOUNT_DRIFT = 0.15;
const MAX_STALE_DAYS = 40;

export function detectSubscriptionCandidates(args: {
  expenses: DetectExpense[];
  templates: Pick<SerializableRecurringPayment, 'name'>[];
  dismissedKeys?: string[];
  now?: Date;
}): SubscriptionCandidate[] {
  const { expenses, templates, dismissedKeys = [], now = new Date() } = args;
  const dismissed = new Set(dismissedKeys);
  const templateNames = new Set(templates.map((tpl) => normalizeNameKey(tpl.name)));

  const groups = new Map<string, DetectExpense[]>();
  for (const e of expenses) {
    if (e.recurringId || e.isRecurring || e.tags?.includes('recurring')) continue;
    if (e.splits?.length) continue;
    const merchant = e.storeId || (e.store ? normalizeNameKey(e.store) : '');
    if (!merchant) continue;
    const key = `${merchant}::${e.currency}`;
    if (dismissed.has(key) || templateNames.has(merchant)) continue;
    const group = groups.get(key);
    if (group) group.push(e); else groups.set(key, [e]);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [key, group] of groups) {
    // Collapse same-day duplicates (double-logged charges break gap math)
    const byDay = new Map<string, DetectExpense>();
    for (const e of group) byDay.set(toLocalDateKey(e.date), e);
    const charges = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (charges.length < 3) continue;

    const lastThree = charges.slice(-3);
    const dates = lastThree.map((e) => parseISO(e.date));
    const gapsMonthly = [1, 2].every((i) => {
      const gap = differenceInCalendarDays(dates[i], dates[i - 1]);
      return gap >= MIN_GAP_DAYS && gap <= MAX_GAP_DAYS;
    });
    if (!gapsMonthly) continue;

    const amounts = lastThree.map((e) => e.amount).sort((a, b) => a - b);
    const median = amounts[1];
    if (median <= 0) continue;
    if (!amounts.every((a) => Math.abs(a - median) / median <= MAX_AMOUNT_DRIFT)) continue;

    const latest = lastThree[lastThree.length - 1];
    if (differenceInCalendarDays(now, parseISO(latest.date)) > MAX_STALE_DAYS) continue;

    let nextCharge = addMonths(parseISO(latest.date), 1);
    while (nextCharge <= now) nextCharge = addMonths(nextCharge, 1);

    candidates.push({
      key,
      displayName: latest.store || latest.storeId || key,
      amount: latest.amount,
      currency: latest.currency,
      categoryId: latest.categoryId,
      occurrences: charges.length,
      suggestedStartDate: nextCharge.toISOString(),
    });
  }

  return candidates.sort((a, b) => b.amount - a.amount);
}
