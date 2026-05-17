'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C } from '@/features/chat/styles/tokens';

interface SavedCardProps {
  icon: string;
  color: string;
  title: string;
  hint?: string;
  amount: number;
  currency: string;
  alert?: string;
}

export function SavedCard({ icon, color, title, hint, amount, currency, alert }: SavedCardProps) {
  return (
    <div>
      {/* Main row */}
      <div
        className="flex items-center gap-3"
        style={{ padding: '12px 14px 12px 12px', borderLeft: `4px solid ${color}` }}
      >
        <div
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: color + '20' }}
        >
          <StickerIcon icon={icon} color={color} className="h-7 w-7" />
          {/* Check badge */}
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2"
            style={{ background: C.sage, borderColor: C.card }}
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[14.5px] font-[800] leading-tight" style={{ color: C.fg, letterSpacing: -0.2 }}>
            {title}
          </p>
          {hint && (
            <p className="m-0 mt-0.5 text-[11.5px] font-[700]" style={{ color: C.sub }}>
              {hint}
            </p>
          )}
        </div>
        <span className="text-[17px] font-[900] tabular-nums" style={{ color: C.fg, letterSpacing: -0.3 }}>
          {currency}{amount.toLocaleString()}
        </span>
      </div>

      {/* Alert row */}
      {alert && (
        <div
          className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-[700]"
          style={{ color: C.rose, borderTop: `1px solid ${C.hairline}` }}
        >
          ⚠️ {alert}
        </div>
      )}
    </div>
  );
}
