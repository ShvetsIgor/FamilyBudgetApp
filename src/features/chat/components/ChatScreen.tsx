'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MenuOverlay } from './MenuOverlay';
import { C } from '@/features/chat/styles/tokens';

interface ChatScreenProps {
  children: React.ReactNode;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatScreen({ children, onSend, disabled }: ChatScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when children change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ background: C.bg, fontFamily: 'Nunito, sans-serif', color: C.fg }}
    >
      <ChatHeader onMenu={() => setMenuOpen(true)} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <div className="h-3" />
      </div>

      <Composer onSend={onSend} disabled={disabled} />

      {menuOpen && (
        <div className="absolute inset-0 z-10">
          <MenuOverlay onClose={() => setMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
