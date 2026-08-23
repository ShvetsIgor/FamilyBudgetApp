'use client';

import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { SHADOW, RAD } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';

interface BotBubbleProps {
  text: string;
  time?: string;
  tail?: boolean;
}

function BotAvatar({ visible = true }: { visible?: boolean }) {
  const C = useChatTokens();
  return (
    <div
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center self-end rounded-full"
      style={{
        background: `linear-gradient(135deg, ${C.primaryTint}, ${C.primary}22)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.6)',
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <StickerIcon icon="piggy" color={C.primary} className="h-[18px] w-[18px]" />
    </div>
  );
}

export { BotAvatar };

export function BotBubble({ text, time, tail = true }: BotBubbleProps) {
  const C = useChatTokens();
  return (
    <div
      className="flex items-end gap-2"
      style={{ margin: tail ? '8px 14px 2px' : '2px 14px', maxWidth: '85%' }}
    >
      <BotAvatar visible={tail} />
      <div
        className="text-[14.5px] font-bold leading-[1.4]"
        style={{
          background: C.cardTint,
          padding: '9px 13px',
          borderRadius: RAD.bubble,
          borderBottomLeftRadius: tail ? 6 : RAD.bubble,
          boxShadow: SHADOW.bubble,
          color: C.fg,
        }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
      {time && (
        <span className="self-end pb-1 text-[10px] font-bold tabular-nums" style={{ color: C.sub }}>
          {time}
        </span>
      )}
    </div>
  );
}

export function BotCardBubble({ children, tail = true }: { children: React.ReactNode; tail?: boolean }) {
  const C = useChatTokens();
  return (
    <div
      className="flex items-end gap-2"
      style={{ margin: tail ? '8px 14px 2px' : '2px 14px' }}
    >
      <BotAvatar visible={tail} />
      <div
        className="overflow-hidden"
        style={{
          background: C.card,
          borderRadius: RAD.card,
          borderBottomLeftRadius: tail ? 6 : RAD.card,
          boxShadow: SHADOW.card,
          maxWidth: 296,
          width: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}
