'use client';

import { SHADOW, RAD } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';

interface UserBubbleProps {
  text: string;
  time?: string;
  status?: 'pending' | 'saved' | 'sent';
  tail?: boolean;
}

export function UserBubble({ text, time, status = 'sent', tail = true }: UserBubbleProps) {
  return (
    <div
      className="flex justify-end"
      style={{ margin: tail ? '6px 14px 2px' : '2px 14px' }}
    >
      <div
        className="inline-flex max-w-[78%] items-baseline gap-2 text-[14.5px] font-[700] leading-[1.4]"
        style={{
          background: `linear-gradient(160deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`,
          color: 'white',
          padding: '9px 14px',
          borderRadius: RAD.bubble,
          borderBottomRightRadius: tail ? 6 : RAD.bubble,
          boxShadow: SHADOW.user,
        }}
      >
        <span>{text}</span>
        <span className="inline-flex items-baseline gap-0.5 opacity-80">
          {time && (
            <span className="text-[10px] font-[700] tabular-nums">{time}</span>
          )}
          {status === 'saved' && (
            <svg width="13" height="9" viewBox="0 0 13 9" fill="none" className="ml-0.5">
              <path d="M1 4.5L4.5 8L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 4.5L7 8L12 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status === 'pending' && (
            <svg width="10" height="9" viewBox="0 0 10 9" fill="none" className="ml-0.5">
              <path d="M1 4.5L4 8L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
}
