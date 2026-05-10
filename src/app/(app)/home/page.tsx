import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center px-4 pt-8 gap-8">
      {/* Month summary card */}
      <div className="w-full max-w-sm rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <p className="text-sm font-medium opacity-80">This Month</p>
        <p className="mt-1 text-3xl font-bold">₪0</p>
        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="opacity-70">Income</p>
            <p className="font-semibold">₪0</p>
          </div>
          <div className="text-right">
            <p className="opacity-70">Expenses</p>
            <p className="font-semibold">₪0</p>
          </div>
        </div>
      </div>

      {/* Quick add button */}
      <Link href="/expenses/new">
        <button
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-95 transition-transform"
          aria-label="Add expense"
        >
          <Plus className="h-9 w-9" />
        </button>
      </Link>
      <p className="text-sm text-muted-foreground -mt-4">Add Expense</p>

      {/* Recent expenses placeholder */}
      <div className="w-full max-w-sm">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No expenses yet</p>
        </div>
      </div>
    </div>
  );
}
