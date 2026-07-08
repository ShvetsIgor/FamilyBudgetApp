'use client';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/store/store';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';

const EXAMPLES_RU = [
  { input: 'хлеб 45', output: '₪45 → Продукты' },
  { input: 'кофе 30 в старбаксе', output: '₪30 → Кафе · комментарий' },
  { input: '+15000 зарплата', output: '₪15,000 → Доход' },
  { input: 'sonol 200', output: '₪200 → ? (выбери категорию)' },
  { input: 'аптека 120', output: '₪120 → Аптека' },
];

const EXAMPLES_EN = [
  { input: 'bread 45', output: '₪45 → Groceries' },
  { input: 'coffee 30 at starbucks', output: '₪30 → Cafe · comment' },
  { input: '+15000 salary', output: '₪15,000 → Income' },
  { input: 'sonol 200', output: '₪200 → ? (pick a category)' },
  { input: 'pharmacy 120', output: '₪120 → Pharmacy' },
];

export function RPCheatSheet() {
  const C = useChatTokens();
  const t = useT();
  const language = useAppSelector((s) => s.ui.language);
  const examples = language === 'ru' ? EXAMPLES_RU : EXAMPLES_EN;
  return (
    <RPCard title={t('chat.desktop.cheatTitle')} accentColor={C.yellow}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {examples.map((ex, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <code style={{ fontSize: 11.5, fontWeight: 800, color: C.fg, background: C.hairline + '80', padding: '2px 6px', borderRadius: 6, display: 'inline-block', width: 'fit-content' }}>{ex.input}</code>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.sub, paddingLeft: 4 }}>→ {ex.output}</span>
          </div>
        ))}
      </div>
    </RPCard>
  );
}
