'use client';
import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import type { Category, CategoryType } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { ColorPaletteRow } from './ColorPaletteRow';
import { BudgetField } from './BudgetField';
import { IconPickerGrid } from './IconPickerGrid';
import { CC } from '../styles/tokens';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

interface TaxSub { id: string; name: string; ru?: string; icon: string }

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Category>;
  type: CategoryType;
  parentId?: string;
  onSave: (cat: Omit<Category, 'id' | 'userId'> & { id?: string }) => void;
  onDelete?: () => void;
  isWizardMode?: boolean;
  budget?: number;
  onBudgetChange?: (v: number | null) => void;
  // subcategory management
  existingSubs?: Category[];
  taxonomySubs?: TaxSub[];
  onSubsChange?: (toAdd: TaxSub[], toRemove: string[], customNames: string[]) => void;
}

function getTaxSubName(sub: TaxSub, lang: string) {
  return lang === 'ru' ? (sub.ru ?? sub.name) : sub.name;
}

export function CategoryEditorSheet({
  open,
  onClose,
  initial,
  type,
  parentId,
  onSave,
  onDelete,
  isWizardMode = false,
  budget,
  onBudgetChange,
  existingSubs,
  taxonomySubs,
  onSubsChange,
}: Props) {
  const lang = useAppSelector((s) => s.ui.language) ?? 'ru';

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [color, setColor] = useState<string>(CC.primary);
  const [isPrivate, setIsPrivate] = useState(false);
  const [budgetVal, setBudgetVal] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // subs state
  const [enabledSubIds, setEnabledSubIds] = useState<Set<string>>(new Set());
  const [customSubName, setCustomSubName] = useState('');
  const [showAddSub, setShowAddSub] = useState(false);
  const [customSubs, setCustomSubs] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setIcon(initial?.icon ?? 'box');
      setColor(initial?.color ?? CC.primary);
      setIsPrivate(initial?.isPrivate ?? false);
      setBudgetVal(budget ?? null);
      setConfirmDelete(false);
      setEnabledSubIds(new Set(existingSubs?.map((s) => s.id) ?? []));
      setCustomSubs([]);
      setCustomSubName('');
      setShowAddSub(false);
    }
  }, [open, initial, budget, existingSubs]);

  if (!open) return null;

  const toggleSub = (id: string) =>
    setEnabledSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addCustomSub = () => {
    const trimmed = customSubName.trim();
    if (trimmed) {
      setCustomSubs((prev) => [...prev, trimmed]);
      setCustomSubName('');
      setShowAddSub(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      icon,
      color,
      isPrivate,
      parentId,
      type,
      order: initial?.order ?? 0,
    });
    if (onBudgetChange && budgetVal !== null) {
      onBudgetChange(budgetVal);
    }
    // subcategory diff
    if (onSubsChange && (taxonomySubs || customSubs.length > 0)) {
      const existingIds = new Set(existingSubs?.map((s) => s.id) ?? []);
      const toAdd = (taxonomySubs ?? []).filter(
        (s) => enabledSubIds.has(s.id) && !existingIds.has(s.id),
      );
      const toRemove = (existingSubs ?? [])
        .filter((s) => !enabledSubIds.has(s.id))
        .map((s) => s.id);
      if (toAdd.length > 0 || toRemove.length > 0 || customSubs.length > 0) {
        onSubsChange(toAdd, toRemove, customSubs);
      }
    }
    onClose();
  };

  // merged list: taxonomy subs (known) + existing custom subs (not in taxonomy)
  const taxIds = new Set((taxonomySubs ?? []).map((s) => s.id));
  const existingCustomSubs = (existingSubs ?? []).filter((s) => !taxIds.has(s.id));

  const hasSubsSection = !parentId && (taxonomySubs && taxonomySubs.length > 0 || existingCustomSubs.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white dark:bg-neutral-900 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#EDE0CC]" />
        </div>

        <div className="px-5 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#3D2C1F]">
              {initial?.id ? 'Редактировать' : 'Новая категория'}
            </h2>
            <button onClick={onClose} className="text-[#8E7A66] hover:text-[#3D2C1F] text-xl leading-none">✕</button>
          </div>

          {/* Live Preview */}
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: `${color}15` }}>
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}25` }}
            >
              <StickerIcon icon={icon} color={color} className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-[#3D2C1F] text-sm">{name || 'Название категории'}</p>
              <p className="text-xs text-[#8E7A66]">{type === 'expense' ? 'Расходы' : 'Доходы'}</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название категории"
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

          {/* Budget (only for parent expense categories) */}
          {!parentId && type === 'expense' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">
                Бюджет в месяц <span className="normal-case font-normal">(необязательно)</span>
              </label>
              <BudgetField value={budgetVal} onChange={(v) => { setBudgetVal(v); onBudgetChange?.(v); }} />
            </div>
          )}

          {/* Subcategories */}
          {hasSubsSection && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">
                Подкатегории
              </label>

              <div className="flex flex-wrap gap-2">
                {/* Taxonomy subs */}
                {(taxonomySubs ?? []).map((sub) => {
                  const active = enabledSubIds.has(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSub(sub.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                      style={
                        active
                          ? { backgroundColor: color, color: '#fff' }
                          : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                      }
                    >
                      {active ? '✓ ' : ''}{getTaxSubName(sub, lang)}
                    </button>
                  );
                })}

                {/* Existing custom subs (not from taxonomy) */}
                {existingCustomSubs.map((sub) => {
                  const active = enabledSubIds.has(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSub(sub.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                      style={
                        active
                          ? { backgroundColor: color, color: '#fff' }
                          : { backgroundColor: '#F4ECDE', color: '#8E7A66' }
                      }
                    >
                      {active ? '✓ ' : ''}{sub.name}
                    </button>
                  );
                })}

                {/* Newly added custom subs (not yet saved) */}
                {customSubs.map((n, i) => (
                  <span
                    key={`custom-${i}`}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: color }}
                  >
                    ✓ {n}
                  </span>
                ))}

                {/* Add custom */}
                <button
                  type="button"
                  onClick={() => setShowAddSub((v) => !v)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#E07A5F] border border-dashed border-[#E07A5F]/50"
                >
                  + Своя
                </button>
              </div>

              {showAddSub && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSubName}
                    onChange={(e) => setCustomSubName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomSub()}
                    placeholder="Название подкатегории"
                    className="flex-1 rounded-xl border border-[#EDE0CC] px-3 py-2 text-sm text-[#3D2C1F] outline-none focus:border-[#E07A5F]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addCustomSub}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                    style={{ backgroundColor: CC.primary }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Privacy */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[#3D2C1F]">Приватная</p>
              <p className="text-xs text-[#8E7A66]">Скрыть от семьи</p>
            </div>
            <div
              onClick={() => setIsPrivate((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? 'bg-[#E07A5F]' : 'bg-[#EDE0CC]'}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
          </label>

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
                Удалить категорию
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
