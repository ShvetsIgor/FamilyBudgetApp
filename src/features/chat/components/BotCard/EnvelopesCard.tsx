'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';

export interface EnvelopeItem {
  name: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  currency: string;
}

export interface EnvelopesCardData {
  envelopes: EnvelopeItem[];
  monthLabel: string;
}

function EnvelopeRow({ env }: { env: EnvelopeItem }) {
  const C = useChatTokens();
  const hasLimit = env.limit > 0;
  const pct = hasLimit ? Math.min(100, (env.spent / env.limit) * 100) : 0;
  const over = hasLimit && env.spent > env.limit;
  const near = hasLimit && !over && pct >= 85;

  return (
    <div className="flex items-center gap-2.5" style={{ padding: '8px 14px' }}>
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: env.color + '20' }}
      >
        <StickerIcon icon={env.icon} color={env.color} className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span className="text-[12.5px] font-[800]" style={{ color: C.fg }}>{env.name}</span>
          <span
            className="text-[11.5px] font-[800] tabular-nums"
            style={{ color: over ? C.rose : near ? C.caramel : C.sub }}
          >
            {env.currency}{env.spent.toLocaleString()}
            {hasLimit && (
              <span style={{ color: C.sub }}> / {env.currency}{env.limit.toLocaleString()}</span>
            )}
          </span>
        </div>
        {hasLimit && (
          <div className="h-[4px] overflow-hidden rounded-full" style={{ background: C.hairline }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: over ? C.rose : near ? C.caramel : env.color,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function EnvelopesCard({ data }: { data: EnvelopesCardData }) {
  const C = useChatTokens();
  const t = useT();
  const { envelopes, monthLabel } = data;

  const totalSpent = envelopes.reduce((s, e) => s + e.spent, 0);
  const totalLimit = envelopes.reduce((s, e) => s + e.limit, 0);
  const currency = envelopes[0]?.currency ?? '₪';

  return (
    <div className="overflow-hidden">
      <div
        className="flex items-center justify-between"
        style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${C.hairline}` }}
      >
        <div>
          <p className="m-0 text-[10px] font-[800] uppercase tracking-[.08em]" style={{ color: C.sub }}>
            {t('chat.envelopes.title')} · {monthLabel}
          </p>
          <p className="m-0 mt-0.5 text-[18px] font-[900] tabular-nums" style={{ color: C.fg, letterSpacing: -0.4 }}>
            {currency}{totalSpent.toLocaleString()}
            {totalLimit > 0 && (
              <span className="text-[13px] font-[700]" style={{ color: C.sub }}>
                {' '}{t('chat.today.of')} {currency}{totalLimit.toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {envelopes.length > 0 ? (
        <div style={{ paddingTop: 4, paddingBottom: 8 }}>
          {envelopes.map((env) => (
            <EnvelopeRow key={env.name} env={env} />
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-[13px] font-[700]" style={{ color: C.sub }}>
          {t('chat.envelopes.empty')}
        </div>
      )}
    </div>
  );
}
