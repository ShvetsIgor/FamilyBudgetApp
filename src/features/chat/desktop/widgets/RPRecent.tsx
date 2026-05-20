'use client';
import { C } from '@/features/chat/styles/tokens';
import { RPCard } from './RPCard';
import { useAppSelector } from '@/store/store';

export function RPRecent() {
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const categories = useAppSelector((s) => s.categories.expense);
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';

  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <RPCard title="ПОСЛЕДНИЕ" accentColor={C.blueSoft} action={{ label: 'все', href: '/expenses' }}>
      {recent.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>Нет трат</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recent.map((e) => {
            const cat = categories.find((c) => c.id === e.categoryId);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.fg, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.comment || cat?.name || 'Трата'}
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
