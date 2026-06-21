'use client';

import { Settings2 } from 'lucide-react';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import type { Currency } from '@/shared/types';
import type { BudgetMode } from '@/features/ui/store/uiSlice';

interface PinnedTodayProps {
  spent: number;
  total: number;
  currency: Currency;
  dayLabel: string;
  budgetMode: BudgetMode;
  onSettings: () => void;
}

export function PinnedToday({ spent, total, currency, dayLabel, budgetMode, onSettings }: PinnedTodayProps) {
  const t = useT();
  const sym = getCurrencySymbol(currency);
  const left = Math.max(0, total - spent);
  const over = Math.max(0, spent - total);
  const spentPct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const isOver = total > 0 && spent > total;

  const modeBadge: Record<BudgetMode, string> = {
    auto:    t('chat.budget.settings.auto'),
    daily:   t('chat.budget.settings.daily'),
    monthly: t('chat.budget.settings.monthly'),
  };

  return (
    <div className="px-3 pt-2 pb-1" style={{ background: 'hsl(var(--background))' }}>
      <div style={{
        background: 'hsl(var(--card))',
        borderBottom: '2px solid hsl(var(--foreground))',
        padding: '14px 16px 12px',
      }}>
        {/* top row: label + mode badge + settings */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, color: 'hsl(var(--muted-foreground))' }}>
              {dayLabel}
            </span>
            <span style={{
              fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 900,
              background: 'hsl(var(--foreground))', color: 'hsl(var(--background))',
              padding: '2px 6px',
            }}>
              {modeBadge[budgetMode]}
            </span>
          </div>
          <button
            onClick={onSettings}
            className="flex h-6 w-6 items-center justify-center transition-opacity active:opacity-60 hover:opacity-70"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <Settings2 size={13} strokeWidth={2.2} />
          </button>
        </div>

        {/* main amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{
              fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
              color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
            }}>
              {total > 0
                ? `${sym} ${(isOver ? over : left).toLocaleString()}`
                : `${sym} ${spent.toLocaleString()}`
              }
            </div>
            {total > 0 && (
              <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                {isOver ? t('chat.budget.over') : `${t('chat.today.of')} ${sym} ${total.toLocaleString()}`}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
              {t('chat.today.spent')}
            </p>
            <p style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'hsl(var(--foreground))' }}>
              {sym}{spent.toLocaleString()}
            </p>
          </div>
        </div>

        {/* progress bar */}
        {total > 0 && (
          <div style={{ marginTop: 10, height: 3, background: 'hsl(var(--muted))' }}>
            <div style={{
              height: '100%',
              width: `${spentPct}%`,
              background: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
