'use client';
import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setDesktopRightPanelOpen } from '@/features/ui/store/uiSlice';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { DesktopChatHeader } from './DesktopChatHeader';
import { RightPanel } from './RightPanel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CommandPalette } from './CommandPalette';

interface Props {
  children: React.ReactNode;
}

export function DesktopChatLayout({ children }: Props) {
  const dispatch = useAppDispatch();
  const rightOpen = useAppSelector((s) => s.ui.desktopRightPanelOpen ?? true);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Global Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden" style={{ background: C.bg, fontFamily: 'Nunito, sans-serif' }}>
      {/* Center — chat column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DesktopChatHeader />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Right panel toggle button */}
      <button
        onClick={() => dispatch(setDesktopRightPanelOpen(!rightOpen))}
        className="absolute top-1/2 -translate-y-1/2 z-10 flex h-8 w-5 items-center justify-center rounded-l-lg border border-r-0 border-border hover:bg-muted transition-colors"
        style={{ background: C.card, color: C.sub, right: rightOpen ? 340 : 0 }}
      >
        {rightOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Right panel */}
      <aside
        className="flex-shrink-0 border-l border-border flex flex-col gap-3 transition-all duration-200"
        style={{
          width: rightOpen ? 320 : 0,
          overflow: rightOpen ? 'auto' : 'hidden',
          background: C.bgSoft,
          opacity: rightOpen ? 1 : 0,
          padding: rightOpen ? '12px' : '0',
        }}
      >
        {rightOpen && <RightPanel />}
      </aside>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </div>
  );
}
