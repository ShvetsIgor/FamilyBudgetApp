'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { closeQuickAdd, setQuickAddTab } from '@/features/quickadd/store/quickAddSlice';
import { cn } from '@/shared/utils/cn';
import { ExpenseDrawerForm } from './ExpenseDrawerForm';
import { IncomeDrawerForm } from './IncomeDrawerForm';
import { SavingsDrawerForm } from './SavingsDrawerForm';

const TABS = [
  { key: 'expense' as const, label: 'Расход',     accent: '#E07A5F' },
  { key: 'income'  as const, label: 'Доход',      accent: '#81B29A' },
  { key: 'savings' as const, label: 'В копилку',  accent: '#A48BC9' },
];

export function AddDrawer() {
  const dispatch = useAppDispatch();
  const { open, tab } = useAppSelector((s) => s.quickAdd);

  const accent = TABS.find((t) => t.key === tab)?.accent ?? '#E07A5F';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) dispatch(closeQuickAdd()); }}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Drawer panel */}
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-screen w-[600px] flex flex-col bg-background shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300 ease-out',
          )}
          aria-describedby={undefined}
        >
          {/* ── Tab bar ── */}
          <div className="flex items-center gap-0 border-b border-border flex-shrink-0 px-2 pt-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => dispatch(setQuickAddTab(t.key))}
                  className="relative px-4 py-2.5 text-sm font-bold transition-colors rounded-t-xl"
                  style={{ color: active ? t.accent : 'hsl(var(--muted-foreground))' }}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full"
                      style={{ background: t.accent }}
                    />
                  )}
                </button>
              );
            })}
            <div className="ml-auto">
              <Dialog.Close asChild>
                <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground mr-1">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === 'expense' && <ExpenseDrawerForm accent={accent} />}
            {tab === 'income'  && <IncomeDrawerForm  accent={accent} />}
            {tab === 'savings' && <SavingsDrawerForm accent={accent} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
