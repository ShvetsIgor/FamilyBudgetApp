'use client';
/**
 * Quick-add bar — confidence-driven expense input.
 *
 * UX paths based on confidence level:
 *
 *   HIGH confidence (habit / dominant winner)
 *     → FastConfirmCard: one big button + secondary [Разбить] [alt categories]
 *
 *   MEDIUM confidence (confident but competitor exists)
 *     → Two chips + [Другое] link
 *
 *   LOW / clarification
 *     → ClarificationPanel (ambiguous or split stage)
 *
 *   EDITING (no memory signal)
 *     → Category chips (tap to save)
 *
 *   SAVED
 *     → Brief "✓ Сохранено" feedback, input auto-cleared
 *
 * This component renders only — all logic lives in useExpenseInputFlow.
 */

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { useT } from '@/shared/hooks/useT';
import { useExpenseInputFlow } from '@/features/expenses/hooks/useExpenseInputFlow';
import { explainSuggestion, shortExplainSuggestion } from '@/features/expenses/engine/suggestionEngine';
import { INTENT_LABELS, INTENT_ROUTE } from '@/features/expenses/engine/intentDetector';
import { ClarificationPanel } from './ClarificationPanel';
import { cn } from '@/shared/utils/cn';

const PLACEHOLDER_EXAMPLES = ['Dabbah 350', 'Кофе 18', 'Бензин 250'];

export function QuickAddBar({ className }: { className?: string }) {
  const currency = useAppSelector((s) => s.ui.currency);
  const { groups: folders } = useCategoryGroups('expense');
  const user = useAppSelector((s) => s.auth.user);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const [input, setInput] = useState('');

  const flow = useExpenseInputFlow();
  const { session, suggestions, stage, saving, confidenceLevel } = flow;

  const amount = session?.detectedAmount;
  const merchant = session?.detectedMerchant;
  const hasAmount = (amount ?? 0) > 0;

  // Auto-clear input when save completes
  useEffect(() => {
    if (stage === 'saved') setInput('');
  }, [stage]);

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

  // ── Stage flags ───────────────────────────────────────────────────────────

  const isConfirmHigh   = stage === 'confirm' && confidenceLevel === 'high';
  const isConfirmMedium = stage === 'confirm' && confidenceLevel === 'medium';
  const showChips       = stage === 'editing' || stage === 'parsing' ||
                          (stage === 'idle' && suggestions.some((s) => s.score > 0));
  const showClarification = stage === 'clarification' || stage === 'split';

  // Top suggestion lookup for fast-path
  const topSuggestion = suggestions[0];
  const topCat = topSuggestion ? folders.find((f) => f.id === topSuggestion.categoryId) : null;

  return (
    <div className={cn('space-y-2', className)}>

      {/* ── Input row ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasAmount && topSuggestion) {
                flow.saveWithCategory(topSuggestion.categoryId);
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

      {/* ── HIGH confidence: fast-path confirm ── */}
      {isConfirmHigh && topSuggestion && topCat && (() => {
        const c = topCat.color ?? '#E07A5F';
        const altSuggestions = suggestions.slice(1, 3).filter((s) => s.score > 0);

        return (
          <div className="space-y-1.5">
            {/* Primary confirm button */}
            <button
              onClick={() => flow.saveWithCategory(topSuggestion.categoryId)}
              disabled={saving}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-white font-black active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ background: c, boxShadow: `0 8px 20px ${c}55` }}
            >
              <div className="flex items-center gap-3">
                <StickerIcon icon={topCat.icon ?? 'box'} color="#fff" className="h-5 w-5 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-sm leading-tight">{t.cat(topCat.name)}</div>
                  <div className="text-[10px] opacity-70 font-semibold leading-tight mt-0.5">
                    {explainSuggestion(topSuggestion)}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg leading-tight tabular-nums">{symbol}{amount}</div>
                {saving && <div className="text-[10px] opacity-70 mt-0.5">…</div>}
              </div>
            </button>

            {/* Secondary actions row */}
            <div className="flex items-center gap-3 px-1 flex-wrap">
              <button
                onClick={() => flow.openSplitEditor(topSuggestion.categoryId)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Разбить
              </button>
              {altSuggestions.map((s) => {
                const cat = folders.find((f) => f.id === s.categoryId);
                if (!cat) return null;
                return (
                  <button
                    key={s.categoryId}
                    onClick={() => flow.saveWithCategory(s.categoryId)}
                    disabled={saving}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.cat(cat.name)}
                  </button>
                );
              })}
              <button
                onClick={handleClear}
                className="ml-auto text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
            </div>

            {/* Split-combo reuse hint */}
            {flow.recentSplitCombos.length > 0 && (() => {
              const combo = flow.recentSplitCombos[0];
              const comboCats = combo.categoryIds
                .map((id) => folders.find((f) => f.id === id))
                .filter(Boolean);
              if (comboCats.length < 2) return null;
              return (
                <button
                  onClick={() => flow.openSplitEditorWithCombo(combo)}
                  className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M6 3v18M18 3v18M3 9h18M3 15h18" />
                  </svg>
                  Как в прошлый раз ({combo.categoryIds.length} позиции)
                </button>
              );
            })()}
          </div>
        );
      })()}

      {/* ── MEDIUM confidence: two chips + "Другое" ── */}
      {isConfirmMedium && (
        <div className="flex flex-wrap gap-2 items-center">
          {suggestions.slice(0, 2).map((s) => {
            const cat = folders.find((f) => f.id === s.categoryId);
            if (!cat) return null;
            const c = cat.color ?? '#E07A5F';
            const isSaving = saving && s.categoryId === suggestions[0]?.categoryId;
            const shortReason = shortExplainSuggestion(s);
            const isHabit = s.reasons.some((r) => r.kind === 'habit');

            return (
              <button
                key={s.categoryId}
                onClick={() => flow.saveWithCategory(s.categoryId)}
                disabled={saving}
                className="flex flex-col items-start px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 hover:opacity-80"
                style={{
                  background: isHabit ? c + '28' : c + '18',
                  borderColor: isHabit ? c + '88' : c + '44',
                }}
              >
                <div className="flex items-center gap-1.5" style={{ color: c }}>
                  <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-3.5 w-3.5" />
                  <span>{t.cat(cat.name)}</span>
                  {isSaving && <span className="opacity-50">…</span>}
                  {!isSaving && <span className="font-black opacity-70">{symbol}{amount}</span>}
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
          <button
            onClick={() => flow.openSplitEditor()}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
          >
            Другое
          </button>
        </div>
      )}

      {/* ── EDITING / PARSING: category chips (tap to save if amount present) ── */}
      {showChips && suggestions.slice(0, 3).filter((s) => s.score > 0 || !hasAmount).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 3).map((s) => {
            const cat = folders.find((f) => f.id === s.categoryId);
            if (!cat) return null;
            const c = cat.color ?? '#E07A5F';
            const shortReason = shortExplainSuggestion(s);

            return (
              <button
                key={s.categoryId}
                onClick={() =>
                  hasAmount ? flow.saveWithCategory(s.categoryId) : flow.openSplitEditor(s.categoryId)
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
                  {hasAmount && (
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

      {/* ── Clarification panel (ambiguous / split) ── */}
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

      {/* ── Saved feedback ── */}
      {stage === 'saved' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/40">
          <svg className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold text-green-700 dark:text-green-400">Сохранено</span>
          {merchant && (
            <span className="text-[11px] text-muted-foreground">· {merchant}</span>
          )}
          {amount && (
            <span className="text-[11px] font-semibold text-muted-foreground ml-auto">{symbol}{amount}</span>
          )}
        </div>
      )}

      {/* ── Idle hints ── */}
      {stage === 'idle' && !input && !flow.hasContext && (
        <p className="text-[11px] text-muted-foreground px-1">
          Введите сумму + название — или просто выберите категорию
        </p>
      )}
      {stage === 'idle' && !input && flow.hasContext && flow.recentMerchants[0] && (
        <p className="text-[11px] text-muted-foreground px-1">
          Недавно: <span className="font-semibold">{flow.recentMerchants[0].key}</span>
        </p>
      )}

    </div>
  );
}
