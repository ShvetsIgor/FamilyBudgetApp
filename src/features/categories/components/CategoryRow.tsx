'use client';
import { useAppSelector } from '@/store/store';
import type { Category } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { getTaxonomyName } from '../utils/categoryAliasMap';

interface Props {
  category: Category;
  budget?: number;
  onEdit: () => void;
  fromLibrary?: boolean;
  onActivate?: () => void;
}

export function CategoryRow({ category, budget, onEdit, fromLibrary, onActivate }: Props) {
  const lang = useAppSelector((s) => s.ui.language) ?? 'ru';

  const displayName = getTaxonomyName(category.id, lang) ?? category.name;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-[#EDE0CC] bg-white px-4 py-3 cursor-pointer hover:border-[#E07A5F]/40 transition-colors"
      onClick={fromLibrary ? onActivate : onEdit}
    >
      {/* Icon tile */}
      <div
        className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${category.color}20` }}
      >
        <StickerIcon icon={category.icon} color={category.color} className="h-7 w-7" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#3D2C1F] truncate">{displayName}</span>
          {fromLibrary && (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#8E7A66] bg-[#F4ECDE]">
              в библиотеке
            </span>
          )}
        </div>

        {/* Budget */}
        {budget && budget > 0 ? (
          <p className="text-[10px] text-[#8E7A66] mt-1">
            ₪{budget.toLocaleString()}/мес
          </p>
        ) : null}
      </div>

      {/* Action */}
      {fromLibrary ? (
        <button
          onClick={(e) => { e.stopPropagation(); onActivate?.(); }}
          className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#E07A5F] border border-[#E07A5F]/30 hover:bg-[#FAEAE2] transition-colors"
        >
          + Добавить
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="shrink-0 text-[#B6A48E] hover:text-[#8E7A66] text-sm transition-colors"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
