'use client';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';

export function RPFirstSteps() {
  const C = useChatTokens();
  const steps = [
    { done: true, label: 'Зарегистрировался' },
    { done: false, label: 'Задай бюджет на месяц' },
    { done: false, label: 'Пригласи семью' },
    { done: false, label: 'Добавь первую запись в чат' },
  ];
  return (
    <RPCard title="ПЕРВЫЕ ШАГИ" accentColor={C.primary}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: s.done ? C.sage : C.hairline, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.done && <span style={{ fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.done ? C.sub : C.fg }}>{s.label}</span>
          </div>
        ))}
      </div>
    </RPCard>
  );
}
