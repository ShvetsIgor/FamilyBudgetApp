'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from './CategoryIcon';
import { cn } from '@/shared/utils/cn';
import type { Category, CategoryType } from '@/shared/types';

interface Props {
  type: CategoryType;
  value?: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  parentsOnly?: boolean;
}

export function CategoryPicker({ type, value, onChange, placeholder = 'Select category', parentsOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const allCategories = useAppSelector((s) => s.categories[type]);

  const categories = parentsOnly
    ? allCategories.filter((c) => !c.parentId)
    : allCategories;

  const selected = allCategories.find((c) => c.id === value);
  const parents = categories.filter((c) => !c.parentId);

  const filtered = search
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  function select(cat: Category) {
    onChange(cat.id);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors',
          open && 'border-primary ring-2 ring-primary/20'
        )}
      >
        {selected ? (
          <>
            <CategoryIcon icon={selected.icon} color={selected.color} size="sm" />
            <span className="flex-1 font-medium">{selected.name}</span>
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
              placeholder="Search..."
              className="w-full rounded-lg bg-muted px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
            {(filtered ?? parents).map((cat) => (
              <CategoryRow key={cat.id} cat={cat} selected={value} onSelect={select} />
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
      )}
    </div>
  );
}

function CategoryRow({ cat, selected, onSelect }: { cat: Category; selected?: string; onSelect: (c: Category) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cat)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted',
        selected === cat.id && 'bg-primary/10'
      )}
    >
      <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
      <span className="flex-1 text-left">{cat.name}</span>
      {selected === cat.id && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}
