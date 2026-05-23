'use client';
/**
 * Quick-add bar — staged text-based expense entry.
 *
 * This component is responsible for:
 *   - Rendering the input field
 *   - Displaying suggestion chips with reason labels
 *   - Delegating ALL flow logic to useExpenseInputFlow
 *
 * It does NOT: parse input, compute rankings, manage session stages,
 * dispatch to slices, or orchestrate saves. That's the flow hook's job.
 *
 * Stages rendered:
 *   idle / editing → suggestion chips with optional reason labels
 *   confirm        → chips + amount preview + "tap to save" hint
 *   clarification  → ClarificationPanel (ambiguous suggestions)
 *   split          → ClarificationPanel with split CTA
 *   parsing        → chips (waiting for amount)
 */

import { useState } from 'react';
import { useAppSelector } from '@/store/store';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { useT } from '@/shared/hooks/useT';
import { useExpenseInputFlow } from '@/features/expenses/hooks/useExpenseInputFlow';
import { shortExplainSuggestion } from '@/features/expenses/engine/suggestionEngine';
import { ClarificationPanel } from './ClarificationPanel';
import { cn } from '@/shared/utils/cn';

const PLACEHOLDER_EXAMPLES = ['Dabbah 350', 'Кофе 18', 'Бензин 250'];

export function QuickAddBar({ className }: { className?: string }) {
  const currency = useAppSelector((s) => s.ui.currency);
  const { groups: folders } = useCategoryGroups('expense');
  const user = useAppSelector((s) => s.auth.user);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  // Local UI state only — input text is not in Redux
  const [input, setInput] = useState('');

  const flow = useExpenseInputFlow();
  const { session, suggestions, stage, saving, habitSuggestion } = flow;

  const amount = session?.detectedAmount;
  const merchant = session?.detectedMerchant;
  const hasAmount = (amount ?? 0) > 0;

  const placeholder = PLACEHOLDER_EXAMPLES[
    Math.floor(Date.now() / 60000) % PLACEHOLDER_EXAMPLES.length
  ];

  function handleChange(value: string) {
    setInput(value);
    flow.processInput(value);
  }

  function handleClear() {
    setInput('');
    flow.clear();
  }

  if (!user) return null;

  // Chip suggestions to display (confirm / editing / idle / parsing)
  const chipSuggestions = suggestions.slice(0, 3);
  const showChips = stage === 'confirm' || stage === 'editing' || stage === 'idle' || stage === 'parsing';
  const showClarification = stage === 'clarification' || stage === 'split';

  return (
    <div className={cn('space-y-2', className)}>
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasAmount && chipSuggestions[0]) {
                flow.saveWithCategory(chipSuggestions[0].categoryId);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-2xl bg-card border border-border px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {input && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => flow.openSplitEditor()}
          className="h-11 w-11 flex items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex-shrink-0"
          title="Подробная запись"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Amount preview — confirm and editing stages */}
      {hasAmount && (stage === 'confirm' || stage === 'editing') && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Сумма:</span>
          <span className="text-sm font-black text-foreground">{symbol}{amount}</span>
          {merchant && (
            <>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[140px]">
                {merchant}
              </span>
            </>
          )}
          {stage === 'confirm' && (
            <span className="ml-auto text-[10px] font-bold text-green-600 dark:text-green-400">
              Нажмите ↓
            </span>
          )}
        </div>
      )}

      {/* Suggestion chips — with reason labels when non-fallback */}
      {showChips && chipSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chipSuggestions.map((s) => {
            const cat = folders.find((f) => f.id === s.categoryId);
            if (!cat) return null;
            const c = cat.color ?? '#E07A5F';
            const isSaving = saving && s.categoryId === chipSuggestions[0]?.categoryId;
            const shortReason = shortExplainSuggestion(s);

            return (
              <button
                key={s.categoryId}
                onClick={() =>
                  hasAmount
                    ? flow.saveWithCategory(s.categoryId)
                    : flow.openSplitEditor(s.categoryId)
                }
                disabled={saving}
                className={cn(
                  'flex flex-col items-start px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                  hasAmount ? 'active:scale-95 hover:opacity-80' : 'opacity-60',
                )}
                style={{ background: c + '18', borderColor: c + '44' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: c }}>
                  <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-3.5 w-3.5" />
                  <span>{t.cat(cat.name)}</span>
                  {isSaving && <span className="opacity-50">…</span>}
                  {hasAmount && !isSaving && (
                    <span className="font-black opacity-70">{symbol}{amount}</span>
                  )}
                </div>
                {shortReason && (
                  <span
                    className="text-[9px] font-semibold mt-0.5 opacity-60 leading-none"
                    style={{ color: c }}
                  >
                    {shortReason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Clarification panel — ambiguous or split stages */}
      {showClarification && (
        <ClarificationPanel
          stage={stage}
          amount={amount}
          merchant={merchant}
          suggestions={suggestions}
          onSelectCategory={(id) =>
            hasAmount ? flow.saveWithCategory(id) : flow.openSplitEditor(id)
          }
          onSplit={() => flow.openSplitEditor()}
          splitCombos={flow.recentSplitCombos}
          onUseSplitCombo={flow.openSplitEditorWithCombo}
        />
      )}

      {/* First-use hint */}
      {stage === 'idle' && !input && !flow.hasContext && (
        <p className="text-[11px] text-muted-foreground px-1">
          Введите сумму + название — или просто выберите категорию
        </p>
      )}

      {/* Returning-user hint: show recent merchant */}
      {stage === 'idle' && !input && flow.hasContext && flow.recentMerchants[0] && (
        <p className="text-[11px] text-muted-foreground px-1">
          Недавно: <span className="font-semibold">{flow.recentMerchants[0].key}</span>
        </p>
      )}
    </div>
  );
}
