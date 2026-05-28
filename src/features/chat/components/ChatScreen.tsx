'use client';

import { useRef, useEffect } from 'react';
import { Composer } from './Composer';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';

interface ChatScreenProps {
  children: React.ReactNode;
  onSend: (text: string) => void;
  onPlus?: () => void;
  disabled?: boolean;
}

export function ChatScreen({ children, onSend, onPlus, disabled }: ChatScreenProps) {
  const C = useChatTokens();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [children]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: C.bg, fontFamily: 'var(--font-sans)', color: C.fg }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <div className="h-3" />
      </div>

      <Composer onSend={onSend} onPlus={onPlus} disabled={disabled} />
    </div>
  );
}
