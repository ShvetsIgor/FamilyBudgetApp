'use client';
import { useState, useEffect } from 'react';
import type { CategoryFolder, CategoryType } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { ColorPaletteRow } from './ColorPaletteRow';
import { IconPickerGrid } from './IconPickerGrid';
import { CC } from '../styles/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CategoryFolder>;
  type: CategoryType;
  onSave: (folder: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string }) => void;
  onDelete?: () => void;
}

export function FolderEditorSheet({ open, onClose, initial, type, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [color, setColor] = useState<string>(CC.primary);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setIcon(initial?.icon ?? 'box');
      setColor(initial?.color ?? CC.primary);
      setConfirmDelete(false);
    }
  }, [open, initial]);

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
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white dark:bg-neutral-900 shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#EDE0CC]" />
        </div>

        <div className="px-5 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#3D2C1F]">
              {initial?.id ? 'Редактировать папку' : 'Новая папка'}
            </h2>
            <button onClick={onClose} className="text-[#8E7A66] hover:text-[#3D2C1F] text-xl leading-none">✕</button>
          </div>

          {/* Live Preview */}
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: `${color}15` }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
              <StickerIcon icon={icon} color={color} className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-[#3D2C1F] text-sm">{name || 'Название папки'}</p>
              <p className="text-xs text-[#8E7A66]">{type === 'expense' ? 'Группа расходов' : 'Группа доходов'}</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название папки"
              className="w-full rounded-xl border border-[#EDE0CC] bg-white px-3 py-2.5 text-sm text-[#3D2C1F] outline-none focus:border-[#E07A5F] placeholder:text-[#B6A48E]"
            />
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">Иконка</label>
            <IconPickerGrid selected={icon} color={color} onSelect={setIcon} />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">Цвет</label>
            <ColorPaletteRow value={color} onChange={setColor} />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full rounded-2xl py-3 font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: CC.primary }}
          >
            Сохранить
          </button>

          {/* Delete */}
          {onDelete && (
            confirmDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(); onClose(); }}
                  className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-white bg-red-500"
                >
                  Удалить
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-[#8E7A66] border border-[#EDE0CC]"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-2xl py-2.5 text-sm font-semibold text-red-500 border border-red-100"
              >
                Удалить папку
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
