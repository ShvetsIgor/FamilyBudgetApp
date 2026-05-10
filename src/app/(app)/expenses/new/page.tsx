import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewExpensePage() {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/home" className="rounded-full p-2 hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Add Expense</h1>
      </div>
      <ExpenseForm />
    </div>
  );
}
