'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useT } from '@/shared/hooks/useT';
import { C } from '@/features/chat/styles/tokens';
import type { Category } from '@/shared/types';

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

export function CategorySheet({ onSelect, onClose, categories: categoriesOverride }: CategorySheetProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const expenseCats = useAppSelector((s) => s.categories.expense);
  const allCats = categoriesOverride ?? expenseCats;

  const parents = useMemo(() => allCats.filter((c) => !c.parentId), [allCats]);
  const subs = useMemo(() => allCats.filter((c) => !!c.parentId), [allCats]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return allCats.filter((c) =>
      c.name.toLowerCase().includes(q) || t.cat(c.name).toLowerCase().includes(q)
    );
  }, [query, allCats, t]);

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
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: C.card, border: `1px solid ${C.hairline}` }}
          >
            <Search size={15} style={{ color: C.sub }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('categories.search')}
              className="flex-1 bg-transparent text-[14px] font-[600] outline-none"
              style={{ color: C.fg }}
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X size={14} style={{ color: C.sub }} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[13px] font-[700]"
            style={{ color: C.sub }}
          >
            {t('common.cancel')}
          </button>
        </div>

        {/* Category list */}
        <div className="overflow-y-auto pb-8 px-4">
          {filtered ? (
            <div className="flex flex-col gap-0.5 pt-2">
              {filtered.map((cat) => {
                const parent = cat.parentId ? allCats.find((c) => c.id === cat.parentId) : null;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { onSelect({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }); }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-60 transition-opacity text-left"
                    style={{ background: C.card }}
                  >
                    <StickerIcon icon={cat.icon} color={cat.color} className="h-8 w-8 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-[700] truncate" style={{ color: C.fg }}>
                        {t.cat(cat.name)}
                      </p>
                      {parent && (
                        <p className="text-[11px] font-[600]" style={{ color: C.sub }}>
                          {t.cat(parent.name)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-[13px] font-[600]" style={{ color: C.sub }}>
                  {t('expenses.noResults')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              {parents.map((parent) => {
                const children = subs.filter((c) => c.parentId === parent.id);
                const chips: Chip[] = [
                  { id: parent.id, name: parent.name, icon: parent.icon, color: parent.color },
                  ...children.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })),
                ];
                return (
                  <div key={parent.id}>
                    <p className="mb-1.5 text-[10px] font-[800] uppercase tracking-[.08em]" style={{ color: C.sub }}>
                      {t.cat(parent.name)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => onSelect(chip)}
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-[700] active:scale-95 transition-transform"
                          style={{
                            padding: '7px 12px 7px 7px',
                            borderRadius: 999,
                            background: C.card,
                            border: `1.5px solid ${C.hairline}`,
                            color: C.fg,
                          }}
                        >
                          <StickerIcon icon={chip.icon} color={chip.color} className="h-5 w-5" />
                          {t.cat(chip.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
