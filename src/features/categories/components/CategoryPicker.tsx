'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from './CategoryIcon';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import type { Category, CategoryType } from '@/shared/types';
import { selectFolders, selectAllActiveCategories } from '../store/selectors';
import { buildFolderSections } from '../utils/folderSections';

interface Props {
  type: CategoryType;
  value?: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  /** Show only categories not assigned to any folder */
  ungroupedOnly?: boolean;
  /** Show only categories assigned to a folder */
  groupedOnly?: boolean;
}

export function CategoryPicker({
  type,
  value,
  onChange,
  placeholder,
  ungroupedOnly = false,
  groupedOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const activeCats = useAppSelector((s) => selectAllActiveCategories(s, type));
  const allCats = useAppSelector((s) => s.categories[type]); // includes archived for selected-value lookup
  const folders = useAppSelector((s) => selectFolders(s, type));
  const t = useT();

  const categories = ungroupedOnly
    ? activeCats.filter((c) => !c.folderId)
    : groupedOnly
      ? activeCats.filter((c) => !!c.folderId)
      : activeCats;

  const selected = allCats.find((c) => c.id === value);

  const filtered = search
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        t.cat(c.name).toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  function select(cat: Category) {
    onChange(cat.id);
    setOpen(false);
    setSearch('');
  }

  const renderList = () => {
    const list = filtered ?? categories;

    if (search) {
      return list.map((cat) => (
        <CategoryRowItem key={cat.id} cat={cat} displayName={t.cat(cat.name)} selected={value} onSelect={select} />
      ));
    }

    // Group by folder; ungrouped categories shown at the end without a header
    const sections = buildFolderSections(folders, list);

    return sections.flatMap(({ folderId, folderName, cats }) => [
      folderId ? (
        <div key={`header-${folderId}`} className="px-2 pt-2 pb-0.5">
          <span className="block truncate text-[10px] font-bold leading-tight text-[#8E7A66] uppercase tracking-wide">{folderName}</span>
        </div>
      ) : null,
      ...cats.map((cat) => (
        <CategoryRowItem key={cat.id} cat={cat} displayName={t.cat(cat.name)} selected={value} onSelect={select} indent={!!folderId} />
      )),
    ].filter(Boolean));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors',
          open && 'border-primary ring-2 ring-primary/20',
        )}
      >
        {selected ? (
          <>
            <CategoryIcon icon={selected.icon} color={selected.color} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium leading-tight">{t.cat(selected.name)}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('categories.search')}
              className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-hidden placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-0.5">
            {renderList()}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
      )}
    </div>
  );
}

function CategoryRowItem({
  cat,
  displayName,
  selected,
  onSelect,
  indent = false,
}: {
  cat: Category;
  displayName: string;
  selected?: string;
  onSelect: (c: Category) => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cat)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted',
        selected === cat.id && 'bg-primary/10',
        indent && 'pl-5',
      )}
    >
      <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
      <span className="min-w-0 flex-1 text-left text-[13px] leading-tight line-clamp-2 break-normal wrap-normal [word-break:normal] hyphens-none">{displayName}</span>
      {selected === cat.id && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}
