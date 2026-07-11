'use client';

import { useEffect, useRef, useState } from 'react';
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
  /** Per-day allowance from the month remainder (auto/monthly modes). */
  dailyHint?: number;
  onSettings: () => void;
}

export function PinnedToday({ spent, total, currency, dayLabel, budgetMode, dailyHint, onSettings }: PinnedTodayProps) {
  const t = useT();
  const sym = getCurrencySymbol(currency);
  const left = Math.max(0, total - spent);
  const over = Math.max(0, spent - total);
  const spentPct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const isOver = total > 0 && spent > total;

  // The card sticks to the top of the chat scroll area; once the sentinel
  // above it leaves the viewport, the big amount block folds away and only
  // a one-line summary stays pinned.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const modeBadge: Record<BudgetMode, string> = {
    auto:    t('chat.budget.settings.auto'),
    daily:   t('chat.budget.settings.daily'),
    monthly: t('chat.budget.settings.monthly'),
  };

  const inlineAmount = total > 0
    ? isOver
      ? `${t('chat.budget.over')} ${sym} ${over.toLocaleString()}`
      : `${sym} ${left.toLocaleString()}`
    : '—';

  return (
    <>
    <div ref={sentinelRef} style={{ height: 1 }} />
    <div className="sticky top-0 z-20 px-3 pt-2 pb-1" style={{ background: 'hsl(var(--background))' }}>
      <div style={{
        background: 'hsl(var(--card))',
        borderBottom: '2px solid hsl(var(--foreground))',
        padding: compact ? '9px 16px 8px' : '14px 16px 12px',
        transition: 'padding 0.25s ease',
      }}>
        {/* top row: label + mode badge (+ inline amount when compact) + settings */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? 0 : 8, transition: 'margin-bottom 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              {dayLabel}
            </span>
            <span style={{
              fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 900,
              background: 'hsl(var(--foreground))', color: 'hsl(var(--background))',
              padding: '2px 6px', flexShrink: 0,
            }}>
              {modeBadge[budgetMode]}
            </span>
            {compact && (
              <span style={{
                fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
              }}>
                {inlineAmount}
              </span>
            )}
          </div>
          <button
            onClick={onSettings}
            className="flex h-6 w-6 items-center justify-center transition-opacity active:opacity-60 hover:opacity-70"
            style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
          >
            <Settings2 size={13} strokeWidth={2.2} />
          </button>
        </div>

        {/* main amount — folds away in compact mode */}
        <div style={{
          display: 'grid',
          gridTemplateRows: compact ? '0fr' : '1fr',
          transition: 'grid-template-rows 0.25s ease',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{
                  fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                  color: isOver ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                }}>
                  {total > 0 ? `${sym} ${(isOver ? over : left).toLocaleString()}` : '—'}
                </div>
                {total > 0 && (
                  <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    {isOver ? t('chat.budget.over') : `${t('chat.today.of')} ${sym} ${total.toLocaleString()}`}
                  </p>
                )}
                {total > 0 && !isOver && (dailyHint ?? 0) > 0 && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                    ≈ {sym} {dailyHint!.toLocaleString()} {t('chat.today.perDay')}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
                  {t('chat.today.spent')}
                </p>
                <p style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'hsl(var(--foreground))' }}>
                  {spent > 0 ? `${sym}${spent.toLocaleString()}` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* progress bar */}
        {total > 0 && (
          <div style={{ marginTop: compact ? 7 : 10, height: compact ? 2 : 3, background: 'hsl(var(--muted))', transition: 'margin-top 0.25s ease, height 0.25s ease' }}>
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
    </>
  );
}
