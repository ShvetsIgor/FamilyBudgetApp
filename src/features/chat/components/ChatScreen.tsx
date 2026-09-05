'use client';

import { Children, useRef, useEffect } from 'react';
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

  // Depending on `children` meant this ran on every single render — and
  // reading scrollHeight forces a synchronous layout, the most expensive
  // thing a phone can be asked to do in a commit. The scroll only needs to
  // follow the number of things in the thread.
  const childCount = Children.count(children);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [childCount]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: C.bg, fontFamily: 'var(--font-sans)', color: C.fg }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <div className="h-3" />
      </div>

      <Composer onSend={onSend} onPlus={onPlus} disabled={disabled} />
    </div>
  );
}
