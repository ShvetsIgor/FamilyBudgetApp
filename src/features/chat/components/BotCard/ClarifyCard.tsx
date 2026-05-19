'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ArrowRight, Scissors } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C, SHADOW } from '@/features/chat/styles/tokens';
import { useT } from '@/shared/hooks/useT';
import type { Category } from '@/shared/types';

interface ClarifyChip {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ClarifyCardProps {
  amount: number;
  currency: string;
  chips: ClarifyChip[];
  unknownNote?: string;
  storeName?: string;
  isRepeat?: boolean;
  categories?: Category[];
  onSelectChip: (chip: ClarifyChip) => void;
  onAllCategories: () => void;
  onOtherText?: (text: string) => void;
  onSplit?: () => void;
}

export function ClarifyCard({
  amount, currency, chips, unknownNote, storeName, categories,
  onSelectChip, onAllCategories, onOtherText, onSplit,
}: ClarifyCardProps) {
  const t = useT();
  const [selectedParent, setSelectedParent] = useState<ClarifyChip | null>(null);
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherMode) inputRef.current?.focus();
  }, [otherMode]);

  const headerText = selectedParent
    ? t.cat(selectedParent.name)
    : storeName
      ? t('chat.clarify.atStore').replace('{store}', storeName)
      : unknownNote
        ? t('chat.clarify.unknown')
        : t('chat.clarify.common');

  const currentChips: ClarifyChip[] = selectedParent && categories
    ? categories
        .filter((c) => c.parentId === selectedParent.id)
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))
    : chips;

  const handleChipClick = (chip: ClarifyChip) => {
    if (!selectedParent && categories) {
      const subs = categories.filter((c) => c.parentId === chip.id);
      if (subs.length > 0) {
        setSelectedParent(chip);
        return;
      }
    }
    onSelectChip(chip);
  };

  const handleOtherSubmit = () => {
    const trimmed = otherText.trim();
    if (!trimmed) return;
    if (onOtherText) {
      onOtherText(trimmed);
    } else {
      onAllCategories();
    }
    setOtherMode(false);
    setOtherText('');
  };

  const handleBack = () => {
    if (otherMode) {
      setOtherMode(false);
      setOtherText('');
    } else {
      setSelectedParent(null);
    }
  };

  return (
    <div className="p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        {(selectedParent || otherMode) && (
          <button
            onClick={handleBack}
            className="flex items-center active:opacity-50 transition-opacity"
            style={{ color: C.sub }}
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
        )}
        <p className="m-0 text-[10px] font-[800] uppercase tracking-[.08em]" style={{ color: C.sub }}>
          {otherMode ? t('chat.clarify.whatBought') : headerText}
        </p>
      </div>

      {otherMode ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleOtherSubmit(); }}
            placeholder={t('chat.clarify.whatBought')}
            className="flex-1 text-[13px] font-[700] outline-none bg-transparent"
            style={{
              color: C.fg,
              borderBottom: `1.5px solid ${C.hairline}`,
              paddingBottom: 4,
            }}
          />
          <button
            onClick={handleOtherSubmit}
            disabled={!otherText.trim()}
            className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: C.primary,
              color: '#fff',
              border: 'none',
              flexShrink: 0,
            }}
          >
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {currentChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-[800] transition-all active:scale-95"
              style={{
                padding: '7px 12px 7px 7px',
                borderRadius: 999,
                background: C.card,
                border: `1.5px solid ${C.hairline}`,
                color: C.fg,
                boxShadow: SHADOW.bubble,
              }}
            >
              <StickerIcon icon={chip.icon} color={chip.color} className="h-5 w-5" />
              {t.cat(chip.name)}
            </button>
          ))}

          {!selectedParent && (
            <button
              onClick={() => setOtherMode(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-[800] transition-all active:scale-95"
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                background: 'transparent',
                border: `1.5px dashed ${C.sub}77`,
                color: C.sub,
                boxShadow: SHADOW.bubble,
              }}
            >
              {t('chat.clarify.other')}
            </button>
          )}

          {!selectedParent && onSplit && (
            <button
              onClick={onSplit}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-[800] transition-all active:scale-95"
              style={{
                padding: '7px 12px 7px 10px',
                borderRadius: 999,
                background: 'transparent',
                border: `1.5px dashed ${C.sub}77`,
                color: C.sub,
                boxShadow: SHADOW.bubble,
              }}
            >
              <Scissors size={13} strokeWidth={2.5} />
              {t('chat.clarify.split')}
            </button>
          )}
        </div>
      )}

      {!selectedParent && !otherMode && (
        <>
          <button
            onClick={onAllCategories}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-[800]"
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: 'transparent',
              border: `1.5px dashed ${C.sub}44`,
              color: C.sub,
            }}
          >
            <Search size={14} />
            {t('chat.clarify.all')}
          </button>

          <p className="m-0 mt-2.5 text-[11px] font-[700]" style={{ color: C.sub }}>
            {t('chat.clarify.promise')}
          </p>
        </>
      )}
    </div>
  );
}
