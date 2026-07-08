import { addCategory } from '@/features/categories/services/categoriesService';
import { addExpense } from '@/features/expenses/services/expensesService';
import { buildSavingsExpenseComment } from '../utils/savingsExpenseComment';
import type { Category, SavingsGoal, SerializableExpense } from '@/shared/types';

export interface SavingsExpenseResult {
  expense: SerializableExpense;
  /** Non-null when the 'Savings' expense category was created on first use */
  createdCategory: Category | null;
}

/**
 * Records the linked expense for a savings contribution, creating the
 * 'Savings' expense category on first use. Every contribution entry point
 * (savings page, mobile fast entry, desktop quick-add) must go through this
 * so month totals stay consistent no matter where the user saved from.
 */
export async function addSavingsExpenseForContribution(params: {
  userId: string;
  goal: SavingsGoal;
  amount: number;
  date: Date;
  /** Localized label, t('savings.expenseLabel') */
  label: string;
  note?: string;
  expenseCategories: Category[];
}): Promise<SavingsExpenseResult> {
  const { userId, goal, amount, date, label, note, expenseCategories } = params;

  let createdCategory: Category | null = null;
  let catId = expenseCategories.find((c) => c.name === 'Savings' && !c.archived)?.id ?? '';
  if (!catId) {
    createdCategory = await addCategory(userId, {
      name: 'Savings', icon: 'coin', color: '#10b981', type: 'expense',
      isPrivate: false, order: 8,
    });
    catId = createdCategory.id;
  }

  const expense = await addExpense({
    userId, amount, currency: goal.currency, categoryId: catId,
    date, paymentMethod: 'other',
    comment: buildSavingsExpenseComment(label, goal.name, note),
    tags: ['savings'], privacy: 'regular', splits: [], goalId: goal.id,
  });

  return { expense, createdCategory };
}
