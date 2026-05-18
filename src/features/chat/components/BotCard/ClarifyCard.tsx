'use client';

import { Search } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C, SHADOW } from '@/features/chat/styles/tokens';
import { useT } from '@/shared/hooks/useT';

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
  onSelectChip: (chip: ClarifyChip) => void;
  onAllCategories: () => void;
}

export function ClarifyCard({ amount, currency, chips, unknownNote, storeName, onSelectChip, onAllCategories }: ClarifyCardProps) {
  const t = useT();

  const headerText = storeName
    ? t('chat.clarify.atStore').replace('{store}', storeName)
    : unknownNote
      ? t('chat.clarify.unknown')
      : t('chat.clarify.common');

  return (
    <div className="p-3.5">
      <p className="m-0 mb-2 text-[10px] font-[800] uppercase tracking-[.08em]" style={{ color: C.sub }}>
        {headerText}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => onSelectChip(chip)}
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
      </div>

      <button
        onClick={onAllCategories}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-[800]"
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          background: 'transparent',
          border: `1.5px dashed ${C.sub}77`,
          color: C.sub,
        }}
      >
        <Search size={14} />
        {t('chat.clarify.all')}
      </button>

      <p className="m-0 mt-2.5 text-[11px] font-[700]" style={{ color: C.sub }}>
        {t('chat.clarify.promise')}
      </p>
    </div>
  );
}
