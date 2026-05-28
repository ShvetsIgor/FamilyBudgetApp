'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryFolder, CategoryType } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { ColorPaletteRow } from './ColorPaletteRow';
import { IconPickerGrid } from './IconPickerGrid';
import { CC } from '../styles/tokens';
import type { LibrarySuggestion } from '../utils/libraryLookup';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CategoryFolder>;
  type: CategoryType;
  onSave: (folder: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string; presetId?: string }) => void;
  onDelete?: () => void;
  availableFolders?: import('@/shared/types').CategoryFolder[];
  suggestions?: LibrarySuggestion[];
}

export function FolderEditorSheet({
  open,
  onClose,
  initial,
  type,
  onSave,
  onDelete,
  availableFolders,
  suggestions = [],
}: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [color, setColor] = useState<string>(CC.primary);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | undefined>(undefined);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(undefined);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setIcon(initial?.icon ?? 'box');
    setColor(initial?.color ?? CC.primary);
    setConfirmDelete(false);
    setParentFolderId(initial?.parentFolderId);
    setSelectedPresetId(undefined);
    setSuggestionsOpen(false);
  }, [open, initial]);

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
      .slice(0, 5);
  }, [name, suggestions]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      icon,
      color,
      type,
      order: initial?.order ?? 0,
      parentFolderId,
      presetId: selectedPresetId,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#EDE0CC]" />
        </div>

        <div className="space-y-5 px-5 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#3D2C1F]">
              {initial?.id ? 'Редактировать раздел' : 'Новый раздел'}
            </h2>
            <button onClick={onClose} className="text-xl leading-none text-[#8E7A66] hover:text-[#3D2C1F]">✕</button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: `${color}15` }}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}25` }}>
              <StickerIcon icon={icon} color={color} className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3D2C1F]">{name || 'Название раздела'}</p>
              <p className="text-xs text-[#8E7A66]">{type === 'expense' ? 'Группа расходов' : 'Группа доходов'}</p>
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
              placeholder="Название раздела"
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

          {availableFolders && availableFolders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">
                Родительский раздел <span className="font-normal normal-case text-[#B6A48E]">(необязательно)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setParentFolderId(undefined)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                  style={
                    parentFolderId === undefined
                      ? { backgroundColor: '#3D2C1F', color: '#fff' }
                      : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                  }
                >
                  Без родителя
                </button>
                {availableFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setParentFolderId(folder.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                    style={
                      parentFolderId === folder.id
                        ? { backgroundColor: folder.color ?? '#E07A5F', color: '#fff' }
                        : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                    }
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Иконка</label>
            <IconPickerGrid selected={icon} color={color} onSelect={setIcon} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8E7A66]">Цвет</label>
            <ColorPaletteRow value={color} onChange={setColor} />
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full rounded-2xl py-3 font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: CC.primary }}
          >
            Сохранить
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
                Удалить раздел
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
