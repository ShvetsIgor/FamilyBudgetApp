'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { addGoalItem } from '@/features/savings/store/savingsSlice';
import { addGoal } from '@/features/savings/services/savingsService';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useT } from '@/shared/hooks/useT';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { format } from 'date-fns';
import { applyKey } from '@/features/expenses/hooks/useSplitEditor';
import { ColorPaletteRow } from '@/features/categories/components/ColorPaletteRow';
import { normalizeName } from '@/shared/utils/normalizeName';
import type { Currency } from '@/shared/types';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

const GOAL_ICONS = ['🎯','🏠','🚗','✈️','💻','📱','👶','💍','🎓','🏖️','💰','🛋️','🎮','🏋️','🐶','🎨','🏕️','💊'];

export function FastGoalEntry() {
  const router = useRouter();
  // Direct URL entry has no history to go back to — fall back to /savings
  const goBack = () => { if (window.history.length > 1) router.back(); else router.replace('/savings'); };
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const t = useT();
  const dfLocale = useDateFnsLocale();
  const symbol = getCurrencySymbol(currency);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [color, setColor] = useState('#5B6CFF');
  const [target, setTarget] = useState('0');
  const [showDate, setShowDate] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const targetNum = parseFloat(target) || 0;
  const canSave = name.trim().length > 0 && targetNum > 0;

  function tap(key: NumKey) {
    setTarget((cur) => applyKey(cur, String(key)));
  }

  async function handleSave() {
    if (!user || !canSave || saving) return;
    setSaving(true);
    try {
      const goal = await addGoal({
        userId: user.id,
        name: normalizeName(name),
        icon,
        color,
        targetAmount: targetNum,
        currency: currency as Currency,
        deadline: deadline ? new Date(deadline) : undefined,
        isPrivate,
      });
      dispatch(addGoalItem(goal));
      goBack();
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {t('savings.goalNew')}
        </div>
        <button
          onClick={() => setIsPrivate((v) => !v)}
          className="p-1.5 rounded-full transition-colors text-sm leading-none"
          title={isPrivate ? t('savings.showToFamily') : t('savings.hideFromFamily')}
          style={{ opacity: isPrivate ? 1 : 0.35 }}
        >
          🔒
        </button>
        <button
          onClick={() => setShowDate(!showDate)}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: deadline ? color : 'hsl(var(--muted-foreground))' }}
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {/* ── Name input ── */}
      <div
        className="mx-4 px-4 py-2.5 rounded-[18px] flex-shrink-0 border-[1.5px] transition-all"
        style={{ background: color + '14', borderColor: color + '55' }}
        onClick={() => nameRef.current?.focus()}
      >
        <div className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1">
          {t('savings.goalName')}
        </div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('savings.goalNamePlaceholder')}
          className="w-full bg-transparent text-[18px] font-black text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      {/* ── Deadline calendar ── */}
      {showDate && (
        <div className="mx-4 mt-2 flex-shrink-0">
          <MiniCalendar
            value={deadline || toDateInput(new Date())}
            onChange={(d) => { setDeadline(d); setShowDate(false); }}
            color={color}
          />
        </div>
      )}

      {/* ── Icon + color pickers ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 min-h-0 [scrollbar-width:none]">
        {/* Icon grid */}
        <div className="overflow-x-auto [scrollbar-width:none]">
          <div className="grid grid-rows-2 grid-flow-col gap-1.5 pb-1" style={{ gridAutoColumns: '52px' }}>
            {GOAL_ICONS.map((ic) => {
              const sel = ic === icon;
              return (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className="w-[52px] h-[44px] rounded-[12px] flex items-center justify-center text-xl transition-all border-0"
                  style={{
                    background: sel ? color : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 8px ${color}55` : '0 1px 3px rgba(61,44,31,.06)',
                    fontSize: sel ? 22 : 18,
                  }}
                >
                  {ic}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color palette — same component as category/folder editors */}
        <ColorPaletteRow value={color} onChange={setColor} />

        {/* Selected preview */}
        <div
          className="rounded-[14px] p-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: color + '14', boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
        >
          <div
            className="h-10 w-10 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: color + '30' }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-foreground">{name || t('savings.goalName')}</div>
            {deadline && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t('savings.until')} {format(new Date(deadline + 'T12:00:00'), 'd MMMM yyyy', { locale: dfLocale })}
              </div>
            )}
          </div>
          <span className="text-base font-black tabular-nums" style={{ color }}>
            {symbol}{target}
          </span>
        </div>
      </div>

      {/* ── Target amount display ── */}
      <div
        className="mx-4 mb-1 px-4 py-1.5 rounded-[18px] flex items-baseline justify-between flex-shrink-0 border-[1.5px] transition-all"
        style={{ background: color + '10', borderColor: color + '44' }}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t('savings.goalLabel')}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {target}
          </span>
        </div>
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
          disabled={saving || !canSave}
          className="w-full py-[14px] rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-black text-white transition-opacity disabled:opacity-40 border-0"
          style={{ background: saving ? '#18A957' : color }}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{saving ? t('savings.numpadSaving') : canSave ? t('savings.numpadCreate', { name, symbol, target }) : t('savings.numpadCreateHint')}</span>
        </button>
      </div>
    </div>
    </div>
  );
}
