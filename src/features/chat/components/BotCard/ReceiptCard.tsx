'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight, ReceiptText } from 'lucide-react';
import type { Category, CategoryFolder } from '@/shared/types';
import type { ReceiptGroup } from '@/features/ai/receiptParser/receipt';
import type { ReceiptCardData } from '@/features/chat/services/receiptChat';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { CategoryFolderPickerSheet } from '@/features/categories/components/CategoryFolderPickerSheet';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { haptic } from '@/shared/utils/haptics';

interface ReceiptCardProps {
  data: ReceiptCardData;
  /** Active expense categories — the only ones a receipt amount may go to */
  categories: Category[];
  folders: CategoryFolder[];
  busy?: boolean;
  onSave: (groups: ReceiptGroup[]) => Promise<void>;
  onCancel: () => void;
}

/**
 * A read receipt, sorted into the user's categories. The model only
 * pre-fills: every amount — above all the part it could not read — gets a
 * category the user can see and change, and nothing is saved before that.
 */
export function ReceiptCard({ data, categories, folders, busy, onSave, onCancel }: ReceiptCardProps) {
  const C = useChatTokens();
  const t = useT();
  const locale = useDateFnsLocale();
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // A category archived since the card was made no longer counts as chosen
  const [picks, setPicks] = useState<(string | null)[]>(
    () => data.groups.map((g) => (g.categoryId && byId.has(g.categoryId) ? g.categoryId : null)),
  );
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const sym = getCurrencySymbol(data.currency);
  const missing = picks.filter((id) => !id || !byId.has(id)).length;
  const canSave = missing === 0 && !saving && !busy;

  async function save() {
    if (!canSave) return;
    haptic('tap');
    setSaving(true);
    try {
      await onSave(data.groups.map((group, i) => ({ ...group, categoryId: picks[i] })));
    } finally { setSaving(false); }
  }

  return (
    <div className="p-3.5">
      <div className="mb-2 flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: C.primaryTint, color: C.primary }}>
          <ReceiptText size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[14px] font-extrabold">{data.merchant ?? t('chat.receipt.title')}</p>
          <p className="m-0 text-xs font-bold" style={{ color: C.sub }}>
            {format(parseISO(data.date), 'd MMM yyyy', { locale })}
          </p>
        </div>
        <p className="m-0 shrink-0 text-[17px] font-black tabular-nums">{sym}{' '}{data.total}</p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {data.groups.map((group, i) => {
          const category = picks[i] ? byId.get(picks[i]!) : undefined;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => { haptic('tap'); setPickerFor(i); }}
                disabled={saving}
                aria-label={category
                  ? t('chat.receipt.changeCategory', { name: category.name })
                  : t('chat.receipt.chooseCategory')}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-all active:scale-[.99] disabled:opacity-60"
                style={{
                  background: category ? C.card : C.primaryTint,
                  border: `1.5px solid ${category ? C.hairline : C.primary}`,
                }}
              >
                {category
                  ? <StickerIcon icon={category.icon} color={category.color} className="h-6 w-6 shrink-0" />
                  : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed" style={{ borderColor: C.primary }} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-extrabold" style={{ color: category ? C.fg : C.primary }}>
                    {category?.name ?? (group.categoryId === null && group.names.length === 0
                      ? t('chat.receipt.unrecognized') : t('chat.receipt.chooseCategory'))}
                  </span>
                  {group.names.length > 0 && (
                    <span className="block truncate text-[11.5px] font-bold" style={{ color: C.sub }}>
                      {group.names.join(', ')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums">{sym}{' '}{group.amount}</span>
                <ChevronRight size={15} className="shrink-0" style={{ color: C.sub }} />
              </button>
            </li>
          );
        })}
      </ul>

      {missing > 0 && (
        <p className="m-0 mt-2 text-xs font-bold" style={{ color: C.sub }}>{t('chat.receipt.assignHint')}</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        aria-busy={saving}
        className="mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-none bg-primary text-sm font-extrabold text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
      >
        {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {t('chat.receipt.save', { amount: `${sym} ${data.total}` })}
      </button>
      <div className="mt-1 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 rounded-lg px-2 text-[12.5px] font-bold active:opacity-50 disabled:opacity-40"
          style={{ color: C.sub }}
        >
          {t('chat.receipt.cancel')}
        </button>
      </div>

      {/* Portalled: a fixed sheet inside a chat bubble is at the mercy of every
          transformed ancestor, which turns «fixed» into «relative to the bubble» */}
      {pickerFor !== null && typeof document !== 'undefined' && createPortal(<CategoryFolderPickerSheet
        open
        onClose={() => setPickerFor(null)}
        title={t('categories.selectCategory')}
        mode="single"
        merchantLabel={data.merchant ?? undefined}
        folders={folders}
        categories={categories}
        selectedCategoryIds={pickerFor !== null && picks[pickerFor] ? [picks[pickerFor]!] : []}
        onSelectCategory={(category) => {
          const index = pickerFor;
          if (index === null) return;
          setPicks((prev) => prev.map((id, i) => (i === index ? category.id : id)));
          setPickerFor(null);
        }}
      />, document.body)}
    </div>
  );
}
