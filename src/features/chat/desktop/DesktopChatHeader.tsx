'use client';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { CommandPalette } from './CommandPalette';

export function DesktopChatHeader() {
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <>
      <div
        className="h-16 flex-shrink-0 flex items-center gap-3.5 px-6 border-b border-border"
        style={{ background: C.bg }}
      >
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}33)` }}
        >
          <StickerIcon icon="piggy" color={C.primary} className="h-7 w-7" />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-[900] leading-tight" style={{ color: C.fg }}>
            Личный бюджет
          </p>
          <p className="text-[11px] font-[700]" style={{ color: C.sage }}>
            ● бот считает локально · без сети
          </p>
        </div>

        {/* Search */}
        <button
          onClick={() => setCmdOpen(true)}
          className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: C.sub }}
          title="Поиск (⌘K)"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      </div>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </>
  );
}
