'use client';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { useAppSelector } from '@/store/store';
import Link from 'next/link';

export function RPEnvelopes() {
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const categories = useAppSelector((s) => s.categories.expense);
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthExpenses = expenses.filter((e) => e.date >= monthStart);

  const envelopes = Object.entries(budgetLimits)
    .slice(0, 4)
    .map(([catId, limit]) => {
      const cat = categories.find((c) => c.id === catId);
      const spent = monthExpenses.filter((e) => e.categoryId === catId).reduce((s, e) => s + e.amount, 0);
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      return { catId, name: cat?.name ?? catId, color: cat?.color ?? C.primary, spent, limit, pct };
    });

  if (envelopes.length === 0) {
    return (
      <RPCard title="КОНВЕРТЫ" accentColor={C.sage}>
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>Настройте бюджеты в <Link href="/categories" style={{ color: C.primary }}>Категориях</Link></p>
      </RPCard>
    );
  }

  return (
    <RPCard title="КОНВЕРТЫ" accentColor={C.sage} action={{ label: 'все', href: '/categories' }}>
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
