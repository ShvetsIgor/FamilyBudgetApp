'use client';
import { useT } from '@/shared/hooks/useT';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { useAppSelector } from '@/store/store';

export function RPRecent() {
  const C = useChatTokens();
  const t = useT();
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const categories = useAppSelector((s) => s.categories.expense);
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';

  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <RPCard title={t('chat.desktop.recentTitle')} accentColor={C.blueSoft} action={{ label: t('chat.desktop.all'), href: '/expenses' }}>
      {recent.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>{t('chat.desktop.noExpensesShort')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recent.map((e) => {
            const cat = categories.find((c) => c.id === e.categoryId);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.fg, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.comment || cat?.name || t('quickadd.tabExpense')}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.fg, marginLeft: 8 }}>
                  {sym}{e.amount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </RPCard>
  );
}
