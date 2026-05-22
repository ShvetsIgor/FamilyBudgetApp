'use client';
/**
 * Clarification panel — shown when expense input is ambiguous.
 *
 * Stages it handles:
 *   'clarification' — multiple plausible categories, user must pick
 *   'split'         — large amount, suggest splitting across categories
 *
 * Each suggestion shows its score reason so the user can understand
 * why a category was proposed.
 */

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { explainSuggestion, type ScoredSuggestion } from '@/features/expenses/engine/suggestionEngine';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import type { InputStage } from '@/features/expenses/store/inputSessionSlice';
import { SPLIT_AMOUNT_THRESHOLD } from '@/features/expenses/hooks/useInputSession';
import type { SplitComboEntry } from '@/features/expenses/store/suggestionMemorySlice';

interface Props {
  stage: InputStage;
  amount?: number;
  merchant?: string;
  suggestions: ScoredSuggestion[];
  onSelectCategory: (categoryId: string) => void;
  onSplit: () => void;
  splitCombos?: SplitComboEntry[];
  onUseSplitCombo?: (combo: SplitComboEntry) => void;
}

export function ClarificationPanel({
  stage,
  amount,
  merchant,
  suggestions,
  onSelectCategory,
  onSplit,
}: Props) {
  const { groups: folders } = useCategoryGroups('expense');
  const currency = useAppSelector((s) => s.ui.currency);
  const symbol = getCurrencySymbol(currency);
  const t = useT();

  const visibleSuggestions = suggestions.slice(0, 4);

  if (stage !== 'clarification' && stage !== 'split') return null;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">
              {stage === 'split'
                ? 'Крупная покупка — разбить?'
                : 'Куда записать?'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {merchant && amount
                ? `${merchant} · ${symbol}${amount}`
                : amount
                  ? `${symbol}${amount}`
                  : merchant ?? 'Выберите категорию'}
            </p>
          </div>
          {stage === 'split' && amount && amount >= SPLIT_AMOUNT_THRESHOLD && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              ≥ {symbol}{SPLIT_AMOUNT_THRESHOLD}
            </span>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-3 py-2 space-y-1.5">
        {visibleSuggestions.map((s) => {
          const cat = folders.find((f) => f.id === s.categoryId);
          if (!cat) return null;
          const c = cat.color ?? '#E07A5F';
          const reason = explainSuggestion(s);
          const isFallback = s.score === 0;

          return (
            <button
              key={s.categoryId}
              onClick={() => onSelectCategory(s.categoryId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:opacity-80 active:scale-[0.98]"
              style={{ background: c + '12' }}
            >
              <div
                className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: c + '22' }}
              >
                <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold text-foreground">{t.cat(cat.name)}</p>
                {!isFallback && (
                  <p className="text-[10px] font-semibold" style={{ color: c }}>
                    {reason}
                  </p>
                )}
              </div>
              {amount && (
                <span className="text-sm font-black flex-shrink-0" style={{ color: c }}>
                  {symbol}{amount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Split CTA */}
      <div className="px-3 pb-3">
        <button
          onClick={onSplit}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed text-sm font-bold text-muted-foreground hover:text-foreground hover:border-border transition-all"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 3v18M18 3v18M3 9h18M3 15h18" />
          </svg>
          {stage === 'split'
            ? 'Разбить на категории'
            : 'Уточнить подробнее'}
        </button>
      </div>
    </div>
  );
}
