'use client';

import { Settings2 } from 'lucide-react';
import { C, SHADOW, RAD } from '@/features/chat/styles/tokens';
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
  const pct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const isOver = total > 0 && spent > total;

  const modeBadge: Record<BudgetMode, string> = {
    auto:    t('chat.budget.settings.auto'),
    daily:   t('chat.budget.settings.daily'),
    monthly: t('chat.budget.settings.monthly'),
  };

  return (
    <div className="sticky top-0 z-10 px-3 pt-2 pb-1" style={{ background: C.bg }}>
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5"
        style={{
          borderRadius: RAD.card,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 110%)`,
          boxShadow: SHADOW.pinned,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* decorative circle */}
        <svg style={{ position: 'absolute', top: -18, right: -18, opacity: 0.15, pointerEvents: 'none' }}
          width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>

        {/* left: label + amount */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-[800] uppercase tracking-[.08em] opacity-75" style={{ color: 'white' }}>
              {dayLabel}
            </span>
            <span
              className="rounded-full px-1.5 py-[1px] text-[8.5px] font-[900] uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}
            >
              {modeBadge[budgetMode]}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[22px] font-[900] tabular-nums leading-none"
              style={{ letterSpacing: -0.5, color: isOver ? '#FFD166' : 'white' }}
            >
              {total > 0 ? `${sym}${left.toLocaleString()}` : `${sym}${spent.toLocaleString()}`}
            </span>
            {total > 0 && (
              <span className="text-[11.5px] font-[700] opacity-80" style={{ color: 'white' }}>
                {isOver ? t('chat.budget.over') : `${t('chat.today.of')} ${sym}${total.toLocaleString()}`}
              </span>
            )}
          </div>
        </div>

        {/* right: spent + progress + settings */}
        <div className="flex flex-col items-end gap-1 relative">
          <button
            onClick={onSettings}
            className="flex h-6 w-6 items-center justify-center rounded-full border-0 transition-opacity active:opacity-60"
            style={{ background: 'rgba(255,255,255,.16)', color: 'white' }}
          >
            <Settings2 size={11} strokeWidth={2.8} />
          </button>
          <span className="text-[10.5px] font-[700] opacity-80" style={{ color: 'white' }}>
            {t('chat.today.spent')} {sym}{spent.toLocaleString()}
          </span>
        </div>

        {/* progress bar — full width at bottom */}
        {total > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[3px]"
            style={{ background: 'rgba(255,255,255,.18)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, background: isOver ? '#FFD166' : 'rgba(255,255,255,.9)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
