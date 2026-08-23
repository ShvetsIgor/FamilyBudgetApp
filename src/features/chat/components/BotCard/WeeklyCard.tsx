'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';

export interface WeeklyEnvelope {
  name: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
}

export interface WeeklyCardData {
  weekNum: number;
  weekRange: string;
  totalSpent: number;
  totalBudget: number;
  saved: number;
  savingsGoalName?: string;
  envelopes: WeeklyEnvelope[];
  bestDay: string;
  worstDay: string;
  mostFrequent: string;
  currency: string;
}

function EnvelopeRow({ env }: { env: WeeklyEnvelope }) {
  const C = useChatTokens();
  const pct = env.limit > 0 ? Math.min(100, (env.spent / env.limit) * 100) : 0;
  const over = env.spent > env.limit;

  return (
    <div className="flex items-center gap-2.5" style={{ padding: '7px 14px' }}>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: env.color + '20' }}
      >
        <StickerIcon icon={env.icon} color={env.color} className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span className="text-[12px] font-extrabold" style={{ color: C.fg }}>{env.name}</span>
          <span
            className="text-[11.5px] font-extrabold tabular-nums"
            style={{ color: over ? C.rose : C.sub }}
          >
            {env.spent}/{env.limit}
          </span>
        </div>
        <div className="h-[4px] overflow-hidden rounded-full" style={{ background: C.hairline }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: over ? C.rose : env.color }}
          />
        </div>
      </div>
    </div>
  );
}

export function WeeklyCard({ data }: { data: WeeklyCardData }) {
  const C = useChatTokens();
  const t = useT();
  const { weekNum, weekRange, totalSpent, totalBudget, saved, savingsGoalName, envelopes, bestDay, worstDay, mostFrequent, currency } = data;

  return (
    <div className="overflow-hidden">
      <div
        className="relative overflow-hidden"
        style={{
          padding: '16px 18px 12px',
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.rose} 100%)`,
          color: 'white',
        }}
      >
        <svg
          style={{ position: 'absolute', top: -40, right: -40, opacity: 0.25, pointerEvents: 'none' }}
          width="160" height="160" viewBox="0 0 120 120"
        >
          <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="60" cy="60" r="42" stroke="white" strokeWidth="1" fill="none" opacity=".7" />
        </svg>

        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[.09em] opacity-85">
          {/* weekNum/weekRange come from stored data — keep as-is */}
          {weekNum ? `${t('chat.weeklyWeekN', { n: weekNum })} · ${weekRange}` : weekRange}
        </p>

        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[26px] font-black tabular-nums" style={{ letterSpacing: -0.8 }}>
            {currency}{totalSpent.toLocaleString()}
          </span>
          <span className="text-[12px] font-extrabold opacity-85">
            {t('chat.today.of')} {currency}{totalBudget.toLocaleString()}
          </span>
        </div>

        {saved > 0 && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-extrabold"
            style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.18)' }}
          >
            <StickerIcon icon="piggy" color={C.yellow} className="h-4 w-4" />
            {currency}{saved.toLocaleString()}
            {savingsGoalName ? ` → ${savingsGoalName}?` : ''}
          </div>
        )}
      </div>

      {envelopes.length > 0 && (
        <div style={{ paddingTop: 10, paddingBottom: 6 }}>
          <p
            className="m-0 text-[10px] font-extrabold uppercase tracking-[.08em]"
            style={{ color: C.sub, margin: '4px 14px 4px' }}
          >
            {t('chat.weekly.envelopes')}
          </p>
          {envelopes.map((env) => (
            <EnvelopeRow key={env.name} env={env} />
          ))}
        </div>
      )}

      <div
        className="flex"
        style={{ borderTop: `1px solid ${C.hairline}`, padding: '10px 4px' }}
      >
        {[
          { lab: t('chat.weekly.best'),  val: bestDay,      color: C.sage    },
          { lab: t('chat.weekly.worst'), val: worstDay,     color: C.primary },
          { lab: t('chat.weekly.often'), val: mostFrequent, color: C.fg      },
        ].map((s, i, arr) => (
          <div key={s.lab} className="flex" style={{ flex: 1 }}>
            <div className="flex-1 px-2">
              <p className="m-0 text-[9.5px] font-extrabold uppercase tracking-[.08em]" style={{ color: C.sub }}>
                {s.lab}
              </p>
              <p className="m-0 mt-0.5 text-[12.5px] font-extrabold" style={{ color: s.color }}>
                {s.val}
              </p>
            </div>
            {i < arr.length - 1 && (
              <div className="w-px self-stretch" style={{ background: C.hairline }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
