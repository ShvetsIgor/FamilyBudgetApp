'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, Send } from 'lucide-react';
import { useAppSelector } from '@/store/store';
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
  const C = useChatTokens();
  const t = useT();
  const language = useAppSelector((s) => s.ui.language);
  const [value, setValue] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Web Speech API — client-side, free, no backend required
  const speechSupported =
    typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => () => { recognitionRef.current?.stop?.(); }, []);

  function toggleVoice() {
    if (disabled) return;
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
      const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
      rec.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setValue(text);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

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

  const micButton = (
    <button
      onClick={speechSupported ? toggleVoice : onPlus}
      aria-label={t('chat.composer.voice')}
      title={t('chat.composer.voice')}
      className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl transition-all active:scale-95"
      style={{
        color: listening ? '#fff' : C.sub,
        background: listening ? 'hsl(var(--destructive))' : 'transparent',
      }}
    >
      <Mic size={22} strokeWidth={2} className={listening ? 'animate-pulse' : ''} />
    </button>
  );

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
            border: `1.5px solid ${listening ? 'hsl(var(--destructive))' : focused ? C.primary : C.hairline}`,
            minHeight: 40,
            boxShadow: focused && !listening ? `0 0 0 4px ${C.primary}18` : 'none',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={listening ? t('chat.composer.listening') : t('chat.composer.placeholder')}
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

        {listening ? micButton : focused ? (
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
        ) : micButton}
      </div>

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
