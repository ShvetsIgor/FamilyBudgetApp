'use client';

import { Bell, Menu } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C } from '@/features/chat/styles/tokens';

interface ChatHeaderProps {
  onMenu: () => void;
}

export function ChatHeader({ onMenu }: ChatHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-3 border-b px-3.5 pb-3 pt-3"
      style={{ background: C.bg, borderColor: C.hairline }}
    >
      <button
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
        style={{ color: C.fg }}
      >
        <Menu size={20} strokeWidth={2.4} />
      </button>

      {/* Bot avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}22)`,
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.7)',
          }}
        >
          <StickerIcon icon="piggy" color={C.primary} className="h-[30px] w-[30px]" />
        </div>
        <span
          className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-[2.5px]"
          style={{ background: C.sage, borderColor: C.bg }}
        />
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[17px] font-[800] leading-tight" style={{ letterSpacing: -0.3, color: C.fg }}>
          <span style={{ color: C.primary }}>family</span>
          <span style={{ color: C.sub, fontWeight: 700 }}>.</span>
          budget
        </p>
        <p className="m-0 mt-px text-[11px] font-[700]" style={{ color: C.sage }}>
          онлайн · считает локально
        </p>
      </div>

      {/* Bell */}
      <button
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
        style={{ color: C.fg }}
      >
        <Bell size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
