'use client';

import { useState, useRef } from 'react';
import { Plus, Mic, Send } from 'lucide-react';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';
import { HelpSheet } from './HelpSheet';

interface ComposerProps {
  onSend: (text: string) => void;
  onPlus?: () => void;
  disabled?: boolean;
  variant?: 'mobile' | 'desktop';
}

export function Composer({ onSend, onPlus, disabled, variant = 'mobile' }: ComposerProps) {
  const t = useT();
  const [value, setValue] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const focused = value.length > 0;
  const isDesktop = variant === 'desktop';

  return (
    <div className="flex-shrink-0" style={{ background: C.bg }}>
      <div
        className="flex items-center gap-2 px-3 pt-2.5"
        style={{
          borderTop: `1px solid ${C.hairline}`,
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        }}
      >
        <button
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-colors active:opacity-60"
          style={{ color: C.sub }}
          onClick={onPlus}
        >
          <Plus size={22} strokeWidth={2.2} />
        </button>

        <div
          className="flex flex-1 items-center gap-2 transition-all"
          style={{
            background: C.card,
            borderRadius: isDesktop ? 14 : 22,
            padding: '9px 14px',
            border: `1.5px solid ${focused ? C.primary : C.hairline}`,
            minHeight: 40,
            boxShadow: focused ? `0 0 0 4px ${C.primary}18` : 'none',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.composer.placeholder')}
            disabled={disabled}
            className="flex-1 bg-transparent text-[14.5px] font-[700] outline-none"
            style={{ color: C.fg }}
          />
          <button
            onClick={() => setHelpOpen(true)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-[900] transition-all active:scale-90"
            style={{ background: C.hairline, color: C.sub }}
          >
            ?
          </button>
        </div>

        {focused ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-0 transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
              boxShadow: `0 6px 14px ${C.primaryDeep}55`,
            }}
          >
            <Send size={18} color="white" strokeWidth={2.6} />
          </button>
        ) : (
          <button
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-colors"
            style={{ color: C.sub }}
            onClick={onPlus}
          >
            <Mic size={22} strokeWidth={2} />
          </button>
        )}
      </div>

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
