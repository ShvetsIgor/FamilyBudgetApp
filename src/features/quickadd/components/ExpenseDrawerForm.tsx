'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { closeQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import type { Category, SplitItem } from '@/shared/types';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';

interface SplitRow {
  categoryId: string;
  name: string;
  icon: string;
  amount: string;
}

const PAYMENT_METHODS = [
  { value: 'card'  as const, label: 'Карта',   icon: '💳' },
  { value: 'cash'  as const, label: 'Наличные', icon: '💵' },
  { value: 'other' as const, label: 'Другое',   icon: '🔄' },
];

export function ExpenseDrawerForm({ accent }: { accent: string }) {
  const dispatch = useAppDispatch();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.expense);
  const { groups: expCatGroups, getCatsInGroup } = useCategoryGroups('expense');
  const symbol = getCurrencySymbol(currency);

  const groups = expCatGroups.filter((g) => g.name !== 'Savings');

  const [amount, setAmount] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [activeField, setActiveField] = useState<'total' | number>('total');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'other'>('card');
  const [comment, setComment] = useState('');
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
      if (e.key === 's' || e.key === 'S') { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setPickerOpen((v) => !v); } }
      if (e.key === 'd' || e.key === 'D') { if (!(e.target instanceof HTMLInputElement)) { e.preventDefault(); setShowDatePicker((v) => !v); } }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const catsInGroup = getCatsInGroup(selectedGroupId);
  const totalNum = parseFloat(amount) || 0;
  const splitsSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = Math.max(0, totalNum - splitsSum);
  const posCount = splits.filter((s) => parseFloat(s.amount) > 0).length + (remainder > 0 ? 1 : 0);
  const catColor = selectedGroup?.color ?? accent;

  function addSplit(sub: Category) {
    if (splits.find((s) => s.categoryId === sub.id)) return;
    setSplits((prev) => {
      const next = [...prev, { categoryId: sub.id, name: sub.name, icon: sub.icon, amount: '' }];
      setActiveField(next.length - 1);
      return next;
    });
    setPickerOpen(false);
  }

  function removeSplit(i: number) {
    setSplits((prev) => prev.filter((_, j) => j !== i));
    setActiveField('total');
  }

  function changeGroup(id: string) {
    setSelectedGroupId(id);
    setSplits([]);
    setActiveField('total');
    setPickerOpen(false);
  }

  async function handleSave() {
    if (!user || totalNum <= 0 || saving) return;
    setSaving(true);
    const splitItems: SplitItem[] = splits
      .filter((sp) => parseFloat(sp.amount) > 0)
      .map((sp) => ({ categoryId: sp.categoryId, amount: parseFloat(sp.amount) }));
    try {
      const exp = await addExpense({
        userId: user.id, currency, date: new Date(dateStr),
        paymentMethod, tags: [], privacy: 'regular',
        comment: comment.trim() || undefined,
        amount: totalNum, categoryId: selectedGroupId, splits: splitItems,
      });
      dispatch(prependExpense(exp));
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
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Категория</span>
            <span className="text-[11px] font-bold" style={{ color: catColor }}>{selectedGroup ? t.cat(selectedGroup.name) : ''}</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {groups.slice(0, 12).map((cat) => {
              const sel = cat.id === selectedGroupId;
              const c = cat.color ?? '#E07A5F';
              return (
                <button
                  key={cat.id}
                  onClick={() => changeGroup(cat.id)}
                  className="h-[68px] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all border-0"
                  style={{
                    background: sel ? c : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 10px ${c}55` : '0 1px 3px rgba(61,44,31,.06)',
                  }}
                >
                  <StickerIcon icon={cat.icon ?? 'box'} color={sel ? '#fff' : c} className="h-5 w-5" />
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
          style={{ borderColor: activeField === 'total' ? catColor : catColor + '44' }}
          onClick={() => { setActiveField('total'); amountRef.current?.focus(); }}
        >
          <span className="text-xl font-bold text-muted-foreground">{symbol}</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={() => setActiveField('total')}
            placeholder="0"
            className="flex-1 bg-transparent text-[32px] font-black text-foreground outline-none tabular-nums placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs font-bold text-muted-foreground/50 uppercase">{currency}</span>
        </div>

        {/* ── Split list ── */}
        <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.06)' }}>
          {/* Selected group row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '22' }}>
              <StickerIcon icon={selectedGroup?.icon ?? 'box'} color={catColor} className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-foreground">
                {selectedGroup ? t.cat(selectedGroup.name) : ''}
                {splits.length > 0 && <span className="text-xs font-semibold text-muted-foreground ml-1">· общее</span>}
              </div>
              {splits.length > 0 && <div className="text-[10px] text-muted-foreground">остаток после уточнений</div>}
            </div>
            <span className="text-base font-black tabular-nums" style={{ color: catColor }}>
              {symbol}{splits.length > 0 ? remainder.toFixed(2).replace(/\.00$/, '') : (amount || '0')}
            </span>
          </div>

          {/* Split rows */}
          {splits.map((sp, i) => {
            const isActive = activeField === i;
            return (
              <div key={i}>
                <div className="h-px mx-4" style={{ background: catColor + '22' }} />
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all"
                  style={{ background: isActive ? catColor + '0e' : 'transparent', paddingLeft: 28 }}
                  onClick={() => { setActiveField(i); }}
                >
                  <div className="h-[22px] w-[22px] rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '28' }}>
                    <StickerIcon icon={sp.icon} color={catColor} className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs font-bold text-foreground">{t.cat(sp.name)}</div>
                  {isActive ? (
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      value={sp.amount}
                      onChange={(e) => setSplits((prev) => prev.map((s, j) => j === i ? { ...s, amount: e.target.value } : s))}
                      className="w-24 text-right bg-transparent text-sm font-black text-foreground outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                  ) : (
                    <span className="text-sm font-black tabular-nums text-foreground">{symbol}{sp.amount || '0'}</span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeSplit(i); }} className="text-muted-foreground hover:text-foreground text-xs px-1 transition-colors">✕</button>
                </div>
              </div>
            );
          })}

          {/* Add split CTA */}
          {catsInGroup.length > 0 && (
            <>
              <div className="h-px mx-4 border-t border-dashed" style={{ borderColor: catColor + '44' }} />
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold transition-colors"
                style={{ color: catColor }}
              >
                <span className="text-base leading-none">＋</span>
                Уточнить позицию
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">S</kbd>
              </button>
            </>
          )}

          {/* Folder category picker */}
          {pickerOpen && catsInGroup.length > 0 && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="grid grid-cols-4 gap-1.5">
                {catsInGroup.map((s) => {
                  const sel = !!splits.find((x) => x.categoryId === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => sel ? removeSplit(splits.findIndex((x) => x.categoryId === s.id)) : addSplit(s)}
                      className="flex flex-col items-center gap-1 py-2 rounded-[9px] text-[11px] font-extrabold transition-all border"
                      style={{ background: sel ? catColor + '28' : catColor + '10', borderColor: sel ? catColor : 'transparent' }}
                    >
                      <StickerIcon icon={s.icon} color={catColor} className="h-4 w-4" />
                      <span className="leading-tight text-center line-clamp-1 px-0.5">{t.cat(s.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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

          {/* Payment */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">Оплата</span>
            <div className="flex gap-1.5 flex-1">
              {PAYMENT_METHODS.map((m) => {
                const sel = paymentMethod === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
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
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">P</kbd>
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
          {t('expense.numpadCancel')} <kbd className="ml-1 text-[9px] font-mono opacity-50">Esc</kbd>
        </button>
        <button
          onClick={handleSave}
          disabled={saving || totalNum <= 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
          style={{ background: catColor, boxShadow: `0 8px 20px ${catColor}55` }}
        >
          <StickerIcon icon={selectedGroup?.icon ?? 'box'} color="#fff" className="h-4 w-4" />
          <span>{saving ? t('expense.numpadSaving') : t('expense.numpadSave', { symbol, total: amount || '0' })}</span>
          {posCount > 0 && <span className="opacity-70 text-xs">· {t('expense.numpadPos', { count: posCount })}</span>}
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono">⌘↵</kbd>
        </button>
      </div>
    </div>
  );
}
