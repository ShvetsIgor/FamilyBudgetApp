'use client';
import { useT } from '@/shared/hooks/useT';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { RPCard } from './RPCard';

export function RPFirstSteps() {
  const C = useChatTokens();
  const t = useT();
  const steps = [
    { done: true, label: t('chat.desktop.stepRegistered') },
    { done: false, label: t('chat.desktop.stepBudget') },
    { done: false, label: t('chat.desktop.stepFamily') },
    { done: false, label: t('chat.desktop.stepFirstEntry') },
  ];
  return (
    <RPCard title={t('chat.desktop.firstStepsTitle')} accentColor={C.primary}>
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
