'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { recordExpense } from '@/features/expenses/store/suggestionMemorySlice';
import { setDraft } from '@/features/expenses/store/draftSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { parseQuickAdd } from '@/features/expenses/utils/quickAddParser';
import { rankSuggestions } from '@/features/expenses/utils/suggestionRanking';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

const PLACEHOLDER_EXAMPLES = ['Dabbah 350', 'Кофе 18', 'Бензин 250'];

/**
 * Inline quick-add bar for fast expense entry.
 * Parses free text ("Dabbah 350") → ranks category suggestions → saves on tap.
 *
 * Tap a category chip → immediate save.
 * Tap scissors icon → opens FastExpenseEntry with draft pre-filled for splits.
 */
export function QuickAddBar({ className }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const memory = useAppSelector((s) => s.suggestionMemory);
  const { groups: folders } = useCategoryGroups('expense');
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const [input, setInput] = useState('');
  const [saving, setSaving] = useState<string | null>(null); // categoryId being saved

  const parsed = useMemo(() => parseQuickAdd(input), [input]);
  const hasAmount = (parsed.amount ?? 0) > 0;

  const suggestions = useMemo(() => {
    if (!input.trim()) return rankSuggestions(folders, undefined, memory, 3);
    return rankSuggestions(folders, parsed.merchant ?? input.trim(), memory, 3);
  }, [input, parsed.merchant, folders, memory]);

  const placeholder = PLACEHOLDER_EXAMPLES[
    Math.floor(Date.now() / 60000) % PLACEHOLDER_EXAMPLES.length
  ];

  async function saveWithCategory(categoryId: string) {
    if (!user || !hasAmount || saving) return;
    setSaving(categoryId);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const exp = await addExpense({
        userId: user.id,
        currency,
        amount: parsed.amount!,
        categoryId,
        date: new Date(),
        paymentMethod: 'card',
        tags: [],
        privacy: 'regular',
        splits: [],
        ...(parsed.merchant ? { store: parsed.merchant } : {}),
      });
      dispatch(prependExpense(exp));
      dispatch(recordExpense({
        merchant: parsed.merchant,
        categoryId,
        date: today,
      }));
      setInput('');
    } finally {
      setSaving(null);
    }
  }

  function openDetailed(categoryId?: string) {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setDraft({
      amount: parsed.amount,
      merchant: parsed.merchant,
      categoryId,
      categorySuggestions: suggestions,
      splits: [],
      date: today,
      paymentMethod: 'card',
    }));
    const params = new URLSearchParams();
    if (parsed.amount) params.set('amount', String(parsed.amount));
    if (parsed.merchant) params.set('storeName', parsed.merchant);
    router.push(`/expenses/new?${params.toString()}`);
  }

  if (!user) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasAmount && suggestions[0]) {
                saveWithCategory(suggestions[0]);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-2xl bg-card border border-border px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {input && (
            <button
              onClick={() => setInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Open detailed entry */}
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

      {/* Amount preview */}
      {hasAmount && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Сумма:</span>
          <span className="text-sm font-black text-foreground">{symbol}{parsed.amount}</span>
          {parsed.merchant && (
            <>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[140px]">
                {parsed.merchant}
              </span>
            </>
          )}
        </div>
      )}

      {/* Category suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((id) => {
          const cat = folders.find((f) => f.id === id);
          if (!cat) return null;
          const c = cat.color ?? '#E07A5F';
          const isSaving = saving === id;
          return (
            <button
              key={id}
              onClick={() => hasAmount ? saveWithCategory(id) : openDetailed(id)}
              disabled={!!saving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                hasAmount
                  ? 'active:scale-95 hover:opacity-80'
                  : 'opacity-60',
              )}
              style={{
                background: c + '18',
                color: c,
                borderColor: c + '44',
              }}
            >
              <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-3.5 w-3.5" />
              <span>{t.cat(cat.name)}</span>
              {isSaving && <span className="opacity-50">…</span>}
              {hasAmount && !isSaving && (
                <span className="font-black ml-0.5 opacity-70">{symbol}{parsed.amount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {!input && (
        <p className="text-[11px] text-muted-foreground px-1">
          Введите сумму + название — или просто выберите категорию
        </p>
      )}
    </div>
  );
}
