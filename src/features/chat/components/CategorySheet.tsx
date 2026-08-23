'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useT } from '@/shared/hooks/useT';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import type { Category } from '@/shared/types';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import { buildFolderSections } from '@/features/categories/utils/folderSections';

interface Chip {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CategorySheetProps {
  onSelect: (chip: Chip) => void;
  onClose: () => void;
  /** Override categories list (e.g. for income). Falls back to expense categories. */
  categories?: Category[];
}

const EMPTY_FOLDERS: never[] = [];

export function CategorySheet({ onSelect, onClose, categories: categoriesOverride }: CategorySheetProps) {
  const C = useChatTokens();
  const t = useT();
  const [query, setQuery] = useState('');
  const expenseCats = useAppSelector((s) => s.categories.expense);
  const expenseFolders = useAppSelector((s) => s.categories.folders.expense);
  const allCats = categoriesOverride ?? expenseCats;
  const folders = categoriesOverride ? EMPTY_FOLDERS : expenseFolders;

  const activeCats = useMemo(() => allCats.filter(isActiveCategory), [allCats]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return activeCats.filter((c) =>
      c.name.toLowerCase().includes(q) || t.cat(c.name).toLowerCase().includes(q)
    );
  }, [query, activeCats, t]);

  const sections = useMemo(() => buildFolderSections(folders, activeCats), [folders, activeCats]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-t-2xl overflow-hidden"
        style={{ background: C.bg, maxHeight: '75vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('categories.search')}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: C.card, border: `1px solid ${C.hairline}` }}
          >
            <Search size={16} style={{ color: C.sub }} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('categories.search')}
              className="flex-1 bg-transparent text-[14px] font-semibold outline-hidden"
              style={{ color: C.fg }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')} className="flex min-h-11 min-w-11 items-center justify-center">
                <X size={14} style={{ color: C.sub }} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="min-h-11 px-2 text-[13px] font-bold"
            style={{ color: C.sub }}
          >
            {t('common.cancel')}
          </button>
        </div>

        {/* Category list */}
        <div className="overflow-y-auto pb-8 px-4">
          {filtered ? (
            <div className="flex flex-col gap-0.5 pt-2">
              {filtered.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelect({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-60 transition-opacity text-left"
                  style={{ background: C.card }}
                >
                  <StickerIcon icon={cat.icon} color={cat.color} className="h-8 w-8 shrink-0" />
                  <p className="text-[13.5px] font-bold truncate flex-1" style={{ color: C.fg }}>
                    {t.cat(cat.name)}
                  </p>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-[13px] font-semibold" style={{ color: C.sub }}>
                  {t('expenses.noResults')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              {sections.map(({ folderId, folderName, folderColor, cats }, idx) => (
                <div key={folderId ?? `ungrouped-${idx}`}>
                  {folderId && (
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.08em]" style={{ color: folderColor ?? C.sub }}>
                      {folderName}
                    </p>
                  )}
                  {!folderId && sections.length > 1 && (
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.08em]" style={{ color: C.sub }}>
                      {t('chat.otherCategories')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {cats.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => onSelect({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                        className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-bold active:scale-95 transition-transform"
                        style={{
                          padding: '7px 12px 7px 7px',
                          borderRadius: 999,
                          background: C.card,
                          border: `1.5px solid ${C.hairline}`,
                          color: C.fg,
                        }}
                      >
                        <StickerIcon icon={cat.icon} color={cat.color} className="h-5 w-5" />
                        {t.cat(cat.name)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
