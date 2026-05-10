'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const expense = useAppSelector((s) => s.expenses.list.find((e) => e.id === id));

  if (!expense) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">Expense not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 pb-8">
      <div className="flex items-center gap-3 px-4 pt-5 pb-2">
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </button>
        <h1 className="text-lg font-bold">Edit Expense</h1>
      </div>
      <ExpenseForm initialExpense={expense} />
    </div>
  );
}
