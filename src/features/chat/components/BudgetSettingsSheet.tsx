'use client';

import { useState, useEffect } from 'react';
import { RAD, SHADOW } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit } from '@/features/ui/store/uiSlice';
import type { BudgetMode } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';
import { getCurrencySymbol } from '@/shared/utils/currency';

interface Props {
  autoDaily: number;
  onClose: () => void;
}

export function BudgetSettingsSheet({ autoDaily, onClose }: Props) {
  const t = useT();
  const dispatch = useAppDispatch();
  const currency = useAppSelector((s) => s.ui.currency);
  const mode = useAppSelector((s) => s.ui.budgetMode);
  const dailyLimit = useAppSelector((s) => s.ui.budgetDailyLimit);
  const monthlyLimit = useAppSelector((s) => s.ui.budgetMonthlyLimit);
  const sym = getCurrencySymbol(currency);

  const [localMode, setLocalMode] = useState<BudgetMode>(mode);
  const [localDaily, setLocalDaily] = useState(dailyLimit > 0 ? String(dailyLimit) : '');
  const [localMonthly, setLocalMonthly] = useState(monthlyLimit > 0 ? String(monthlyLimit) : '');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() {
    dispatch(setBudgetMode(localMode));
    if (localMode === 'daily') dispatch(setBudgetDailyLimit(Number(localDaily) || 0));
    if (localMode === 'monthly') dispatch(setBudgetMonthlyLimit(Number(localMonthly) || 0));
    onClose();
  }

  const modes: { key: BudgetMode; label: string; desc: string }[] = [
    { key: 'auto',    label: t('chat.budget.settings.auto'),    desc: t('chat.budget.settings.autoDesc') },
    { key: 'daily',   label: t('chat.budget.settings.daily'),   desc: t('chat.budget.settings.dailyDesc') },
    { key: 'monthly', label: t('chat.budget.settings.monthly'), desc: t('chat.budget.settings.monthlyDesc') },
  ];

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(61,44,31,.42)', backdropFilter: 'blur(2px)' }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          background: C.bg,
          borderRadius: `${RAD.hero} ${RAD.hero} 0 0`,
          boxShadow: SHADOW.card,
          maxHeight: '85vh',
          padding: '20px 16px 32px',
          animation: 'slideUp 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: C.hairline }} />

        <p className="text-[17px] font-[900] mb-5" style={{ color: C.fg }}>{t('chat.budget.settings.title')}</p>

        {/* Mode selector */}
        <div className="flex flex-col gap-2 mb-5">
          {modes.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => setLocalMode(key)}
              className="flex items-start gap-3 rounded-[16px] px-4 py-3.5 text-left transition-all active:scale-[.98]"
              style={{
                background: localMode === key ? C.primary + '18' : C.card,
                border: `1.5px solid ${localMode === key ? C.primary + '66' : C.hairline}`,
              }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[2px]"
                style={{
                  borderColor: localMode === key ? C.primary : C.sub + '66',
                  background: localMode === key ? C.primary : 'transparent',
                }}
              >
                {localMode === key && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <p className="m-0 text-[14px] font-[800]" style={{ color: C.fg }}>{label}</p>
                <p className="m-0 mt-0.5 text-[12px] font-[600]" style={{ color: C.sub }}>{desc}</p>
                {key === 'auto' && autoDaily > 0 && (
                  <p className="m-0 mt-1 text-[13px] font-[900]" style={{ color: C.primary }}>
                    {sym}{autoDaily.toLocaleString()} {t('chat.budget.settings.perDay')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Amount input */}
        {localMode === 'daily' && (
          <div className="mb-5">
            <p className="text-[12px] font-[800] mb-1.5 uppercase tracking-widest" style={{ color: C.sub }}>
              {t('chat.budget.settings.daily')}
            </p>
            <div
              className="flex items-center rounded-[14px] px-4 py-3"
              style={{ background: C.card, border: `1.5px solid ${C.hairline}` }}
            >
              <span className="text-[18px] font-[900] mr-2" style={{ color: C.sub }}>{sym}</span>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={localDaily}
                onChange={(e) => setLocalDaily(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-[22px] font-[900] tabular-nums"
                style={{ color: C.fg, border: 'none' }}
              />
            </div>
          </div>
        )}

        {localMode === 'monthly' && (
          <div className="mb-5">
            <p className="text-[12px] font-[800] mb-1.5 uppercase tracking-widest" style={{ color: C.sub }}>
              {t('chat.budget.settings.monthly')}
            </p>
            <div
              className="flex items-center rounded-[14px] px-4 py-3"
              style={{ background: C.card, border: `1.5px solid ${C.hairline}` }}
            >
              <span className="text-[18px] font-[900] mr-2" style={{ color: C.sub }}>{sym}</span>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={localMonthly}
                onChange={(e) => setLocalMonthly(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-[22px] font-[900] tabular-nums"
                style={{ color: C.fg, border: 'none' }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full rounded-[16px] py-3.5 text-[15px] font-[900] transition-opacity active:opacity-70"
          style={{ background: C.primary, color: 'white' }}
        >
          {t('chat.budget.settings.save')}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
