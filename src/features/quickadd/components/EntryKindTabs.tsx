'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

/**
 * Expense ↔ Income switch in the fast-entry top bar (add mode only), so the
 * central «+» reaches income without the More → Income → FAB detour.
 */
export function EntryKindTabs({ active }: { active: 'expense' | 'income' }) {
  const router = useRouter();
  const t = useT();
  const tabs = [
    { key: 'expense' as const, label: t('quickadd.tabExpense'), href: '/expenses/new' },
    { key: 'income' as const, label: t('quickadd.tabIncome'), href: '/income/new' },
  ];
  return (
    <div className="flex-1 flex items-center justify-center gap-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          onClick={() => { if (tab.key !== active) router.replace(tab.href); }}
          className={cn(
            'min-h-9 rounded-full px-4 text-[11px] font-extrabold uppercase tracking-[.08em] transition-colors',
            tab.key === active
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
