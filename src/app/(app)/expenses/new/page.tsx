'use client';

import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/shared/hooks/useT';

export default function NewExpensePage() {
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/home" className="rounded-full p-2 hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">{t('expense.title')}</h1>
      </div>
      <ExpenseForm />
    </div>
  );
}
