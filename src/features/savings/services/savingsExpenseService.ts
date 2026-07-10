import { writeBatch } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { addCategory } from '@/features/categories/services/categoriesService';
import { queueAddExpense } from '@/features/expenses/services/expensesService';
import { queueContribution } from './savingsService';
import { buildSavingsExpenseComment } from '../utils/savingsExpenseComment';
import type { Category, SavingsGoal, SerializableExpense } from '@/shared/types';

export interface ContributionWithExpenseResult {
  /** Goal with the contribution applied */
  goal: SavingsGoal;
  expense: SerializableExpense;
  /** Non-null when the 'Savings' expense category was created on first use */
  createdCategory: Category | null;
}

/**
 * Records a savings contribution together with its linked expense in ONE
 * Firestore WriteBatch (goal update + expense doc + monthlyStats), so a
 * partial failure can never leave the goal balance diverged from the
 * expense history. Every contribution entry point (savings page, mobile
 * fast entry, desktop quick-add) must go through this.
 *
 * The 'Savings' category creation stays outside the batch: it is rare
 * one-time setup and harmless on its own if the batch later fails.
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

  const batch = writeBatch(getDb());
  const updatedGoal = queueContribution(batch, goal.userId, goal, {
    amount, note,
    ...(isForeignGoal ? { byId: userId, byName: contributorName } : {}),
  });
  const expense = queueAddExpense(batch, {
    userId, amount, currency: goal.currency, categoryId: catId,
    date, paymentMethod: 'other',
    comment: buildSavingsExpenseComment(label, goal.name, note),
    tags: ['savings'], privacy: 'regular', splits: [], goalId: goal.id,
  });
  await batch.commit();

  return { goal: updatedGoal, expense, createdCategory };
}
