'use client';

import { CalendarClock } from 'lucide-react';
import { C } from '@/features/chat/styles/tokens';
import { useT } from '@/shared/hooks/useT';

interface FutureCardProps {
  amount: number;
  currency: string;
  note?: string;
  dateLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FutureCard({ amount, currency, note, dateLabel, onConfirm, onCancel }: FutureCardProps) {
  const t = useT();
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={16} style={{ color: C.primary }} />
        <p className="text-[13px] font-[800]" style={{ color: C.fg }}>
          {t('chat.future.question')}
        </p>
      </div>
      <p className="text-[12px] font-[600] mb-3.5" style={{ color: C.sub }}>
        {note ? `${note} · ` : ''}{currency}{amount.toLocaleString()} · {dateLabel}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl py-2.5 text-[13px] font-[800] transition-opacity active:opacity-70"
          style={{ background: C.primary + '22', color: C.primary, border: `1.5px solid ${C.primary}44` }}
        >
          {t('chat.future.yes')}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl py-2.5 text-[13px] font-[800] transition-opacity active:opacity-70"
          style={{ background: C.card, color: C.sub, border: `1.5px solid ${C.hairline}` }}
        >
          {t('chat.future.no')}
        </button>
      </div>
    </div>
  );
}
