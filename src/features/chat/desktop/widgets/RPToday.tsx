'use client';
import { useT } from '@/shared/hooks/useT';
import Link from 'next/link';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';
import { usePinnedToday } from '../usePinnedToday';
import { useAppSelector } from '@/store/store';

export function RPToday() {
  const C = useChatTokens();
  const t = useT();
  const { spent, left, pct, dailyLimit } = usePinnedToday();
  const currency = useAppSelector((s) => s.ui.currency);
  const sym = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€';

  return (
    <RPCard title={t('chat.desktop.todayTitle')} accentColor={C.primary} action={{ label: t('chat.desktop.details'), href: '/expenses' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: C.fg, lineHeight: 1 }}>{sym}{spent.toLocaleString()}</span>
        {dailyLimit > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>{t('chat.today.of')} {sym}{dailyLimit.toLocaleString()}</span>}
      </div>
      {dailyLimit > 0 ? (
        <>
          <div style={{ height: 5, background: C.hairline, borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: (pct ?? 0) > 90 ? '#C97B84' : C.primary, borderRadius: 99, transition: 'width .3s' }} />
          </div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.sub }}>
            {left !== null && left >= 0 ? `${t('chat.desktop.leftShort')} ${sym}${left.toLocaleString()}` : left !== null ? `${t('chat.desktop.overShort')} ${sym}${Math.abs(left).toLocaleString()}` : ''}
          </p>
        </>
      ) : (
        <Link href="/account" style={{ fontSize: 11, fontWeight: 700, color: C.primary, textDecoration: 'none' }}>{t('chat.desktop.setDailyBudget')}</Link>
      )}
    </RPCard>
  );
}
