'use client';

import { useState, useRef } from 'react';
import { Plus, Mic, Send } from 'lucide-react';
import { C } from '@/features/chat/styles/tokens';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const COMMANDS = [
  { cmd: '/баланс', hint: 'конверты за месяц' },
  { cmd: '/неделя', hint: 'итог недели' },
  { cmd: '/помощь', hint: 'как пользоваться' },
];

export function Composer({ onSend, disabled }: ComposerProps) {
  const [value, setValue] = useState('');
  const [showHints, setShowHints] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setShowHints(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setShowHints(false);
  }

  function selectCommand(cmd: string) {
    setValue(cmd);
    setShowHints(false);
    inputRef.current?.focus();
  }

  const focused = value.length > 0;

  return (
    <div className="flex-shrink-0" style={{ background: C.bg }}>
      {/* Command hints popup */}
      {showHints && (
        <div
          className="mx-3 mb-2 overflow-hidden rounded-[18px]"
          style={{
            background: C.card,
            border: `1.5px solid ${C.hairline}`,
            boxShadow: '0 8px 24px rgba(61,44,31,.10)',
          }}
        >
          {COMMANDS.map(({ cmd, hint }) => (
            <button
              key={cmd}
              onClick={() => selectCommand(cmd)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-black/5"
            >
              <span className="text-[13.5px] font-[900]" style={{ color: C.primary }}>{cmd}</span>
              <span className="text-[12px] font-[700]" style={{ color: C.sub }}>{hint}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className="flex items-center gap-2 px-3 pb-3 pt-2.5"
        style={{ borderTop: `1px solid ${C.hairline}` }}
      >
        {/* + button (placeholder) */}
        <button
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-colors"
          style={{ color: C.sub }}
          onClick={() => alert('Скоро: фото чека и голосовой ввод')}
        >
          <Plus size={22} strokeWidth={2.2} />
        </button>

        {/* Input field */}
        <div
          className="flex flex-1 items-center gap-2 transition-all"
          style={{
            background: C.card,
            borderRadius: 22,
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
            placeholder="Запиши быстро…"
            disabled={disabled}
            className="flex-1 bg-transparent text-[14.5px] font-[700] outline-none"
            style={{ color: C.fg }}
          />
          {/* ? hint button */}
          <button
            onClick={() => setShowHints((v) => !v)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-[900] transition-all"
            style={{
              background: showHints ? C.primary : C.hairline,
              color: showHints ? 'white' : C.sub,
            }}
          >
            ?
          </button>
        </div>

        {/* Send / Mic */}
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
            onClick={() => alert('Голосовой ввод — скоро')}
          >
            <Mic size={22} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
