'use client';
import { C } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';

interface Props {
  title: string;
  action?: { label: string; href?: string; onClick?: () => void };
  accentColor?: string;
  children: React.ReactNode;
}

export function RPCard({ title, action, accentColor = C.primary, children }: Props) {
  const C = useChatTokens();
  return (
    <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.hairline}`, overflow: 'hidden', boxShadow: '0 1px 2px rgba(61,44,31,.05), 0 4px 12px rgba(61,44,31,.05)' }}>
      <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${C.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.sub }}>{title}</p>
          <div style={{ height: 2, width: 20, background: accentColor, borderRadius: 2, marginTop: 3 }} />
        </div>
        {action && (
          <button onClick={action.onClick} style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {action.label} →
          </button>
        )}
      </div>
      <div style={{ padding: '8px 14px 12px' }}>{children}</div>
    </div>
  );
}
