'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { addGoalItem } from '@/features/savings/store/savingsSlice';
import { addGoal } from '@/features/savings/services/savingsService';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { Currency } from '@/shared/types';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

function applyKey(cur: string, key: NumKey): string {
  if (key === 'C') return '0';
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

const GOAL_ICONS = ['🎯','🏠','🚗','✈️','💻','📱','👶','💍','🎓','🏖️','💰','🛋️','🎮','🏋️','🐶','🎨','🏕️','💊'];
const GOAL_COLORS = ['#6366f1','#f97316','#10b981','#3b82f6','#ec4899','#eab308','#8b5cf6','#06b6d4','#ef4444','#84cc16'];

export function FastGoalEntry() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const t = useT();
  const symbol = getCurrencySymbol(currency);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [target, setTarget] = useState('0');
  const [showDate, setShowDate] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const targetNum = parseFloat(target) || 0;
  const canSave = name.trim().length > 0 && targetNum > 0;

  function tap(key: NumKey) {
    setTarget((cur) => applyKey(cur, key));
  }

  async function handleSave() {
    if (!user || !canSave || saving) return;
    setSaving(true);
    try {
      const goal = await addGoal({
        userId: user.id,
        name: name.trim(),
        icon,
        color,
        targetAmount: targetNum,
        currency: currency as Currency,
        deadline: deadline ? new Date(deadline) : undefined,
      });
      dispatch(addGoalItem(goal));
      router.back();
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col bg-background fixed inset-0 z-50" style={{ height: '100dvh' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          Новая цель
        </div>
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
          Название цели
        </div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Отпуск или Машина…"
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

        {/* Color row */}
        <div className="overflow-x-auto [scrollbar-width:none]">
          <div className="flex gap-2 pb-1">
            {GOAL_COLORS.map((c) => {
              const sel = c === color;
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="flex-shrink-0 rounded-full transition-all border-2"
                  style={{
                    background: c,
                    width: sel ? 32 : 26,
                    height: sel ? 32 : 26,
                    borderColor: sel ? 'hsl(var(--foreground))' : 'transparent',
                    boxShadow: sel ? `0 0 0 3px ${c}55` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

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
            <div className="text-sm font-extrabold text-foreground">{name || 'Название цели'}</div>
            {deadline && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                До {new Date(deadline + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
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
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Цель</span>
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
              color: k === '⌫' || k === 'C' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
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
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
          style={{ background: color, boxShadow: `0 12px 24px ${color}60` }}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{saving ? 'Сохранение…' : canSave ? `Создать · ${name} · ${symbol}${target}` : 'Введите название и сумму'}</span>
        </button>
      </div>
    </div>
  );
}
