'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependIncome, updateIncome } from '@/features/income/store/incomeSlice';
import { addIncome, updateIncome as updateIncomeService } from '@/features/income/services/incomeService';
import { addRecurringIncome } from '@/features/income/services/recurringIncomeService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { selectAllActiveCategories } from '@/features/categories/store/selectors';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { normalizeName } from '@/shared/utils/normalizeName';
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
  const displayCats = useAppSelector((s) => selectAllActiveCategories(s, 'income'));
  const t = useT();
  const dfLocale = useDateFnsLocale();
  const symbol = getCurrencySymbol(currency);

  const [amount, setAmount] = useState(initialIncome ? String(initialIncome.amount) : '0');
  const [categoryId, setCategoryId] = useState(initialIncome?.categoryId ?? displayCats[0]?.id ?? '');
  const [method, setMethod] = useState<Method>((initialIncome?.method as Method) ?? 'bank');
  const [comment, setComment] = useState(initialIncome?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initialIncome?.comment);
  const [dateStr, setDateStr] = useState(initialIncome ? toDateInput(new Date(initialIncome.date)) : toDateInput(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  const category = allCats.find((c) => c.id === categoryId);
  const amountNum = parseFloat(amount) || 0;
  const catColor = category?.color ?? '#10b981';

  function tap(key: NumKey) { setAmount((cur) => applyKey(cur, key)); }

  function goBack() { window.history.length > 1 ? router.back() : router.replace('/income'); }

  async function recordIncomeInChat(hint: string | undefined) {
    if (!user) return;
    const { addMessage } = await import('@/features/chat/services/messagesService');
    await addMessage({
      userId: user.id,
      senderId: 'bot',
      kind: 'bot',
      text: `${t('income.chatLabel')} · ${t.cat(category?.name ?? '')} · +${symbol} ${amountNum}`,
      status: 'saved',
      card: {
        kind: 'saved',
        data: {
          icon: category?.icon ?? 'cash',
          color: catColor,
          title: t.cat(category?.name ?? t('income.title')),
          catName: null,
          groupName: null,
          hint,
          amount: amountNum,
          currency: symbol,
        },
      },
    });
  }

  async function handleSave() {
    if (!user || amountNum <= 0 || !category || saving) return;
    setSaving(true);
    try {
      const date = new Date(dateStr);

      if (initialIncome) {
        const updated = await updateIncomeService({
          userId: user.id, id: initialIncome.id, amount: amountNum, currency,
          categoryId, date, method, privacy: initialIncome.privacy,
          comment: normalizeName(comment) || undefined,
          tags: initialIncome.tags,
        });
        dispatch(updateIncome(updated));
        goBack();
        return;
      }

      if (isRecurring) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const recurDate = new Date(dateStr); recurDate.setHours(0, 0, 0, 0);
        const isFuture = recurDate > today;
        const dayNum = recurDate.getDate();
        const nm = recurDate.getMonth() === 11 ? 0 : recurDate.getMonth() + 1;
        const ny = recurDate.getMonth() === 11 ? recurDate.getFullYear() + 1 : recurDate.getFullYear();
        const daysInNext = new Date(ny, nm + 1, 0).getDate();
        const nextDue = isFuture
          ? `${recurDate.getFullYear()}-${String(recurDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          : `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(dayNum, daysInNext)).padStart(2, '0')}`;

        const catName = category?.name ?? t('income.title');
        await addRecurringIncome({
          userId: user.id, name: catName, amount: amountNum, currency,
          categoryId, dayOfMonth: dayNum, nextDueDate: nextDue,
        });
        if (isFuture) {
          // Future-dated recurring income: no income row yet, but still confirm in chat
          await recordIncomeInChat(`${t('income.recurring')} · ${format(recurDate, 'd MMMM', { locale: dfLocale })}`);
          goBack();
          return;
        }
      }

      const income = await addIncome({
        userId: user.id, amount: amountNum, currency, categoryId, date,
        method, privacy: 'regular', comment: normalizeName(comment) || undefined,
        tags: isRecurring ? ['recurring'] : [],
      });
      dispatch(prependIncome(income));

      // Record in chat
      const incomeDate = parseISO(dateStr);
      let dateHint: string | undefined;
      if (!isToday(incomeDate)) {
        dateHint = isYesterday(incomeDate) ? t('common.yesterday') : format(incomeDate, 'd MMMM', { locale: dfLocale });
      }
      await recordIncomeInChat(dateHint);

      goBack();
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
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {initialIncome ? t('income.edit') : t('income.title')}
        </div>
        <div className="w-8" />
      </div>

      {/* ── Amount row ── */}
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

      {/* ── Scrollable section ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]">

        {/* Category list — flat left-border rows */}
        {displayCats.map((cat) => {
          const sel = cat.id === categoryId;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="flex items-center gap-3 pl-3 pr-4 py-3 text-left transition-colors flex-shrink-0"
              style={{
                borderLeft: `4px solid ${sel ? cat.color : 'transparent'}`,
                background: sel ? cat.color + '0e' : 'hsl(var(--card))',
                boxShadow: '0 1px 2px rgba(61,44,31,.05)',
              }}
            >
              <div
                className="h-9 w-9 rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: cat.color + '22' }}
              >
                <StickerIcon icon={cat.icon} color={cat.color} className="h-5 w-5" />
              </div>
              <span className="flex-1 text-sm font-extrabold text-foreground">{t.cat(cat.name)}</span>
              {sel && (
                <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: cat.color }}>
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          );
        })}

        {/* Date row */}
        <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
          <button
            onClick={() => { setShowDate((v) => !v); setShowComment(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
            style={{ background: showDate ? catColor + '14' : 'hsl(var(--card))' }}
          >
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '20' }}>
              <Calendar className="h-4 w-4" style={{ color: catColor }} />
            </div>
            <span className="flex-1 text-left text-[13px] font-bold text-foreground">
              {(() => {
                const d = parseISO(dateStr);
                if (isToday(d)) return t('common.today');
                if (isYesterday(d)) return t('common.yesterday');
                return format(d, 'd MMMM yyyy', { locale: dfLocale });
              })()}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showDate && (
            <div style={{ borderTop: `1px solid ${catColor}22` }}>
              <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDate(false); }} color={catColor} />
            </div>
          )}
        </div>

        {/* Comment row */}
        <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
          <button
            onClick={() => { setShowComment((v) => !v); setShowDate(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
            style={{ background: (showComment || comment) ? catColor + '14' : 'hsl(var(--card))' }}
          >
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '20' }}>
              <MessageSquare className="h-4 w-4" style={{ color: catColor }} />
            </div>
            <span className="flex-1 text-left text-[13px] font-bold" style={{ color: comment ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
              {comment || t('expense.notePlaceholder')}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showComment && (
            <div className="px-3.5 pb-3" style={{ borderTop: `1px solid ${catColor}22` }}>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('income.notePlaceholder')}
                autoFocus
                className="mt-2 block w-full px-3 py-2 rounded-xl text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
        </div>

        {/* Recurring toggle */}
        {!initialIncome && (
          <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
            <button
              onClick={() => setIsRecurring((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-3 transition-all"
              style={{ background: isRecurring ? catColor + '14' : 'hsl(var(--card))' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">🔄</span>
                <div className="text-left">
                  <p className="text-[12.5px] font-[800] leading-tight" style={{ color: isRecurring ? catColor : 'hsl(var(--foreground))' }}>
                    {t('income.recurring')}
                  </p>
                  {!isRecurring && (
                    <p className="text-[10px] font-[600] mt-0.5 text-muted-foreground">
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
            {isRecurring && (
              <div
                className="px-3.5 py-3 flex items-center justify-between"
                style={{ background: catColor + '0a', borderTop: `1px solid ${catColor}22` }}
              >
                <p className="text-[12px] font-[700] text-muted-foreground">{t('income.creditEvery')}</p>
                <span className="text-[14px] font-extrabold tabular-nums" style={{ color: catColor }}>
                  {t('income.dayNum', { day: new Date(dateStr).getDate() })}
                </span>
              </div>
            )}
          </div>
        )}
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

      {/* ── Save button ── */}
      <div className="px-4 pt-1.5 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0 || !category}
          className="w-full py-[14px] rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-black text-white transition-opacity disabled:opacity-40 border-0"
          style={{ background: saving ? '#18A957' : catColor }}
        >
          {saving ? (
            <span>✓ {t('common.saving')}</span>
          ) : isRecurring ? (
            <span>+{symbol} {amount} · {new Date(dateStr).getDate()} {t('income.recurringDay')}</span>
          ) : (
            <span>+{symbol} {amount}</span>
          )}
        </button>
      </div>

    </div>
    </div>
  );
}
