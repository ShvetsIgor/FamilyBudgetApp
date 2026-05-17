'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C } from '@/features/chat/styles/tokens';

export interface MorningCardData {
  yesterdayAmount: number;
  yesterdayCatNames: string; // e.g. "кофе и бензин"
  todayFree: number;
  currency: string;
  hasBudget: boolean;
}

export function MorningCard({ data }: { data: MorningCardData }) {
  const { yesterdayAmount, yesterdayCatNames, todayFree, currency, hasBudget } = data;

  return (
    <div style={{ padding: '12px 14px 12px 12px' }}>
      <div className="flex items-start gap-2.5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: C.primaryTint }}
        >
          <StickerIcon icon="sun" color={C.primary} className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[14.5px] font-[800] leading-snug" style={{ color: C.fg }}>
            Доброе утро ✨
          </p>
          {yesterdayAmount > 0 && (
            <p className="m-0 mt-1 text-[13px] font-[700] leading-snug" style={{ color: C.sub }}>
              Вчера потратил{' '}
              <span className="font-[900] tabular-nums" style={{ color: C.fg }}>
                {currency}{yesterdayAmount.toLocaleString()}
              </span>
              {yesterdayCatNames ? ` — ${yesterdayCatNames}` : ''}.
            </p>
          )}
          {hasBudget ? (
            <p className="m-0 mt-1 text-[13px] font-[700]" style={{ color: C.sub }}>
              На сегодня свободно{' '}
              <span className="font-[900] tabular-nums" style={{ color: C.primary }}>
                {currency}{Math.max(0, todayFree).toLocaleString()}
              </span>
              .
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
