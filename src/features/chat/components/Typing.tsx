'use client';

import { BotAvatar } from './BotBubble';
import { C, SHADOW, RAD } from '@/features/chat/styles/tokens';

export function Typing() {
  return (
    <div className="flex items-end gap-2" style={{ margin: '8px 14px 2px' }}>
      <BotAvatar />
      <div
        className="inline-flex gap-1"
        style={{
          background: C.cardTint,
          padding: '12px 14px',
          borderRadius: RAD.bubble,
          borderBottomLeftRadius: 6,
          boxShadow: SHADOW.bubble,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full"
            style={{
              background: C.sub,
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.9s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
