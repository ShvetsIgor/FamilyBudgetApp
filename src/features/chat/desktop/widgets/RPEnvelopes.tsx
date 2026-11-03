'use client';
import { useT } from '@/shared/hooks/useT';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { useAppSelector } from '@/store/store';
import Link from 'next/link';
import { buildEnvelopes } from '@/features/budget/utils/envelopes';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { toLocalMonthKey } from '@/shared/utils/dateKey';

export function RPEnvelopes() {
  const C = useChatTokens();
  const t = useT();
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const categories = useAppSelector((s) => s.categories.expense);
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = getCurrencySymbol(currency);

  // The panel has room for four: the fullest ones, the same numbers as /budget
  const envelopes = buildEnvelopes(expenses, budgetLimits, categories, toLocalMonthKey(new Date()), currency)
    .slice(0, 4)
    .map((env) => ({ ...env, pct: Math.min(100, Math.round((env.spent / env.limit) * 100)) }));

  if (envelopes.length === 0) {
    return (
      <RPCard title={t('chat.desktop.envelopesTitle')} accentColor={C.sage}>
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>{t('chat.desktop.envelopesEmpty')}<Link href="/categories" style={{ color: C.primary }}>{t('chat.desktop.categoriesLink')}</Link></p>
      </RPCard>
    );
  }

  return (
    <RPCard title={t('chat.desktop.envelopesTitle')} accentColor={C.sage} action={{ label: t('chat.desktop.all'), href: '/budget' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {envelopes.map((env) => (
          <div key={env.catId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.fg }}>{env.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: env.pct > 90 ? '#C97B84' : C.sub }}>{sym}{env.spent.toLocaleString()} / {sym}{env.limit.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: C.hairline, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${env.pct}%`, background: env.pct > 90 ? '#C97B84' : env.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </RPCard>
  );
}
