import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { addCategory } from '@/features/categories/services/categoriesService';
import { queueAddExpense } from '@/features/expenses/services/expensesService';
import { newContributionId } from './savingsService';
import { buildSavingsExpenseComment } from '../utils/savingsExpenseComment';
import type { Category, SavingsContribution, SavingsGoal, SerializableExpense } from '@/shared/types';

export interface ContributionWithExpenseResult {
  /** Goal with the contribution applied */
  goal: SavingsGoal;
  expense: SerializableExpense;
  /** Non-null when the 'Savings' expense category was created on first use */
  createdCategory: Category | null;
}

/**
 * Records a savings contribution together with its linked expense in ONE
 * Firestore transaction (goal update + expense doc + monthlyStats), so a
 * partial failure can never leave the goal balance diverged from the
 * expense history — and the goal is re-read INSIDE the transaction, so
 * concurrent contributions from several members can't overwrite each other.
 * Every contribution entry point (savings page, mobile fast entry, desktop
 * quick-add) must go through this.
 *
 * The expense stores goalId + goalOwnerId + contributionId, so deletion can
 * roll back exactly this contribution later.
 *
 * The 'Savings' category creation stays outside the transaction: it is rare
 * one-time setup and harmless on its own if the transaction later fails.
 */
export async function addContributionWithExpense(params: {
  userId: string;
  goal: SavingsGoal;
  amount: number;
  date: Date;
  /** Localized label, t('savings.expenseLabel') */
  label: string;
  note?: string;
  expenseCategories: Category[];
  /** Explicit category override (savings page lets the user pick one) */
  categoryId?: string;
  /** Caller's display name — required for contributions to another member's goal */
  contributorName?: string;
}): Promise<ContributionWithExpenseResult> {
  const { userId, goal, amount, date, label, note, expenseCategories, categoryId, contributorName } = params;
  const isForeignGoal = goal.userId !== userId;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid-contribution-amount');
  }

  let createdCategory: Category | null = null;
  let catId = categoryId
    ?? expenseCategories.find((c) => c.name === 'Savings' && !c.archived)?.id
    ?? '';
  if (!catId) {
    createdCategory = await addCategory(userId, {
      name: 'Savings', icon: 'coin', color: '#10b981', type: 'expense',
      isPrivate: false, order: 8,
    });
    catId = createdCategory.id;
  }

  const contributionId = newContributionId();
  const goalRef = doc(getDb(), 'savingsGoals', goal.userId, 'goals', goal.id);

  const result = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(goalRef);
    if (!snap.exists()) throw new Error('goal-not-found');
    const data = snap.data();

    const rawContribs = data.contributions;
    const legacyArray = Array.isArray(rawContribs);
    if (legacyArray && isForeignGoal) {
      // Rules only accept map-shaped family updates; the owner's device
      // migrates the shape on their next app open.
      throw new Error('goal-not-migrated');
    }

    const entry: Record<string, unknown> = {
      amount,
      // The contribution shares the expense's date — a payment entered for
      // yesterday must read «yesterday» in the goal's history too, not «today»
      date: date.toISOString(),
      ...(note ? { note } : {}),
      byId: userId,
      ...(isForeignGoal && contributorName ? { byName: contributorName } : {}),
    };
    const currentAmount = ((data.currentAmount as number) ?? 0) + amount;

    if (legacyArray) {
      const migrated: Record<string, unknown> = {};
      for (const c of rawContribs as Record<string, unknown>[]) {
        migrated[newContributionId()] = c;
      }
      migrated[contributionId] = entry;
      tx.update(goalRef, { contributions: migrated, lastContributionId: contributionId, currentAmount });
    } else {
      tx.update(goalRef, {
        [`contributions.${contributionId}`]: entry,
        lastContributionId: contributionId,
        currentAmount,
      });
    }

    // A private goal must never leak through the linked expense: the family
    // would otherwise see its name in the comment and its amounts in the
    // feed, so the expense itself becomes owner-only.
    const expense = queueAddExpense(tx, {
      userId, amount, currency: goal.currency, categoryId: catId,
      date, paymentMethod: 'other',
      comment: buildSavingsExpenseComment(label, goal.name, note),
      tags: ['savings'], privacy: goal.isPrivate ? 'secret' : 'regular',
      splits: [], goalId: goal.id, goalOwnerId: goal.userId, contributionId,
    });

    const appliedContribution: SavingsContribution = {
      id: contributionId,
      amount,
      date: entry.date as string,
      note,
      byId: userId,
      byName: isForeignGoal ? contributorName : undefined,
    };
    const updatedGoal: SavingsGoal = {
      ...goal,
      currentAmount,
      contributions: [...goal.contributions, appliedContribution],
    };
    return { goal: updatedGoal, expense };
  });

  return { ...result, createdCategory };
}
