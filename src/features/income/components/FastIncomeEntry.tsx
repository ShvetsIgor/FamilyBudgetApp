'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Calendar } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependIncome } from '@/features/income/store/incomeSlice';
import { addIncome } from '@/features/income/services/incomeService';
import { addRecurringIncome } from '@/features/income/services/recurringIncomeService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

function applyKey(cur: string, key: NumKey): string {
  if (key === 'C') return '0';
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

type Method = 'card' | 'cash' | 'bank' | 'other';

export function FastIncomeEntry() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.income);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const parentCats = allCats.filter((c) => !c.parentId);

  const [amount, setAmount] = useState('0');
  const [categoryId, setCategoryId] = useState(parentCats[0]?.id ?? '');
  const [method, setMethod] = useState<Method>('card');
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const category = allCats.find((c) => c.id === categoryId);
  const amountNum = parseFloat(amount) || 0;
  const catColor = category?.color ?? '#10b981';

  function tap(key: NumKey) {
    setAmount((cur) => applyKey(cur, key));
  }

  async function handleSave() {
    if (!user || amountNum <= 0 || saving) return;
    setSaving(true);
    try {
      const income = await addIncome({
        userId: user.id,
        amount: amountNum,
        currency,
        categoryId,
        date: new Date(dateStr),
        method,
        privacy: 'regular',
        comment: comment.trim() || undefined,
      });
      dispatch(prependIncome(income));
      router.back();
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  const METHODS: { value: Method; icon: string; label: string }[] = [
    { value: 'card', icon: '💳', label: t('expense.card') },
    { value: 'cash', icon: '💵', label: t('expense.cash') },
    { value: 'bank', icon: '🏦', label: t('income.bank') },
    { value: 'other', icon: '🔄', label: t('expense.other') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {t('income.addIncome')}
        </div>
        <button
          onClick={() => { setShowDate(!showDate); setShowComment(false); }}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: showDate ? catColor : 'hsl(var(--muted-foreground))' }}
        >
          <Calendar className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setShowComment(!showComment); setShowDate(false); }}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: showComment ? catColor : 'hsl(var(--muted-foreground))' }}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>

      {/* ── Amount display ── */}
      <div
        className="mx-4 px-4 py-1.5 rounded-[18px] flex items-baseline justify-between flex-shrink-0 border-[1.5px]"
        style={{ background: catColor + '14', borderColor: catColor + '55' }}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
          {t('income.amount')}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {amount}
          </span>
        </div>
      </div>

      {/* ── Expandable: date / comment ── */}
      {(showDate || showComment) && (
        <div className="mx-4 mt-2 flex-shrink-0">
          {showDate && (
            <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDate(false); }} color={catColor} />
          )}
          {showComment && (
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Заметка к доходу…"
              autoFocus
              className="block w-full px-3 py-2 rounded-xl text-sm bg-card border border-border outline-none focus:border-primary transition-colors"
            />
          )}
        </div>
      )}

      {/* ── Category grid ── */}
      <div className="overflow-x-auto px-3.5 py-1.5 flex-shrink-0 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        <div className="grid grid-rows-2 grid-flow-col gap-1.5" style={{ gridAutoColumns: '64px' }}>
          {parentCats.map((cat) => {
            const sel = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className="w-[64px] h-[46px] rounded-[12px] flex flex-col items-center justify-center gap-0.5 transition-all border-0"
                style={{
                  background: sel ? cat.color : 'hsl(var(--card))',
                  boxShadow: sel ? `0 3px 8px ${cat.color}55` : '0 1px 3px rgba(61,44,31,.06)',
                }}
              >
                <StickerIcon icon={cat.icon} color={sel ? '#fff' : cat.color} className="h-4 w-4" />
                <span
                  className="text-[9px] font-extrabold leading-tight text-center px-0.5 line-clamp-1"
                  style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}
                >
                  {t.cat(cat.name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Payment method ── */}
      <div className="px-3 pb-1 flex gap-2 flex-shrink-0">
        {METHODS.map((m) => {
          const sel = method === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all border"
              style={{
                background: sel ? catColor + '18' : 'hsl(var(--card))',
                borderColor: sel ? catColor : 'transparent',
                color: sel ? catColor : 'hsl(var(--muted-foreground))',
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Numpad ── */}
      <div className="px-3 pt-0.5 grid grid-cols-3 flex-shrink-0" style={{ gridAutoRows: '40px', gap: '4px' }}>
        {NUMPAD_KEYS.map((k) => (
          <button
            key={String(k)}
            onClick={() => tap(k)}
            className="bg-card rounded-xl font-extrabold transition-colors active:bg-muted border-0"
            style={{
              fontSize: typeof k === 'number' ? 20 : 16,
              color: k === '⌫' || k === 'C' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              boxShadow: '0 1px 2px rgba(61,44,31,.05)',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      <div className="px-4 pt-1.5 pb-safe flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
          style={{ background: catColor, boxShadow: `0 12px 24px ${catColor}60` }}
        >
          <StickerIcon icon={category?.icon ?? 'trending-up'} color="#fff" className="h-5 w-5" />
          <span>{saving ? t('common.saving') : `${t('income.record')} ${symbol}\u202F${amount}`}</span>
        </button>
      </div>
    </div>
    </div>
  );
}
