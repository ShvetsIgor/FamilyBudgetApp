'use client';

import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { STARTER_CATEGORY_IDS, starterOptions } from '@/features/categories/services/starterCategories';
import { SHADOW } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import { haptic } from '@/shared/utils/haptics';

interface StarterCategoriesCardProps {
  pendingText: string;
  /** Persisted once setup is done: the card turns into a quiet receipt. */
  resolvedCount?: number;
  /** Categories appeared meanwhile (another card, another device): only finish the message. */
  hasCategories: boolean;
  /** Another chat operation is running. */
  busy?: boolean;
  onActivate: (ids: string[]) => Promise<void>;
  onContinue: () => Promise<void>;
  onCustom: () => void;
}

export function StarterCategoriesCard({
  pendingText, resolvedCount, hasCategories, busy, onActivate, onContinue, onCustom,
}: StarterCategoriesCardProps) {
  const C = useChatTokens();
  const t = useT();
  const language = useAppSelector((s) => s.ui.language);
  const options = useMemo(() => starterOptions(language), [language]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(STARTER_CATEGORY_IDS));
  const [saving, setSaving] = useState(false);

  const quote = (
    <span className="line-clamp-2 font-extrabold" style={{ color: C.fg }}>«{pendingText}»</span>
  );

  if (resolvedCount !== undefined) {
    return (
      <div className="flex items-start gap-2 p-3.5 text-[13px] font-bold" style={{ color: C.sub }}>
        <Check size={16} strokeWidth={2.6} className="mt-0.5 shrink-0" style={{ color: C.sage }} />
        <div className="min-w-0">
          <p className="m-0">
            {resolvedCount > 0 ? t('chat.starter.resolved', { n: resolvedCount }) : t('chat.starter.resolvedExisting')}
          </p>
          {quote}
        </div>
      </div>
    );
  }

  const run = async (action: () => Promise<void>) => {
    if (saving || busy) return;
    haptic('tap');
    setSaving(true);
    try { await action(); } finally { setSaving(false); }
  };

  const toggle = (id: string) => {
    haptic('tap');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const disabled = saving || busy || (!hasCategories && selected.size === 0);
  const primaryLabel = hasCategories ? t('chat.starter.continue') : t('chat.starter.add');

  return (
    <div className="p-3.5">
      <p className="m-0 mb-1 text-xs font-extrabold uppercase tracking-[.08em]" style={{ color: C.sub }}>
        {t('chat.starter.title')}
      </p>
      <p className="m-0 mb-2.5 text-[13px] font-bold" style={{ color: C.sub }}>
        {hasCategories ? t('chat.starter.introExisting') : t('chat.starter.intro')} {quote}
      </p>

      {!hasCategories && (
        <div className="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label={t('chat.starter.title')}>
          {options.map((option) => {
            const on = selected.has(option.id);
            return (
              <button
                type="button"
                key={option.id}
                aria-pressed={on}
                disabled={saving}
                onClick={() => toggle(option.id)}
                className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-extrabold transition-all active:scale-95 disabled:opacity-60"
                style={{
                  padding: '7px 12px 7px 7px',
                  borderRadius: 999,
                  background: on ? C.primaryTint : C.card,
                  border: `1.5px solid ${on ? C.primary : C.hairline}`,
                  color: on ? C.primary : C.sub,
                  boxShadow: on ? 'none' : SHADOW.bubble,
                }}
              >
                <StickerIcon icon={option.icon} color={option.color} className="h-5 w-5" />
                {option.name}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-busy={saving}
        onClick={() => run(hasCategories ? onContinue : () => onActivate(options.filter((o) => selected.has(o.id)).map((o) => o.id)))}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-none bg-primary text-sm font-extrabold text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
      >
        {saving && (
          <span
            data-testid="starter-spinner"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {primaryLabel}
      </button>

      {!hasCategories && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={onCustom}
            disabled={saving || busy}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-[12.5px] font-bold transition-opacity active:opacity-50 disabled:opacity-40"
            style={{ color: C.sub, background: 'transparent', border: 'none' }}
          >
            <Plus size={13} strokeWidth={2.4} />
            {t('chat.starter.custom')}
          </button>
        </div>
      )}
    </div>
  );
}
