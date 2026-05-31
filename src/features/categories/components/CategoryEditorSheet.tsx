'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/store/store';
import type { Category, CategoryType } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { ColorPaletteRow } from './ColorPaletteRow';
import { BudgetField } from './BudgetField';
import { IconPickerGrid } from './IconPickerGrid';
import { CC } from '../styles/tokens';
import type { LibrarySuggestion } from '../utils/libraryLookup';
import { normalizeName } from '@/shared/utils/normalizeName';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Category>;
  type: CategoryType;
  folderId?: string;
  availableFolders?: import('@/shared/types').CategoryFolder[];
  onSave: (cat: Omit<Category, 'id' | 'userId'> & { id?: string; presetId?: string }) => void | Promise<void>;
  onDelete?: () => void;
  isWizardMode?: boolean;
  budget?: number;
  onBudgetChange?: (v: number | null) => void;
  suggestions?: LibrarySuggestion[];
}

export function CategoryEditorSheet({
  open,
  onClose,
  initial,
  type,
  folderId: folderIdProp,
  availableFolders = [],
  onSave,
  onDelete,
  isWizardMode = false,
  budget,
  onBudgetChange,
  suggestions = [],
}: Props) {
  const lang = useAppSelector((s) => s.ui.language) ?? 'ru';

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [color, setColor] = useState<string>(CC.primary);
  const [isPrivate, setIsPrivate] = useState(false);
  const [budgetVal, setBudgetVal] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [extraFolderIds, setExtraFolderIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(undefined);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setIcon(initial?.icon ?? 'box');
    setColor(initial?.color ?? CC.primary);
    setIsPrivate(initial?.isPrivate ?? false);
    setBudgetVal(budget ?? null);
    setConfirmDelete(false);
    setSelectedFolderId(initial?.folderId ?? folderIdProp ?? null);
    setExtraFolderIds(initial?.extraFolderIds ?? []);
    setTags(initial?.tags ?? []);
    setTagInput('');
    setSelectedPresetId(undefined);
    setSuggestionsOpen(false);
    setSaving(false);
  }, [open, initial, budget, folderIdProp]);

  const matchedSuggestions = useMemo(() => {
    const query = name.trim().toLowerCase();
    if (!query) return [];
    return suggestions
      .filter((suggestion) => suggestion.label.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(query);
        const bStarts = b.label.toLowerCase().startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);
  }, [name, suggestions]);

  if (!open) return null;

  const handleSave = async () => {
    const cleanName = normalizeName(name);
    if (!cleanName || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: cleanName,
        icon,
        color,
        isPrivate,
        folderId: selectedFolderId ?? undefined,
        extraFolderIds: extraFolderIds.filter((id) => id !== selectedFolderId),
        type,
        order: initial?.order ?? 0,
        tags,
        presetId: selectedPresetId,
      });
      // Always forward budget — including null/0 — so "Clear" persists on Save.
      if (onBudgetChange && type === 'expense') {
        await onBudgetChange(budgetVal);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#EDE0CC]" />
        </div>

        <div className="space-y-5 px-5 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#3D2C1F]">
              {initial?.id ? 'Редактировать' : 'Новая категория'}
            </h2>
            <button onClick={onClose} className="text-xl leading-none text-[#8E7A66] hover:text-[#3D2C1F]">✕</button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: `${color}15` }}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}25` }}>
              <StickerIcon icon={icon} color={color} className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3D2C1F]">{name || 'Название категории'}</p>
              <p className="text-xs text-[#8E7A66]">{type === 'expense' ? 'Расходы' : 'Доходы'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Название</label>
            <input
              type="text"
              ref={nameInputRef}
              value={name}
              onFocus={() => {
                if (name.trim()) setSuggestionsOpen(true);
              }}
              onChange={(e) => {
                setName(e.target.value);
                setSelectedPresetId(undefined);
                setSuggestionsOpen(true);
              }}
              placeholder="Название категории"
              className="w-full rounded-xl border border-[#EDE0CC] bg-white px-3 py-2.5 text-sm text-[#3D2C1F] outline-none placeholder:text-[#B6A48E] focus:border-[#E07A5F]"
            />
            {suggestionsOpen && matchedSuggestions.length > 0 && (
              <div className="mt-1 overflow-hidden rounded-xl border border-[#EDE0CC] bg-white shadow-sm">
                {matchedSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    aria-label={`Выбрать подсказку ${suggestion.label}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setName(suggestion.label);
                      setIcon(suggestion.icon);
                      setColor(suggestion.color);
                      setSelectedPresetId(suggestion.id);
                      setSuggestionsOpen(false);
                      nameInputRef.current?.blur();
                    }}
                    className="block min-h-11 w-full px-3 py-2 text-left text-sm font-semibold text-[#3D2C1F] transition-colors hover:bg-[#F4ECDE]"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Иконка</label>
            <IconPickerGrid selected={icon} color={color} onSelect={setIcon} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Цвет</label>
            <ColorPaletteRow value={color} onChange={setColor} />
          </div>

          {type === 'expense' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">
                Бюджет в месяц <span className="font-normal normal-case">(необязательно)</span>
              </label>
              <BudgetField value={budgetVal} onChange={(value) => { setBudgetVal(value); onBudgetChange?.(value); }} />
            </div>
          )}

          {availableFolders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Раздел</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                  style={
                    selectedFolderId === null
                      ? { backgroundColor: '#3D2C1F', color: '#fff' }
                      : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                  }
                >
                  Без раздела
                </button>
                {availableFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={
                      selectedFolderId === folder.id
                        ? { backgroundColor: folder.color ?? CC.primary, color: '#fff' }
                        : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                    }
                  >
                    {selectedFolderId === folder.id ? '✓ ' : ''}{folder.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableFolders.length > 1 && selectedFolderId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">
                Также в разделах <span className="font-normal normal-case text-[#B6A48E]">(необязательно)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableFolders.filter((folder) => folder.id !== selectedFolderId).map((folder) => {
                  const checked = extraFolderIds.includes(folder.id);
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() =>
                        setExtraFolderIds((prev) => (
                          checked ? prev.filter((id) => id !== folder.id) : [...prev, folder.id]
                        ))
                      }
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                      style={
                        checked
                          ? { backgroundColor: folder.color ?? CC.primary, color: '#fff' }
                          : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                      }
                    >
                      {checked ? '✓ ' : ''}{folder.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">
              Теги <span className="font-normal normal-case text-[#B6A48E]">(для поиска)</span>
            </label>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F4ECDE] px-2.5 py-1 text-xs font-medium text-[#3D2C1F]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                    className="leading-none text-[#8E7A66] hover:text-[#E07A5F]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    const nextTag = tagInput.trim().toLowerCase();
                    if (!tags.includes(nextTag)) setTags((prev) => [...prev, nextTag]);
                    setTagInput('');
                  }
                }}
                placeholder="Добавить тег, Enter"
                className="flex-1 rounded-xl border border-[#EDE0CC] bg-white px-3 py-2 text-sm text-[#3D2C1F] outline-none placeholder:text-[#B6A48E] focus:border-[#E07A5F]"
              />
              <button
                type="button"
                onClick={() => {
                  const nextTag = tagInput.trim().toLowerCase();
                  if (nextTag && !tags.includes(nextTag)) setTags((prev) => [...prev, nextTag]);
                  setTagInput('');
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: '#E07A5F' }}
              >
                +
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#3D2C1F]">Приватная</p>
              <p className="text-xs text-[#8E7A66]">Скрыть от семьи</p>
            </div>
            <div
              onClick={() => setIsPrivate((value) => !value)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? 'bg-[#E07A5F]' : 'bg-[#EDE0CC]'}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
          </label>

          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="w-full rounded-2xl py-3 font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: CC.primary }}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>

          {onDelete && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(); onClose(); }}
                  className="flex-1 rounded-2xl bg-red-500 py-2.5 text-sm font-semibold text-white"
                >
                  Удалить
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-2xl border border-[#EDE0CC] py-2.5 text-sm font-semibold text-[#8E7A66]"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-2xl border border-red-100 py-2.5 text-sm font-semibold text-red-500"
              >
                Удалить категорию
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
