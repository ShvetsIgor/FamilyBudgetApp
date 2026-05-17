'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Calendar } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { prependExpense, updateExpense as updateExpenseAction } from '@/features/expenses/store/expensesSlice';
import { addExpense, updateExpense } from '@/features/expenses/services/expensesService';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { Category, SerializableExpense, SplitItem } from '@/shared/types';


interface SplitRow {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: string;
}

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

function applyKey(cur: string, key: NumKey): string {
  if (key === 'C') return '0';
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

function pluralRu(n: number) {
  if (n === 1) return 'позиция';
  if (n >= 2 && n <= 4) return 'позиции';
  return 'позиций';
}


interface Props {
  initialExpense?: SerializableExpense;
}

export function FastExpenseEntry({ initialExpense }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.expense);
  const t = useT();
  const symbol = getCurrencySymbol(currency);
  const isEdit = !!initialExpense;

  const parentCats = allCats.filter((c) => !c.parentId && c.name !== 'Savings');

  function initParentId() {
    if (!initialExpense) return parentCats[0]?.id ?? '';
    const cat = allCats.find((c) => c.id === initialExpense.categoryId);
    return cat?.parentId ?? cat?.id ?? parentCats[0]?.id ?? '';
  }

  function initSplits(): SplitRow[] {
    if (!initialExpense?.splits?.length) return [];
    return initialExpense.splits
      .map((sp: SplitItem) => {
        const cat = allCats.find((c) => c.id === sp.categoryId);
        const parent = allCats.find((c) => c.id === cat?.parentId);
        if (!cat) return null;
        return {
          categoryId: sp.categoryId,
          name: cat.name,
          icon: cat.icon,
          color: parent?.color ?? cat.color,
          amount: String(sp.amount),
        };
      })
      .filter(Boolean) as SplitRow[];
  }

  const [total, setTotal] = useState(initialExpense ? String(initialExpense.amount) : '0');
  const [parentId, setParentId] = useState(initParentId);
  const [splits, setSplits] = useState<SplitRow[]>(initSplits);
  const [editing, setEditing] = useState<'total' | number>('total');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'other'>(
    initialExpense?.paymentMethod ?? 'card'
  );
  const [comment, setComment] = useState(initialExpense?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initialExpense?.comment);
  const [dateStr, setDateStr] = useState(
    toDateInput(initialExpense ? new Date(initialExpense.date) : new Date())
  );
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const parent = allCats.find((c) => c.id === parentId);
  const subCats = allCats.filter((c) => c.parentId === parentId);

  const totalNum = parseFloat(total) || 0;
  const splitsSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const parentLeftover = Math.max(0, totalNum - splitsSum);
  const posCount = splits.filter((s) => parseFloat(s.amount) > 0).length + (parentLeftover > 0 ? 1 : 0);

  function tap(key: NumKey) {
    if (editing === 'total') {
      setTotal((cur) => applyKey(cur, key));
    } else {
      const idx = editing;
      setSplits((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, amount: applyKey(s.amount, key) } : s))
      );
    }
  }

  function addSplit(sub: Category) {
    if (splits.find((s) => s.categoryId === sub.id)) return;
    setSplits((prev) => {
      const next = [
        ...prev,
        { categoryId: sub.id, name: sub.name, icon: sub.icon, color: parent?.color ?? sub.color, amount: '0' },
      ];
      setEditing(next.length - 1);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      );
      return next;
    });
    setPickerOpen(false);
  }

  function removeSplit(i: number) {
    setSplits((prev) => prev.filter((_, j) => j !== i));
    setEditing('total');
  }

  function changeParent(id: string) {
    setParentId(id);
    setSplits([]);
    setEditing('total');
    setPickerOpen(false);
  }

  async function handleSave() {
    if (!user || totalNum <= 0 || saving) return;
    setSaving(true);

    const splitItems: SplitItem[] = splits
      .filter((sp) => parseFloat(sp.amount) > 0)
      .map((sp) => ({ categoryId: sp.categoryId, amount: parseFloat(sp.amount) }));

    const base = {
      userId: user.id,
      currency,
      date: new Date(dateStr),
      paymentMethod,
      tags: [] as string[],
      privacy: 'regular' as const,
      comment: comment.trim() || undefined,
      amount: totalNum,
      categoryId: parentId,
      splits: splitItems,
    };

    try {
      if (isEdit && initialExpense) {
        const updated = await updateExpense({ ...base, id: initialExpense.id });
        dispatch(updateExpenseAction(updated));
        router.push(`/expenses/${initialExpense.id}`);
      } else {
        const exp = await addExpense(base);
        dispatch(prependExpense(exp));
        router.push('/expenses');
      }
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  const catColor = parent?.color ?? '#E07A5F';

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }} suppressHydrationWarning>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {isEdit ? 'Редактировать' : `Чек · ${splits.length + 1} ${pluralRu(splits.length + 1)}`}
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

      {/* ── Total ── */}
      <div
        onClick={() => { setEditing('total'); setShowDate(false); setShowComment(false); }}
        className={cn(
          'mx-4 px-4 py-1.5 rounded-[18px] cursor-pointer flex items-baseline justify-between flex-shrink-0 transition-all border-[1.5px]',
          editing === 'total' ? 'bg-primary/10 border-primary' : 'bg-transparent border-transparent'
        )}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Итого</span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {total}
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
              placeholder="Заметка к расходу…"
              autoFocus
              className="block w-full px-3 py-2 rounded-xl text-sm bg-card border border-border outline-none focus:border-primary transition-colors box-border"
              style={{ maxWidth: '100%' }}
            />
          )}
        </div>
      )}

      {/* ── Parent category grid ── */}
      <div className="overflow-x-auto px-3.5 py-1.5 flex-shrink-0 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        <div className="grid grid-rows-2 grid-flow-col gap-1.5" style={{ gridAutoColumns: '64px' }}>
          {parentCats.map((cat) => {
            const sel = cat.id === parentId;
            return (
              <button
                key={cat.id}
                onClick={() => changeParent(cat.id)}
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

      {/* ── Split table ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]"
      >
        {/* Parent row */}
        <div
          className="bg-card rounded-[14px] p-3 flex items-center gap-3 flex-shrink-0"
          style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
        >
          <CategoryIcon icon={parent?.icon ?? 'box'} color={catColor} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-foreground">
              {t.cat(parent?.name ?? '')}
              {splits.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground ml-1">· общее</span>
              )}
            </div>
            {splits.length > 0 && (
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">остаток после уточнений</div>
            )}
          </div>
          <span className="text-lg font-black text-foreground tabular-nums">
            {symbol}{splits.length > 0 ? parentLeftover : total}
          </span>
        </div>

        {/* Split rows */}
        {splits.map((sp, i) => {
          const isEditing = editing === i;
          return (
            <div
              key={i}
              onClick={() => setEditing(i)}
              className="rounded-xl px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-all border-[1.5px] flex-shrink-0"
              style={{
                marginLeft: 18,
                background: isEditing ? catColor + '18' : 'hsl(var(--card))',
                borderColor: isEditing ? catColor : 'transparent',
                boxShadow: '0 1px 2px rgba(61,44,31,.05)',
              }}
            >
              <div
                className="h-[26px] w-[26px] rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: catColor + '22' }}
              >
                <StickerIcon icon={sp.icon} color={catColor} className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 text-xs font-bold text-foreground">{t.cat(sp.name)}</div>
              <span className="text-sm font-black text-foreground tabular-nums">{symbol}{sp.amount}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeSplit(i); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm px-1"
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Add subcategory button */}
        {subCats.length > 0 && (
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="rounded-[14px] py-2.5 flex items-center justify-center gap-1.5 text-sm font-extrabold transition-all border-2 border-dashed flex-shrink-0"
            style={{ borderColor: catColor + '77', color: catColor, background: 'transparent' }}
          >
            <span className="text-lg leading-none">＋</span>
            Уточнить позицию
          </button>
        )}

        {/* Subcategory picker */}
        {pickerOpen && subCats.length > 0 && (
          <div
            className="bg-card rounded-[14px] p-2.5 flex-shrink-0"
            style={{ boxShadow: '0 1px 3px rgba(61,44,31,.08)' }}
          >
            <div className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em] px-1 pb-2">
              Подкатегория {t.cat(parent?.name ?? '')}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {subCats.map((s) => {
                const selected = !!splits.find((x) => x.categoryId === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => selected ? removeSplit(splits.findIndex((x) => x.categoryId === s.id)) : addSplit(s)}
                    className="flex flex-col items-center gap-0.5 px-0.5 py-1.5 rounded-[9px] text-[9px] font-extrabold text-foreground border transition-all"
                    style={{
                      background: selected ? catColor + '30' : catColor + '14',
                      borderColor: selected ? catColor : 'transparent',
                    }}
                  >
                    <StickerIcon icon={s.icon} color={catColor} className="h-3.5 w-3.5" />
                    <span className="leading-tight text-center line-clamp-1">{t.cat(s.name)}</span>
                    {selected && <span className="text-[8px]" style={{ color: catColor }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Payment method ── */}
      <div className="px-3 pb-1 flex gap-2 flex-shrink-0">
        {(['card', 'cash', 'other'] as const).map((m) => {
          const icons = { card: '💳', cash: '💵', other: '🔄' };
          const labels = { card: t('expense.card'), cash: t('expense.cash'), other: t('expense.other') };
          const sel = paymentMethod === m;
          return (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all border"
              style={{
                background: sel ? catColor + '18' : 'hsl(var(--card))',
                borderColor: sel ? catColor : 'transparent',
                color: sel ? catColor : 'hsl(var(--muted-foreground))',
              }}
            >
              <span>{icons[m]}</span>
              <span>{labels[m]}</span>
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
          disabled={saving || totalNum <= 0}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-primary-foreground transition-opacity disabled:opacity-50 border-0"
          style={{
            background: catColor,
            boxShadow: `0 12px 24px ${catColor}60`,
          }}
        >
          <StickerIcon icon={parent?.icon ?? 'box'} color="#fff" className="h-5 w-5" />
          <span>{saving ? 'Сохранение…' : isEdit ? `Сохранить ${symbol}${total}` : `Записать чек ${symbol}${total}`}</span>
          {!isEdit && <span className="opacity-75 font-bold text-[13px]">· {posCount} {pluralRu(posCount)}</span>}
        </button>
      </div>
    </div>
    </div>
  );
}
