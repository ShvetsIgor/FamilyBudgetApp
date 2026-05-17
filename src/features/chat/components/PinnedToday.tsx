'use client';

import { Settings2 } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
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
  const spentPct = total > 0 ? Math.round((spent / total) * 100) : 0;
  const isOver = total > 0 && spent > total;

  const modeBadge: Record<BudgetMode, string> = {
    auto:    t('chat.budget.settings.auto'),
    daily:   t('chat.budget.settings.daily'),
    monthly: t('chat.budget.settings.monthly'),
  };

  return (
    <div
      className="sticky top-0 z-10 px-3.5 pt-3 pb-1"
      style={{ background: C.bg }}
    >
      <div
        className="overflow-hidden"
        style={{
          padding: '14px 18px 14px 16px',
          borderRadius: RAD.hero,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 110%)`,
          color: 'white',
          position: 'relative',
          boxShadow: SHADOW.pinned,
        }}
      >
        <svg
          style={{ position: 'absolute', top: -20, right: -28, opacity: 0.25, pointerEvents: 'none' }}
          width="120" height="120" viewBox="0 0 120 120"
        >
          <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="60" cy="60" r="44" stroke="white" strokeWidth="1" fill="none" opacity=".7" />
        </svg>

        <div className="relative flex items-start gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}
          >
            <StickerIcon icon="coin" color={C.yellow} className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="m-0 text-[11px] font-[800] uppercase tracking-[.09em] opacity-80">{dayLabel}</p>
              <span
                className="rounded-full px-1.5 py-[1px] text-[9px] font-[900] uppercase tracking-wider"
                style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}
              >
                {modeBadge[budgetMode]}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[30px] font-[900] tabular-nums" style={{ letterSpacing: -0.8, color: isOver ? '#FFD166' : 'white' }}>
                {total > 0 ? `${sym}${left.toLocaleString()}` : `${sym}${spent.toLocaleString()}`}
              </span>
              {total > 0 && (
                <span className="text-[13px] font-[800] opacity-80">
                  {isOver ? t('chat.budget.over') : `${t('chat.today.of')} ${sym}${total.toLocaleString()}`}
                </span>
              )}
            </div>
            <p className="m-0 mt-0.5 text-[12px] font-[700] opacity-85">
              {t('chat.today.spent')} {sym}{spent.toLocaleString()}
              {total > 0 && ` · ${t('chat.today.spentPct').replace('{pct}', String(spentPct))}`}
            </p>
          </div>
          <button
            onClick={onSettings}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-0 transition-opacity active:opacity-60"
            style={{ background: 'rgba(255,255,255,.16)', color: 'white' }}
          >
            <Settings2 size={13} strokeWidth={2.8} />
          </button>
        </div>

        {total > 0 && (
          <div
            className="relative mt-3 h-[5px] overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,.22)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: isOver ? '#FFD166' : 'rgba(255,255,255,.95)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
