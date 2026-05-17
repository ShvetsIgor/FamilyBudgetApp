'use client';

import { useRef, useEffect } from 'react';
import { Composer } from './Composer';
import { C } from '@/features/chat/styles/tokens';

interface ChatScreenProps {
  children: React.ReactNode;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatScreen({ children, onSend, disabled }: ChatScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: C.bg, fontFamily: 'Nunito, sans-serif', color: C.fg }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <div className="h-3" />
      </div>

      <Composer onSend={onSend} disabled={disabled} />
    </div>
  );
}
