'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import type { Category } from '@/shared/types';

/**
 * Reusable folder-first category picker.
 *
 * Folders are treated as visual containers only; callers always receive a real
 * Category when a category is selected. This lets expense entry, category
 * management, and future flows share the same "iPhone folder" interaction.
 */
export interface CategoryPickerFolder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface CategoryFolderPickerViewProps {
  title: string;
  mode: 'single' | 'split';
  merchantLabel?: string;
  folders: CategoryPickerFolder[];
  categories: Category[];
  selectedCategoryIds?: string[];
  suggestedCategoryIds?: string[];
  initialFolderId?: string | null;
  accentColor?: string;
  onSelectCategory: (category: Category, folder?: CategoryPickerFolder | null) => void;
  onCreateFolder?: () => void;
  onCreateCategory?: (folderId: string | null) => void;
  onRequestClose?: () => void;
  closeOnSingleSelect?: boolean;
  showSearch?: boolean;
  variant?: 'sheet' | 'inline';
}

interface Props extends Omit<CategoryFolderPickerViewProps, 'onRequestClose' | 'closeOnSingleSelect' | 'showSearch' | 'variant'> {
  open: boolean;
  onClose: () => void;
}

const FALLBACK_COLOR = '#E07A5F';
const UNGROUPED_FOLDER_ID = '__ungrouped__';

export function CategoryFolderPickerSheet({
  open,
  onClose,
  ...props
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 lg:items-center lg:p-6" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] min-h-[68dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-background shadow-2xl lg:max-h-[760px] lg:max-w-[560px] lg:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <CategoryFolderPickerView
          {...props}
          onRequestClose={onClose}
          closeOnSingleSelect
          showSearch
          variant="sheet"
        />
      </div>
    </div>
  );
}

export function CategoryFolderPickerView({
  title,
  mode,
  merchantLabel,
  folders,
  categories,
  selectedCategoryIds = [],
  suggestedCategoryIds = [],
  initialFolderId = null,
  accentColor = FALLBACK_COLOR,
  onSelectCategory,
  onCreateFolder,
  onCreateCategory,
  onRequestClose,
  closeOnSingleSelect = false,
  showSearch = true,
  variant = 'inline',
}: CategoryFolderPickerViewProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);

  useEffect(() => {
    setQuery('');
    setFolderId(initialFolderId);
  }, [initialFolderId]);

  const selectedIds = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);
  const suggestedIds = useMemo(() => new Set(suggestedCategoryIds), [suggestedCategoryIds]);

  const catsByFolder = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const folder of folders) {
      map.set(
        folder.id,
        categories.filter((cat) => cat.folderId === folder.id || cat.extraFolderIds?.includes(folder.id)),
      );
    }
    map.set('', categories.filter((cat) => !cat.folderId));
    return map;
  }, [categories, folders]);

  const sortedCats = useMemo(() => {
    const suggestedIndex = new Map(suggestedCategoryIds.map((id, index) => [id, index]));
    return (list: Category[]) =>
      [...list].sort((a, b) => {
        const aSuggested = suggestedIndex.has(a.id) ? suggestedIndex.get(a.id)! : 999;
        const bSuggested = suggestedIndex.has(b.id) ? suggestedIndex.get(b.id)! : 999;
        if (aSuggested !== bSuggested) return aSuggested - bSuggested;
        return t.cat(a.name).localeCompare(t.cat(b.name));
      });
  }, [suggestedCategoryIds, t]);

  const queryResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sortedCats(categories.filter((cat) => {
      const display = t.cat(cat.name).toLowerCase();
      return display.includes(q) || cat.name.toLowerCase().includes(q) || cat.tags?.some((tag) => tag.toLowerCase().includes(q));
    }));
  }, [categories, query, sortedCats, t]);

  const suggestedCats = useMemo(
    () => sortedCats(categories.filter((cat) => suggestedIds.has(cat.id))).slice(0, 8),
    [categories, sortedCats, suggestedIds],
  );

  const currentFolder = folderId === UNGROUPED_FOLDER_ID
    ? { id: UNGROUPED_FOLDER_ID, name: t('categories.picker.ungrouped'), icon: 'box', color: accentColor }
    : folderId
      ? folders.find((folder) => folder.id === folderId) ?? null
      : null;
  const currentCats = currentFolder
    ? sortedCats(catsByFolder.get(currentFolder.id === UNGROUPED_FOLDER_ID ? '' : currentFolder.id) ?? [])
    : [];
  const ungroupedCats = sortedCats(catsByFolder.get('') ?? []);
  const showUngroupedTile = !folderId && ungroupedCats.length > 0;

  function selectCategory(cat: Category, folder?: CategoryPickerFolder | null) {
    onSelectCategory(cat, folder);
    if (closeOnSingleSelect && mode === 'single') onRequestClose?.();
  }

  return (
    <div className={cn(
      'flex min-h-0 flex-col',
      variant === 'sheet' && 'overflow-hidden',
      variant === 'inline' && 'rounded-[18px] border border-border bg-card',
    )}>
      {(variant === 'sheet' || folderId) && (
        <div className={cn(
          'flex items-center gap-2 px-4 pb-3 pt-4',
          variant === 'sheet' && 'border-b border-border',
          variant === 'inline' && 'border-b border-border bg-background/40',
        )}>
          {folderId ? (
            <button
              type="button"
              onClick={() => setFolderId(null)}
              aria-label="Назад к разделам"
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted active:bg-muted"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-1" />
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-black leading-tight text-foreground">
              {folderId ? t.cat(currentFolder?.name ?? '') : title}
            </div>
            <div className="truncate text-[11px] font-bold text-muted-foreground">
              {folderId
                ? t('categories.picker.folderHint')
                : merchantLabel
                  ? t('categories.picker.merchantHint', { merchant: merchantLabel })
                  : t('categories.picker.foldersOnlyHint')}
            </div>
          </div>

          {onRequestClose ? (
            <button
              type="button"
              onClick={onRequestClose}
              aria-label="Закрыть"
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted active:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-1" />
          )}
        </div>
      )}

      {showSearch && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus={variant === 'sheet'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('categories.search')}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cn(
        'flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 [scrollbar-width:none]',
        variant === 'inline' && 'overflow-visible',
      )}>
          {query ? (
            <CategoryGrid
              cats={queryResults}
              selectedIds={selectedIds}
              suggestedIds={suggestedIds}
              emptyLabel={t('expenses.noResults')}
              onSelect={(cat) => selectCategory(cat, folders.find((folder) => cat.folderId === folder.id) ?? null)}
            />
          ) : folderId ? (
            <div className="space-y-4">
              <CategoryGrid
                cats={currentCats}
                selectedIds={selectedIds}
                suggestedIds={suggestedIds}
                emptyLabel={t('categories.picker.emptyFolder')}
                onSelect={(cat) => selectCategory(cat, folderId === UNGROUPED_FOLDER_ID ? null : currentFolder)}
                trailing={onCreateCategory ? (
                  <CreateCategoryTile
                    color={currentFolder?.color ?? accentColor}
                    onClick={() => onCreateCategory(folderId === UNGROUPED_FOLDER_ID ? null : folderId)}
                  />
                ) : null}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {suggestedCats.length > 0 && (
                <section>
                  <SectionTitle color={accentColor}>{merchantLabel ? t('categories.picker.forMerchant', { merchant: merchantLabel }) : t('categories.picker.suggested')}</SectionTitle>
                  <CategoryGrid
                    cats={suggestedCats}
                    selectedIds={selectedIds}
                    suggestedIds={suggestedIds}
                    onSelect={(cat) => selectCategory(cat, folders.find((folder) => cat.folderId === folder.id) ?? null)}
                  />
                </section>
              )}

              <section>
                <SectionTitle color={accentColor}>{t('categories.picker.folders')}</SectionTitle>
                <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
                  {folders.map((folder) => (
                    <FolderTile
                      key={folder.id}
                      folder={folder}
                      cats={sortedCats(catsByFolder.get(folder.id) ?? [])}
                      selectedIds={selectedIds}
                      suggestedIds={suggestedIds}
                      onClick={() => setFolderId(folder.id)}
                    />
                  ))}
                  {showUngroupedTile && (
                    <FolderTile
                      folder={{ id: '', name: t('categories.picker.ungrouped'), icon: 'box', color: accentColor }}
                      cats={ungroupedCats}
                      selectedIds={selectedIds}
                      suggestedIds={suggestedIds}
                      onClick={() => setFolderId(UNGROUPED_FOLDER_ID)}
                    />
                  )}
                  {onCreateFolder && (
                    <button
                      type="button"
                      onClick={onCreateFolder}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <span className="flex aspect-square w-full max-w-[96px] items-center justify-center rounded-[22px] border-2 border-dashed bg-card text-muted-foreground">
                        <Plus className="h-7 w-7" />
                      </span>
                      <span className="max-w-[96px] text-[11px] font-black leading-tight text-muted-foreground">{t('categories.picker.createFolder')}</span>
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
      </div>
    </div>
  );
}

function SectionTitle({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-black uppercase tracking-[.08em]" style={{ color }}>
      {children}
    </div>
  );
}

function FolderTile({
  folder,
  cats,
  selectedIds,
  suggestedIds,
  onClick,
}: {
  folder: CategoryPickerFolder;
  cats: Category[];
  selectedIds: Set<string>;
  suggestedIds: Set<string>;
  onClick: () => void;
}) {
  const t = useT();
  const color = folder.color ?? FALLBACK_COLOR;
  const previewCats = cats.slice(0, 9);
  const hasSelected = cats.some((cat) => selectedIds.has(cat.id));
  const hasSuggested = cats.some((cat) => suggestedIds.has(cat.id));

  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 text-center active:scale-[0.98]">
      <span
        className={cn(
          'grid aspect-square w-full max-w-[96px] grid-cols-3 grid-rows-3 gap-1 rounded-[22px] border p-2 shadow-sm transition-all',
          hasSelected && 'ring-2 ring-offset-2 ring-offset-background',
        )}
        style={{
          background: color + '17',
          borderColor: hasSuggested ? color + '99' : color + '33',
          color,
          '--tw-ring-color': color,
        } as CSSProperties}
      >
        {previewCats.length > 0 ? previewCats.map((cat) => (
          <span key={cat.id} className="flex items-center justify-center rounded-lg bg-background/80">
            <StickerIcon icon={cat.icon ?? 'box'} color={cat.color ?? color} className="h-4 w-4" />
          </span>
        )) : (
          <span className="col-span-3 row-span-3 flex items-center justify-center">
            <StickerIcon icon={folder.icon ?? 'box'} color={color} className="h-8 w-8" />
          </span>
        )}
      </span>
      <span className="max-w-[96px] text-[11px] font-black leading-tight text-foreground line-clamp-2">
        {t.cat(folder.name)}
      </span>
    </button>
  );
}

function CategoryGrid({
  cats,
  selectedIds,
  suggestedIds,
  emptyLabel,
  onSelect,
  trailing,
}: {
  cats: Category[];
  selectedIds: Set<string>;
  suggestedIds: Set<string>;
  emptyLabel?: string;
  onSelect: (cat: Category) => void;
  trailing?: ReactNode;
}) {
  const t = useT();

  if (cats.length === 0 && !trailing) {
    return <p className="py-8 text-center text-sm font-bold text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {cats.map((cat) => {
        const selected = selectedIds.has(cat.id);
        const suggested = suggestedIds.has(cat.id);
        const color = cat.color ?? FALLBACK_COLOR;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat)}
            className={cn(
              'relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-[14px] border bg-card px-1.5 py-2 text-center shadow-sm active:scale-[0.98]',
              selected && 'ring-2 ring-offset-2 ring-offset-background',
            )}
            style={{
              borderColor: selected || suggested ? color + '99' : 'hsl(var(--border))',
              '--tw-ring-color': color,
            } as CSSProperties}
          >
            <StickerIcon icon={cat.icon ?? 'box'} color={color} className="h-6 w-6" />
            <span className="max-w-full text-[10px] font-black leading-tight text-foreground line-clamp-2 [overflow-wrap:anywhere]">
              {t.cat(cat.name)}
            </span>
            {selected && (
              <span className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: color }}>
                <Check className="h-3 w-3 text-white" />
              </span>
            )}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

function CreateCategoryTile({ color, onClick }: { color: string; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed bg-card px-1.5 py-2 text-center active:scale-[0.98]"
      style={{ borderColor: color + '66', color }}
    >
      <Plus className="h-6 w-6" />
      <span className="text-[10px] font-black leading-tight">{t('categories.picker.create')}</span>
    </button>
  );
}
