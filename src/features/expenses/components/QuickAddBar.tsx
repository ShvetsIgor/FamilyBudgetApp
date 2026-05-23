'use client';
/**
 * UNIFIED INPUT BAR — single conversational entry point for all financial intents.
 *
 * UX paths:
 *
 *   INCOME INTENT detected (зарплата 15000, salary 5000, etc.)
 *     → QuickConfirmCard with top income category + [badge: "доход"]
 *     → Secondary: alt income categories, "Записать как расход →" override
 *
 *   HIGH confidence expense (habit / dominant winner)
 *     → QuickConfirmCard: one big button + secondary [Разбить] [alt categories]
 *
 *   MEDIUM confidence expense (confident but competitor exists)
 *     → Two chips + [Другое] link
 *
 *   LOW / clarification
 *     → ClarificationPanel (ambiguous or split stage)
 *
 *   EDITING (no memory signal)
 *     → Category chips (tap to save)
 *
 *   TRANSFER / RECURRING intent
 *     → Small advisory badge (no quick-confirm for these yet)
 *
 *   SAVED
 *     → Brief "✓ Сохранено" feedback, input auto-cleared
 *
 * Architecture:
 *   - Rendering only — all logic in useExpenseInputFlow + useIncomeConfirm
 *   - Both flows share the same parsing + ranking pipeline
 *   - Income saves to shared suggestion memory for ranking continuity
 */

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { useT } from '@/shared/hooks/useT';
import { useExpenseInputFlow } from '@/features/expenses/hooks/useExpenseInputFlow';
import { useIncomeConfirm } from '@/features/expenses/hooks/useIncomeConfirm';
import { shortExplainSuggestion, explainSuggestion } from '@/features/expenses/engine/suggestionEngine';
import { INTENT_LABELS } from '@/features/expenses/engine/intentDetector';
import { QuickConfirmCard, type AltAction } from './QuickConfirmCard';
import { ClarificationPanel } from './ClarificationPanel';
import { cn } from '@/shared/utils/cn';

const PLACEHOLDER_EXAMPLES = ['Dabbah 350', 'Кофе 18', 'Бензин 250'];

export function QuickAddBar({ className }: { className?: string }) {
  const currency = useAppSelector((s) => s.ui.currency);
  const { groups: folders } = useCategoryGroups('expense');
  const { groups: incomeFolders } = useCategoryGroups('income');
  const user = useAppSelector((s) => s.auth.user);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const [input, setInput] = useState('');
  // User can override income intent to proceed with expense flow instead
  const [forceExpense, setForceExpense] = useState(false);

  const flow = useExpenseInputFlow();
  const incomeConfirm = useIncomeConfirm(flow.session);
  const { session, suggestions, stage, saving, confidenceLevel } = flow;

  const amount = session?.detectedAmount;
  const merchant = session?.detectedMerchant;
  const hasAmount = (amount ?? 0) > 0;
  const detectedIntent = session?.detectedIntent ?? null;

  // Auto-clear input when either expense or income save completes
  useEffect(() => {
    if (stage === 'saved' || incomeConfirm.saved) {
      setInput('');
      setForceExpense(false);
    }
  }, [stage, incomeConfirm.saved]);

  const placeholder = PLACEHOLDER_EXAMPLES[
    Math.floor(Date.now() / 60000) % PLACEHOLDER_EXAMPLES.length
  ];

  function handleChange(value: string) {
    setInput(value);
    flow.processInput(value);
    if (forceExpense && value !== input) setForceExpense(false);
  }

  function handleClear() {
    setInput('');
    setForceExpense(false);
    flow.clear();
  }

  if (!user) return null;

  // ── Routing flags ─────────────────────────────────────────────────────────

  // Income confirm activates when income intent detected + amount + income categories exist
  const topIncomeSuggestion = incomeConfirm.suggestions[0];
  const topIncomeCat = topIncomeSuggestion ? incomeFolders.find((f) => f.id === topIncomeSuggestion.categoryId) : null;
  const showIncomeConfirm =
    detectedIntent?.intent === 'income' &&
    hasAmount &&
    !incomeConfirm.saved &&
    !forceExpense &&
    topIncomeSuggestion != null &&
    topIncomeCat != null;

  // Advisory badge for transfer/recurring (no quick-save yet)
  const showIntentBadge =
    detectedIntent &&
    detectedIntent.intent !== 'income' &&
    stage !== 'idle' &&
    stage !== 'saved' &&
    !incomeConfirm.saved;

  // Expense flow: shown when NOT in income confirm
  const showExpenseFlow = !showIncomeConfirm && !incomeConfirm.saved;

  // Expense stage flags (only matter when showExpenseFlow is true)
  const isConfirmHigh   = showExpenseFlow && stage === 'confirm' && confidenceLevel === 'high';
  const isConfirmMedium = showExpenseFlow && stage === 'confirm' && confidenceLevel === 'medium';
  const showChips       = showExpenseFlow && (
    stage === 'editing' || stage === 'parsing' ||
    (stage === 'idle' && suggestions.some((s) => s.score > 0))
  );
  const showClarification = showExpenseFlow && (stage === 'clarification' || stage === 'split');

  // Top expense suggestion for fast-path
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
              if (e.key === 'Enter') {
                if (showIncomeConfirm && topIncomeSuggestion) {
                  incomeConfirm.saveAsIncome(topIncomeSuggestion.categoryId);
                } else if (hasAmount && topSuggestion) {
                  flow.saveWithCategory(topSuggestion.categoryId);
                }
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

      {/* ── INCOME INTENT: quick-confirm card ── */}
      {showIncomeConfirm && topIncomeSuggestion && topIncomeCat && (() => {
        const altIncomeActions: AltAction[] = incomeConfirm.suggestions
          .slice(1, 3)
          .filter((s) => s.score > 0)
          .flatMap((s) => {
            const cat = incomeFolders.find((f) => f.id === s.categoryId);
            if (!cat) return [];
            return [{ label: t.cat(cat.name), onClick: () => incomeConfirm.saveAsIncome(s.categoryId) }];
          });

        return (
          <div className="space-y-1.5">
            <QuickConfirmCard
              icon={topIncomeCat.icon ?? 'box'}
              color={topIncomeCat.color ?? '#4CAF50'}
              name={t.cat(topIncomeCat.name)}
              reason={shortExplainSuggestion(topIncomeSuggestion)}
              amount={amount!}
              symbol={symbol}
              saving={incomeConfirm.saving}
              badge="доход"
              onConfirm={() => incomeConfirm.saveAsIncome(topIncomeSuggestion.categoryId)}
              altActions={altIncomeActions}
              onCancel={handleClear}
            />
            {/* Override: proceed as expense instead */}
            <button
              onClick={() => setForceExpense(true)}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-1 transition-colors"
            >
              Записать как расход →
            </button>
          </div>
        );
      })()}

      {/* ── Advisory badge for transfer / recurring intents ── */}
      {showIntentBadge && (() => {
        const label = INTENT_LABELS[detectedIntent!.intent];
        const isRecurring = detectedIntent!.intent === 'recurring';
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40">
            <span className="text-sm">{isRecurring ? '🔄' : '↔️'}</span>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 flex-1">{label}</span>
          </div>
        );
      })()}

      {/* ── HIGH confidence expense: fast-path confirm (QuickConfirmCard) ── */}
      {isConfirmHigh && topSuggestion && topCat && (() => {
        const c = topCat.color ?? '#E07A5F';
        const altExpenseActions: AltAction[] = suggestions
          .slice(1, 3)
          .filter((s) => s.score > 0)
          .flatMap((s) => {
            const cat = folders.find((f) => f.id === s.categoryId);
            if (!cat) return [];
            return [{ label: t.cat(cat.name), onClick: () => flow.saveWithCategory(s.categoryId) }];
          });

        // Split combo reuse hint
        const splitHint = flow.recentSplitCombos.length > 0 ? (() => {
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
        })() : null;

        return (
          <QuickConfirmCard
            icon={topCat.icon ?? 'box'}
            color={c}
            name={t.cat(topCat.name)}
            reason={explainSuggestion(topSuggestion)}
            amount={amount!}
            symbol={symbol}
            saving={saving}
            onConfirm={() => flow.saveWithCategory(topSuggestion.categoryId)}
            altActions={altExpenseActions}
            splitLabel="Разбить"
            onSplit={() => flow.openSplitEditor(topSuggestion.categoryId)}
            extraHint={splitHint}
            onCancel={handleClear}
          />
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
                  <span className="text-[9px] font-semibold mt-0.5 opacity-60 leading-none" style={{ color: c }}>
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
                  {hasAmount && <span className="font-black opacity-70">{symbol}{amount}</span>}
                </div>
                {shortReason && (
                  <span className="text-[9px] font-semibold mt-0.5 opacity-60 leading-none" style={{ color: c }}>
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

      {/* ── Saved feedback (expense) ── */}
      {stage === 'saved' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/40">
          <svg className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold text-green-700 dark:text-green-400">Сохранено</span>
          {merchant && <span className="text-[11px] text-muted-foreground">· {merchant}</span>}
          {amount && <span className="text-[11px] font-semibold text-muted-foreground ml-auto">{symbol}{amount}</span>}
        </div>
      )}

      {/* ── Saved feedback (income) ── */}
      {incomeConfirm.saved && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/40">
          <svg className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold text-green-700 dark:text-green-400">Сохранено</span>
          <span className="text-[11px] text-muted-foreground">· доход</span>
          {amount && <span className="text-[11px] font-semibold text-muted-foreground ml-auto">{symbol}{amount}</span>}
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
