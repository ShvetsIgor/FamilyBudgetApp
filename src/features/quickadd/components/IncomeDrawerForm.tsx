'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { closeQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { prependIncome } from '@/features/income/store/incomeSlice';
import { addIncome } from '@/features/income/services/incomeService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';

const INCOME_METHODS = [
  { value: 'bank'  as const, label: 'Перевод', icon: '🏦' },
  { value: 'card'  as const, label: 'Карта',   icon: '💳' },
  { value: 'cash'  as const, label: 'Наличные', icon: '💵' },
  { value: 'other' as const, label: 'Другое',  icon: '🔄' },
];

const AMOUNT_PRESETS = [10000, 25000, 50000, 100000];

export function IncomeDrawerForm({ accent }: { accent: string }) {
  const dispatch = useAppDispatch();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.income);
  const { groups: parentCats } = useCategoryGroups('income');
  const symbol = getCurrencySymbol(currency);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(parentCats[0]?.id ?? '');
  const [method, setMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('bank');
  const [comment, setComment] = useState('');
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { amountRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
      if (e.key === 'd' || e.key === 'D') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault(); setShowDatePicker((v) => !v);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selectedCat = allCats.find((c) => c.id === categoryId);
  const catColor = selectedCat?.color ?? accent;
  const amountNum = parseFloat(amount) || 0;

  async function handleSave() {
    if (!user || amountNum <= 0 || saving) return;
    setSaving(true);
    try {
      const inc = await addIncome({
        userId: user.id, currency, date: new Date(dateStr),
        method, privacy: 'regular',
        comment: comment.trim() || undefined,
        amount: amountNum, categoryId,
      });
      dispatch(prependIncome(inc));
      dispatch(closeQuickAdd());
    } catch {
      setSaving(false);
    }
  }

  const today = toDateInput(new Date());
  const dateLabel = dateStr === today ? 'Сегодня' : format(new Date(dateStr + 'T12:00:00'), 'd MMM yyyy');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 [scrollbar-width:none]">

        {/* ── Category grid ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Источник</span>
            <span className="text-[11px] font-bold" style={{ color: catColor }}>{selectedCat ? t.cat(selectedCat.name) : ''}</span>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {parentCats.slice(0, 8).map((cat, i) => {
              const sel = cat.id === categoryId;
              const c = cat.color ?? '#10b981';
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className="h-[68px] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all border-0 relative"
                  style={{
                    background: sel ? c : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 10px ${c}55` : '0 1px 3px rgba(61,44,31,.06)',
                  }}
                >
                  <kbd className="absolute top-1 left-1.5 text-[8px] font-mono opacity-40">{i + 1}</kbd>
                  <StickerIcon icon={cat.icon ?? 'cash'} color={sel ? '#fff' : c} className="h-5 w-5" />
                  <span className="text-[11px] font-extrabold leading-tight text-center px-1 line-clamp-1"
                    style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}>
                    {t.cat(cat.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Amount input ── */}
        <div
          className="bg-card rounded-[14px] px-4 py-3 flex items-center gap-3 border-2 transition-all"
          style={{ borderColor: catColor }}
          onClick={() => amountRef.current?.focus()}
        >
          <span className="text-xl font-bold text-muted-foreground">{symbol}</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent text-[32px] font-black text-foreground outline-none tabular-nums placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs font-bold text-muted-foreground/50 uppercase">{currency}</span>
        </div>

        {/* ── Amount presets ── */}
        <div className="flex gap-2">
          {AMOUNT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className="flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all border"
              style={{
                background: amount === String(p) ? catColor + '18' : 'hsl(var(--card))',
                borderColor: amount === String(p) ? catColor : 'hsl(var(--border))',
                color: amount === String(p) ? catColor : 'hsl(var(--muted-foreground))',
              }}
            >
              {p >= 1000 ? `${p / 1000}к` : p}
            </button>
          ))}
        </div>

        {/* ── Impact preview ── */}
        {amountNum > 0 && (
          <div
            className="rounded-[14px] px-4 py-3 flex items-center gap-3"
            style={{ background: catColor + '12', border: `1px solid ${catColor}30` }}
          >
            <span className="text-lg">💰</span>
            <div className="flex-1">
              <div className="text-xs font-extrabold text-foreground">
                + {symbol}{amountNum.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                будет добавлено к балансу
              </div>
            </div>
            <span className="text-sm font-black" style={{ color: catColor }}>
              {selectedCat ? t.cat(selectedCat.name) : ''}
            </span>
          </div>
        )}

        {/* ── Form rows ── */}
        <div className="bg-card rounded-[14px] overflow-hidden divide-y divide-border" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.06)' }}>
          {/* Date */}
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setShowDatePicker(!showDatePicker)}>
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">Дата</span>
            <span className="flex-1 text-sm font-bold text-foreground">{dateLabel}</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">D</kbd>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {showDatePicker && (
            <div className="px-4 py-3">
              <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDatePicker(false); }} color={catColor} />
            </div>
          )}

          {/* Method */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">Счёт</span>
            <div className="flex gap-1.5 flex-wrap flex-1">
              {INCOME_METHODS.map((m) => {
                const sel = method === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border"
                    style={{
                      background: sel ? catColor + '18' : 'transparent',
                      borderColor: sel ? catColor : 'hsl(var(--border))',
                      color: sel ? catColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <span>{m.icon}</span><span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">Заметка</span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необязательно…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="flex-shrink-0 border-t border-border px-5 py-4 flex items-center gap-3 bg-background">
        <button
          onClick={() => dispatch(closeQuickAdd())}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors border border-border"
        >
          Отмена <kbd className="ml-1 text-[9px] font-mono opacity-50">Esc</kbd>
        </button>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
          style={{ background: catColor, boxShadow: `0 8px 20px ${catColor}55` }}
        >
          <StickerIcon icon={selectedCat?.icon ?? 'wallet'} color="#fff" className="h-4 w-4" />
          <span>{saving ? 'Сохранение…' : `Записать доход ${symbol}\u202F${amount || '0'}`}</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono">⌘↵</kbd>
        </button>
      </div>
    </div>
  );
}
