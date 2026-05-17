'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome } from '@/features/income/services/incomeService';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import type { Currency } from '@/shared/types';

export default function HomePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency) as Currency;
  const { list: expenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const { list: incomes, status: incStatus } = useAppSelector((s) => s.income);
  const t = useT();

  const currentMonth = format(new Date(), 'yyyy-MM');

  const loadExpenses = useCallback(async () => {
    if (!user || expStatus !== 'idle') return;
    dispatch(setExpenses(await fetchMonthExpenses(user.id, currentMonth)));
  }, [user, currentMonth, expStatus, dispatch]);

  const loadIncome = useCallback(async () => {
    if (!user || incStatus !== 'idle') return;
    dispatch(setIncome(await fetchMonthIncome(user.id, currentMonth)));
  }, [user, currentMonth, incStatus, dispatch]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { loadIncome(); }, [loadIncome]);

  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const balance = monthIncome - monthExpenses;

  const monthLabel = format(new Date(), 'LLLL yyyy', { locale: ru });

  if (!user) return null;

  return (
    <div className="px-[22px] pt-4 pb-28 flex flex-col gap-5">

      {/* Header: logo + greeting + avatar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <p className="text-xs text-muted-foreground font-bold">{t('home.greeting')} {user?.name?.split(' ')[0] ?? ''} ✨</p>
            <p className="text-lg font-extrabold text-foreground tracking-tight leading-none mt-0.5 capitalize">{monthLabel}</p>
          </div>
        </div>
        <Link href="/account">
          <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-lg">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
        </Link>
      </div>

      {/* Hero balance card */}
      <div className="rounded-[32px] bg-primary text-primary-foreground p-6 relative overflow-hidden" style={{ boxShadow: '0 16px 30px rgba(224,122,95,.30)' }}>
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute bottom-[-30px] right-7 h-[70px] w-[70px] rounded-full bg-white/08 pointer-events-none" />
        <p className="text-[13px] font-bold opacity-85 relative">{t('home.remainingIn')} {monthLabel}</p>
        <p className="text-[44px] font-black tabular-nums leading-none tracking-[-0.025em] mt-1 relative">
          {formatAmount(Math.max(0, balance), currency)}
        </p>
        <div className="flex gap-5 mt-3.5 text-[13px] font-bold relative opacity-90">
          <span>↑ {formatAmount(monthIncome, currency)} {t('home.income').toLowerCase()}</span>
          <span>↓ {formatAmount(monthExpenses, currency)} {t('home.expenses').toLowerCase()}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/expenses/new" className="flex flex-col items-center gap-1 rounded-[22px] py-3.5 font-bold text-[13px] active:opacity-80 transition-opacity" style={{ background: '#81B29A', color: '#fff' }}>
          <span className="text-[22px] leading-none">＋</span>
          <span>{t('home.expense')}</span>
        </Link>
        <Link href="/income/new" className="flex flex-col items-center gap-1 rounded-[22px] py-3.5 font-bold text-[13px] active:opacity-80 transition-opacity" style={{ background: '#F2CC8F', color: '#3D2C1F' }}>
          <span className="text-[22px] leading-none">↑</span>
          <span>{t('home.income')}</span>
        </Link>
        <Link href="/savings" className="flex flex-col items-center gap-1 rounded-[22px] py-3.5 font-bold text-[13px] border-2 border-dashed border-muted/50 active:opacity-80 transition-opacity text-foreground">
          <span className="text-[22px] leading-none">🐷</span>
          <span>{t('home.savingsGoals')}</span>
        </Link>
      </div>
    </div>
  );
}
