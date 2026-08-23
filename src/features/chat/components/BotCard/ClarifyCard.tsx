'use client';

import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, ChevronLeft, ArrowRight, Scissors, FolderPlus } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { SHADOW } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';
import { haptic } from '@/shared/utils/haptics';
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
  isTagLearning?: boolean;
  /** Merchant is habitually split — lead with split, don't offer whole-amount chips. */
  suggestSplit?: boolean;
  categories?: Category[];
  onSelectChip: (chip: ClarifyChip) => void;
  onAllCategories: () => void;
  onOtherText?: (text: string) => void;
  onSplit?: () => void;
  onDefer?: () => void;
  onCreateFolder?: (name: string) => void;
}

/** Quiet text-style action in the clarify card's secondary row (44pt target). */
function SecondaryAction({ icon: Icon, label, onClick, color }: {
  icon?: typeof Scissors;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[12.5px] font-bold transition-opacity active:opacity-50"
      style={{ color, background: 'transparent', border: 'none' }}
    >
      {Icon && <Icon size={13} strokeWidth={2.4} />}
      {label}
    </button>
  );
}

/** Full-width choice shown when the bot has no earned suggestion to offer. */
function DoorAction({ icon: Icon, label, onClick, C, primary }: {
  icon: typeof Scissors;
  label: string;
  onClick: () => void;
  C: ReturnType<typeof useChatTokens>;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary
        ? 'flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] text-sm font-extrabold transition-all active:scale-95'
        : 'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[14px] text-[13px] font-extrabold transition-all active:scale-95'}
      style={primary
        ? { background: `${C.primary}14`, border: `1.5px solid ${C.primary}55`, color: C.primary }
        : { background: C.card, border: `1.5px solid ${C.hairline}`, color: C.fg, boxShadow: SHADOW.bubble }}
    >
      <Icon size={19} strokeWidth={2} />
      {label}
    </button>
  );
}

export function ClarifyCard({
  amount, currency, chips, unknownNote, storeName, isRepeat, isTagLearning, suggestSplit, categories,
  onSelectChip, onAllCategories, onOtherText, onSplit, onDefer, onCreateFolder,
}: ClarifyCardProps) {
  const C = useChatTokens();
  const t = useT();
  const [selectedParent, setSelectedParent] = useState<ClarifyChip | null>(null);
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [createFolderMode, setCreateFolderMode] = useState(false);
  const [folderName, setFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherMode) inputRef.current?.focus();
  }, [otherMode]);

  useEffect(() => {
    if (createFolderMode) folderInputRef.current?.focus();
  }, [createFolderMode]);

  const handleFolderSubmit = () => {
    const trimmed = folderName.trim();
    if (!trimmed) return;
    if (onCreateFolder) onCreateFolder(trimmed);
    setCreateFolderMode(false);
    setFolderName('');
  };

  const headerText = selectedParent
    ? t.cat(selectedParent.name)
    : suggestSplit && storeName
      ? t('chat.clarify.usuallySplit').replace('{store}', storeName)
    : createFolderMode
      ? t('chat.clarify.newFolder')
      : storeName && isTagLearning
      ? t('chat.clarify.whatIs').replace('{store}', storeName)
      : storeName
        ? t('chat.clarify.atStore').replace('{store}', storeName)
        : isRepeat
          ? t('chat.clarify.refine')
          : unknownNote
            ? t('chat.clarify.unknown')
            : t('chat.clarify.common');

  const currentChips: ClarifyChip[] = selectedParent && categories
    ? categories
        .filter((c) => c.folderId === selectedParent.id)
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))
    : chips;

  const hasChips = currentChips.length > 0;

  const handleChipClick = (chip: ClarifyChip) => {
    haptic('tap');
    // In tag-learning mode chips are folders — select directly, no drill-down
    if (!isTagLearning && !selectedParent && categories) {
      const subs = categories.filter((c) => c.folderId === chip.id);
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
    if (createFolderMode) {
      setCreateFolderMode(false);
      setFolderName('');
    } else if (otherMode) {
      setOtherMode(false);
      setOtherText('');
    } else {
      setSelectedParent(null);
    }
  };

  return (
    <div className="p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        {(selectedParent || otherMode || createFolderMode) && (
          <button
            type="button"
            onClick={handleBack}
            className="fb-touch-target -ml-2 flex h-11 w-11 items-center justify-center rounded-xl active:opacity-50 transition-opacity"
            style={{ color: C.sub }}
            aria-label={t('common.back')}
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
        )}
        <p className="m-0 text-xs font-extrabold uppercase tracking-[.08em]" style={{ color: C.sub }}>
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
            className="flex-1 text-[13px] font-bold outline-hidden bg-transparent"
            style={{
              color: C.fg,
              borderBottom: `1.5px solid ${C.hairline}`,
              paddingBottom: 4,
            }}
          />
          <button
            type="button"
            onClick={handleOtherSubmit}
            disabled={!otherText.trim()}
            className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: C.primary,
              color: '#fff',
              border: 'none',
              flexShrink: 0,
            }}
            aria-label={t('chat.composer.send')}
          >
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : createFolderMode ? (
        <div className="flex items-center gap-2">
          <input
            ref={folderInputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFolderSubmit(); }}
            placeholder={t('chat.clarify.folderName')}
            className="flex-1 text-[13px] font-bold outline-hidden bg-transparent"
            style={{
              color: C.fg,
              borderBottom: `1.5px solid ${C.hairline}`,
              paddingBottom: 4,
            }}
          />
          <button
            type="button"
            onClick={handleFolderSubmit}
            disabled={!folderName.trim()}
            className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: C.primary,
              color: '#fff',
              border: 'none',
              flexShrink: 0,
            }}
            aria-label={t('chat.composer.send')}
          >
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : hasChips ? (
        /* Earned suggestions only — the bot proposes a category solely when
           merchant history or a known word backs it. Everything else lives in
           the quiet row below. */
        <div className="flex flex-wrap gap-1.5">
          {currentChips.map((chip) => (
            <button
              type="button"
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold transition-all active:scale-95"
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
      ) : (
        /* Nothing is known about this merchant yet, so the card offers the two
           real doors instead of inventing chips: pick a category, or split the
           receipt. Guessing here is what made the suggestions untrustworthy. */
        suggestSplit && onSplit ? (
          /* Habitually split here — one obvious action, category as the escape */
          <div className="flex flex-col gap-2">
            <DoorAction icon={Scissors} label={t('chat.clarify.split')} onClick={onSplit} C={C} primary />
            <SecondaryAction icon={LayoutGrid} label={t('chat.clarify.all')} onClick={onAllCategories} color={C.sub} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <DoorAction icon={LayoutGrid} label={t('chat.clarify.all')} onClick={onAllCategories} C={C} />
            {onSplit && (
              <DoorAction icon={Scissors} label={t('chat.clarify.split')} onClick={onSplit} C={C} />
            )}
          </div>
        )
      )}

      {!selectedParent && !otherMode && !createFolderMode && (
        <div
          className={hasChips ? 'mt-2 flex flex-wrap items-center gap-x-0.5 pt-1.5' : 'mt-2 flex flex-wrap items-center justify-center gap-x-0.5'}
          style={hasChips ? { borderTop: `1px solid ${C.hairline}` } : undefined}
        >
          {hasChips && onSplit && (
            <SecondaryAction icon={Scissors} label={t('chat.clarify.split')} onClick={onSplit} color={C.sub} />
          )}
          {hasChips && (
            <SecondaryAction icon={LayoutGrid} label={t('chat.clarify.all')} onClick={onAllCategories} color={C.sub} />
          )}
          {onOtherText && (
            <SecondaryAction label={t('chat.clarify.other')} onClick={() => setOtherMode(true)} color={C.sub} />
          )}
          {/* Kept on purpose: some people log the total now and sort receipts
              once a week. It files the expense under «Неразобранное». */}
          {onDefer && (
            <SecondaryAction label={t('chat.clarify.defer')} onClick={onDefer} color={C.sub} />
          )}
          {isTagLearning && onCreateFolder && (
            <SecondaryAction
              icon={FolderPlus}
              label={t('chat.clarify.createFolder')}
              onClick={() => setCreateFolderMode(true)}
              color={C.sub}
            />
          )}
        </div>
      )}

      {/* The «I'll remember this word» promise only makes sense while actually
          learning an unknown merchant — elsewhere it read as noise */}
      {isTagLearning && !selectedParent && !otherMode && !createFolderMode && (
        <p className="m-0 mt-2 text-xs font-bold" style={{ color: C.sub }}>
          {t('chat.clarify.promise')}
        </p>
      )}
    </div>
  );
}
