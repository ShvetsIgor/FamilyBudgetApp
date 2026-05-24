'use client';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { useAppSelector } from '@/store/store';
import Link from 'next/link';
import { parseISO, differenceInDays } from 'date-fns';

export function RPBills() {
  const recurring = useAppSelector((s) => s.recurring?.list ?? []);
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';

  const now = new Date();
  const upcoming = recurring
    .filter((r) => r.isActive)
    .map((r) => ({ ...r, daysLeft: differenceInDays(parseISO(r.nextDueDate), now) }))
    .filter((r) => r.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  if (upcoming.length === 0) {
    return (
      <RPCard title="ПЛАТЕЖИ" accentColor={C.lavender}>
        <p style={{ margin: 0, fontSize: 12, color: C.sub }}>Нет ближайших платежей. <Link href="/recurring" style={{ color: C.primary }}>Добавить</Link></p>
      </RPCard>
    );
  }

  return (
    <RPCard title="ПЛАТЕЖИ" accentColor={C.lavender} action={{ label: 'все', href: '/recurring' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {upcoming.map((bill) => (
          <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.fg, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bill.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: bill.daysLeft <= 3 ? '#C97B84' : C.sub }}>
                {bill.daysLeft === 0 ? 'сегодня' : bill.daysLeft === 1 ? 'завтра' : `через ${bill.daysLeft} дн.`}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.fg, marginLeft: 8 }}>{sym}{bill.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </RPCard>
  );
}
