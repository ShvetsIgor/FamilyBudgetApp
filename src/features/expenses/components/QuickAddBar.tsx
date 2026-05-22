'use client';
/**
 * Quick-add bar — staged text-based expense entry.
 *
 * Stages:
 *   idle / parsing   → shows hint + default category chips
 *   confirm          → shows amount preview + one-tap save chips
 *   clarification    → shows ClarificationPanel (ambiguous suggestions)
 *   split            → shows ClarificationPanel with split CTA
 *   editing          → shows amount preview + all category chips (no memory signal)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { recordExpense } from '@/features/expenses/store/suggestionMemorySlice';
import { setDraft } from '@/features/expenses/store/draftSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { useT } from '@/shared/hooks/useT';
import { useInputSession } from '@/features/expenses/hooks/useInputSession';
import { ClarificationPanel } from './ClarificationPanel';
import { cn } from '@/shared/utils/cn';

const PLACEHOLDER_EXAMPLES = ['Dabbah 350', 'Кофе 18', 'Бензин 250'];

export function QuickAddBar({ className }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { groups: folders } = useCategoryGroups('expense');
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const [input, setInput] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const { session, suggestions, processInput, requestSplit, clear } = useInputSession();

  const stage = session?.stage ?? 'idle';
  const amount = session?.detectedAmount;
  const merchant = session?.detectedMerchant;
  const hasAmount = (amount ?? 0) > 0;

  const placeholder = PLACEHOLDER_EXAMPLES[
    Math.floor(Date.now() / 60000) % PLACEHOLDER_EXAMPLES.length
  ];

  function handleInputChange(value: string) {
    setInput(value);
    if (value.trim()) {
      processInput(value);
    } else {
      clear();
    }
  }

  async function saveWithCategory(categoryId: string) {
    if (!user || !hasAmount || saving) return;
    setSaving(categoryId);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const exp = await addExpense({
        userId: user.id,
        currency,
        amount: amount!,
        categoryId,
        date: new Date(),
        paymentMethod: 'card',
        tags: [],
        privacy: 'regular',
        splits: [],
        ...(merchant ? { store: merchant } : {}),
      });
      dispatch(prependExpense(exp));
      dispatch(recordExpense({ merchant, categoryId, date: today }));
      setInput('');
      clear();
    } finally {
      setSaving(null);
    }
  }

  function openDetailed(categoryId?: string) {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setDraft({
      amount,
      merchant,
      categoryId,
      categorySuggestions: suggestions.map((s) => s.categoryId),
      splits: [],
      date: today,
      paymentMethod: 'card',
    }));
    const params = new URLSearchParams();
    if (amount) params.set('amount', String(amount));
    if (merchant) params.set('storeName', merchant);
    router.push(`/expenses/new?${params.toString()}`);
    clear();
  }

  function handleSplit() {
    requestSplit();
    openDetailed();
  }

  if (!user) return null;

  // Which suggestions to show as chips (only for confirm / editing / idle)
  const chipSuggestions = suggestions.slice(0, 3);
  const showChips = stage === 'confirm' || stage === 'editing' || stage === 'idle';
  const showClarification = stage === 'clarification' || stage === 'split';

  return (
    <div className={cn('space-y-2', className)}>
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasAmount && chipSuggestions[0]) {
                saveWithCategory(chipSuggestions[0].categoryId);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-2xl bg-card border border-border px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {input && (
            <button
              onClick={() => { setInput(''); clear(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => openDetailed()}
          className="h-11 w-11 flex items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex-shrink-0"
          title="Подробная запись"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Amount preview (confirm / editing stages) */}
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
              Нажмите категорию ↓
            </span>
          )}
        </div>
      )}

      {/* Category chips — confirm / editing / idle */}
      {showChips && (
        <div className="flex flex-wrap gap-2">
          {chipSuggestions.map((s) => {
            const cat = folders.find((f) => f.id === s.categoryId);
            if (!cat) return null;
            const c = cat.color ?? '#E07A5F';
            const isSaving = saving === s.categoryId;
            return (
              <button
                key={s.categoryId}
                onClick={() => hasAmount ? saveWithCategory(s.categoryId) : openDetailed(s.categoryId)}
                disabled={!!saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                  hasAmount ? 'active:scale-95 hover:opacity-80' : 'opacity-60',
                )}
                style={{ background: c + '18', color: c, borderColor: c + '44' }}
              >
                <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-3.5 w-3.5" />
                <span>{t.cat(cat.name)}</span>
                {isSaving && <span className="opacity-50">…</span>}
                {hasAmount && !isSaving && (
                  <span className="font-black ml-0.5 opacity-70">{symbol}{amount}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Clarification panel — ambiguous / split stages */}
      {showClarification && (
        <ClarificationPanel
          stage={stage}
          amount={amount}
          merchant={merchant}
          suggestions={suggestions}
          onSelectCategory={(id) => hasAmount ? saveWithCategory(id) : openDetailed(id)}
          onSplit={handleSplit}
        />
      )}

      {/* Hint */}
      {stage === 'idle' && !input && (
        <p className="text-[11px] text-muted-foreground px-1">
          Введите сумму + название — или просто выберите категорию
        </p>
      )}
    </div>
  );
}
