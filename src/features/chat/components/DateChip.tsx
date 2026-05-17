'use client';

import { C } from '@/features/chat/styles/tokens';

export function DateChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center" style={{ margin: '16px 0 6px' }}>
      <span
        className="text-[10.5px] font-[800] uppercase tracking-[.08em]"
        style={{
          padding: '5px 14px',
          borderRadius: 999,
          background: 'rgba(142,122,102,.12)',
          color: C.sub,
        }}
      >
        {label}
      </span>
    </div>
  );
}
