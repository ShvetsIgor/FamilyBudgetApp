'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Calendar } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependIncome, updateIncome } from '@/features/income/store/incomeSlice';
import { addIncome, updateIncome as updateIncomeService } from '@/features/income/services/incomeService';
import { addRecurringIncome } from '@/features/income/services/recurringIncomeService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import type { SerializableIncome } from '@/shared/types';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

function applyKey(cur: string, key: NumKey): string {
  if (key === '.') { if (cur.includes('.')) return cur; return cur + '.'; }
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

type Method = 'card' | 'cash' | 'bank' | 'other';

export function FastIncomeEntry({ initialIncome }: { initialIncome?: SerializableIncome }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.income);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const parentCats = allCats.filter((c) => !c.parentId);

  const [amount, setAmount] = useState(initialIncome ? String(initialIncome.amount) : '0');
  const [categoryId, setCategoryId] = useState(initialIncome?.categoryId ?? parentCats[0]?.id ?? '');
  const [method, setMethod] = useState<Method>((initialIncome?.method as Method) ?? 'bank');
  const [comment, setComment] = useState(initialIncome?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initialIncome?.comment);
  const [dateStr, setDateStr] = useState(initialIncome ? toDateInput(new Date(initialIncome.date)) : toDateInput(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState(new Date().getDate());

  const category = allCats.find((c) => c.id === categoryId);
  const amountNum = parseFloat(amount) || 0;
  const catColor = category?.color ?? '#10b981';

  function tap(key: NumKey) { setAmount((cur) => applyKey(cur, key)); }

  async function handleSave() {
    if (!user || amountNum <= 0 || saving) return;
    setSaving(true);
    try {
      const date = new Date(dateStr);
      if (initialIncome) {
        const updated = await updateIncomeService({
          userId: user.id, id: initialIncome.id, amount: amountNum, currency,
          categoryId, date, method, privacy: initialIncome.privacy,
          comment: comment.trim() || undefined,
        });
        dispatch(updateIncome(updated));
        window.history.length > 1 ? router.back() : router.replace('/income');
        return;
      }
      const income = await addIncome({
        userId: user.id,
        amount: amountNum,
        currency,
        categoryId,
        date,
        method,
        privacy: 'regular',
        comment: comment.trim() || undefined,
      });
      dispatch(prependIncome(income));

      if (isRecurring) {
        const now = new Date();
        const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
        const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
        const daysInNext = new Date(nextYear, nextMonth, 0).getDate();
        const nextDay = Math.min(dayOfMonth, daysInNext);
        const nextDue = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
        const catName = category?.name ?? t('income.title');
        await addRecurringIncome({
          userId: user.id,
          name: catName,
          amount: amountNum,
          currency,
          categoryId,
          dayOfMonth,
          nextDueDate: nextDue,
        });
      }

      window.history.length > 1 ? router.back() : router.replace('/income');
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
    <div
      className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={() => window.history.length > 1 ? router.back() : router.replace('/income')} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {t('income.title')}
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

      {/* ── Amount row ── */}
      <div
        className="mx-4 px-4 py-1.5 rounded-[18px] flex items-baseline justify-between flex-shrink-0 border-[1.5px] border-primary bg-primary/10"
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

      {/* ── Scrollable middle (category card + recurring) ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]">

        {/* Selected category summary row */}
        <div
          className="bg-card rounded-[14px] p-3 flex items-center gap-3 flex-shrink-0"
          style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
        >
          <div
            className="h-10 w-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{ background: catColor + '20' }}
          >
            <StickerIcon icon={category?.icon ?? 'trending-up'} color={catColor} className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-foreground">{t.cat(category?.name ?? '')}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">доход</div>
          </div>
          <span className="text-lg font-black text-emerald-500 tabular-nums">
            +{symbol}{'\u202F'}{amount}
          </span>
        </div>

        {/* Recurring section */}
        <div
          className="rounded-[14px] overflow-hidden flex-shrink-0"
          style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
        >
          {/* Toggle row */}
          <button
            onClick={() => setIsRecurring((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 py-3 transition-all"
            style={{
              background: isRecurring ? catColor + '14' : 'hsl(var(--card))',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">🔄</span>
              <div className="text-left">
                <p
                  className="text-[12.5px] font-[800] leading-tight"
                  style={{ color: isRecurring ? catColor : 'hsl(var(--foreground))' }}
                >
                  {t('income.recurring')}
                </p>
                {!isRecurring && (
                  <p className="text-[10px] font-[600] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {t('income.recurringHint')}
                  </p>
                )}
              </div>
            </div>
            <div
              className="relative h-5 w-9 rounded-full transition-colors flex-shrink-0"
              style={{ background: isRecurring ? catColor : 'hsl(var(--muted))' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: isRecurring ? 18 : 2 }}
              />
            </div>
          </button>

          {/* Day-of-month picker — visible when recurring is on */}
          {isRecurring && (
            <div
              className="px-3.5 py-3 flex items-center justify-between"
              style={{
                background: catColor + '0a',
                borderTop: `1px solid ${catColor}22`,
              }}
            >
              <p className="text-[12px] font-[700]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Зачислять каждое
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDayOfMonth((d) => Math.max(1, d - 1))}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-base font-bold transition-colors"
                  style={{ background: catColor + '22', color: catColor }}
                >
                  −
                </button>
                <span
                  className="w-14 text-center text-[14px] font-extrabold tabular-nums"
                  style={{ color: catColor }}
                >
                  {dayOfMonth} число
                </span>
                <button
                  onClick={() => setDayOfMonth((d) => Math.min(28, d + 1))}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-base font-bold transition-colors"
                  style={{ background: catColor + '22', color: catColor }}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment method chips ── */}
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
              color: k === '⌫' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              boxShadow: '0 1px 2px rgba(61,44,31,.05)',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      <div className="px-4 pt-1.5 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
          style={{ background: catColor, boxShadow: `0 12px 24px ${catColor}60` }}
        >
          <StickerIcon icon={category?.icon ?? 'trending-up'} color="#fff" className="h-5 w-5" />
          <span>
            {saving
              ? t('common.saving')
              : isRecurring
                ? `${t('income.record')} · ${symbol}\u202F${amount} · ${dayOfMonth} число`
                : `${t('income.record')} ${symbol}\u202F${amount}`}
          </span>
        </button>
      </div>

    </div>
    </div>
  );
}
