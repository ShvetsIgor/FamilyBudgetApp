'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';

interface SavedCardProps {
  icon: string;
  color: string;
  title: string;
  hint?: string;
  amount: number;
  currency: string;
  isIncome?: boolean;
  alert?: string;
  onUndo?: () => void;
}

export function SavedCard({ icon, color, title, hint, amount, currency, isIncome, alert, onUndo }: SavedCardProps) {
  const C = useChatTokens();
  const badgeColor = isIncome ? '#10b981' : C.sage;
  const amountColor = isIncome ? '#10b981' : C.fg;

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
          {/* Badge: check for expense, "+" for income */}
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[9px] font-black text-white"
            style={{ background: badgeColor, borderColor: C.card }}
          >
            {isIncome ? '+' : (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
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
        <span className="text-[17px] font-[900] tabular-nums" style={{ color: amountColor, letterSpacing: -0.3 }}>
          {isIncome ? '+' : ''}{currency}{'\u202F'}{amount.toLocaleString()}
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

      {/* Undo row */}
      {onUndo && !isIncome && (
        <div style={{ borderTop: `1px solid ${C.hairline}` }}>
          <button
            onClick={onUndo}
            className="w-full px-3.5 py-2 text-left text-[12px] font-[700] transition-colors hover:bg-black/5"
            style={{ color: C.sub }}
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
