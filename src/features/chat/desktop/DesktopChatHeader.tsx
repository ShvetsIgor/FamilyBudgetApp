'use client';
import { useT } from '@/shared/hooks/useT';
import { Search, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { CommandPalette } from './CommandPalette';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { clearAllMessages } from '@/features/chat/services/messagesService';
import { setMessages } from '@/features/chat/store/chatSlice';

export function DesktopChatHeader() {
  const t = useT();
  const C = useChatTokens();
  const [cmdOpen, setCmdOpen] = useState(false);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const dispatch = useAppDispatch();

  const handleClearChat = useCallback(async () => {
    if (!userId) return;
    if (!window.confirm(t('chat.confirmClearChat'))) return;
    try {
      await clearAllMessages(userId);
    } finally {
      dispatch(setMessages([]));
    }
  }, [userId, dispatch, t]);

  return (
    <>
      <div
        className="h-16 shrink-0 flex items-center gap-3.5 px-6 border-b border-border"
        style={{ background: C.bg }}
      >
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}33)` }}
        >
          <StickerIcon icon="piggy" color={C.primary} className="h-7 w-7" />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black leading-tight" style={{ color: C.fg }}>
            {t('chat.desktop.personalBudget')}
          </p>
          <p className="text-[11px] font-bold" style={{ color: C.sage }}>
            {t('chat.desktop.botLocal')}
          </p>
        </div>

        {/* Clear chat */}
        <button
          onClick={handleClearChat}
          className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: C.sub }}
          title={t('chat.clearChat')}
          aria-label={t('chat.clearChat')}
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>

        {/* Search */}
        <button
          onClick={() => setCmdOpen(true)}
          className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: C.sub }}
          title={t('chat.desktop.searchShortcut')}
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      </div>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </>
  );
}
