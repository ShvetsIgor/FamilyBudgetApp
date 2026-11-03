'use client';
import { useEffect } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useT } from '@/shared/hooks/useT';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/store';
import Link from 'next/link';
import { fetchGoals } from '@/features/savings/services/savingsService';
import { setGoals } from '@/features/savings/store/savingsSlice';
import { getCurrencySymbol } from '@/shared/utils/currency';

export function RPGoals() {
  const C = useChatTokens();
  const t = useT();
  const goals = useAppSelector((s) => s.savings?.list ?? []);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const status = useAppSelector((s) => s.savings?.status);
  const dispatch = useAppDispatch();
  const appStore = useAppStore();

  // Nothing else loads goals before /savings, and an unloaded list would read
  // as «no goals» here
  useEffect(() => {
    if (!userId || status !== 'idle') return;
    fetchGoals(userId)
      .then((list) => { if (appStore.getState().auth.user?.id === userId) dispatch(setGoals(list)); })
      .catch(() => {});
  }, [userId, status, dispatch, appStore]);

  const activeGoals = goals
    .filter((g) => !g.deadline || differenceInCalendarDays(parseISO(g.deadline), new Date()) >= 0)
    .slice(0, 3);

  if (activeGoals.length === 0) {
    return (
      <RPCard title={t('chat.desktop.goalsTitle')} accentColor={C.caramel}>
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>{t('chat.desktop.noGoalsShort')}<Link href="/savings" style={{ color: C.primary }}>{t('chat.desktop.createLink')}</Link></p>
      </RPCard>
    );
  }

  return (
    <RPCard title={t('chat.desktop.goalsTitle')} accentColor={C.caramel} action={{ label: t('chat.desktop.all'), href: '/savings' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activeGoals.map((goal) => {
          const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
          const sym = getCurrencySymbol(goal.currency);
          return (
            <div key={goal.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.fg }}>{goal.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.sub }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: C.hairline, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: C.caramel, borderRadius: 99 }} />
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: C.sub }}>{sym}{goal.currentAmount.toLocaleString()} {t('chat.today.of')} {sym}{goal.targetAmount.toLocaleString()}</p>
            </div>
          );
        })}
      </div>
    </RPCard>
  );
}
