'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Category, CategoryFolder } from '@/shared/types';
import { StickerIcon } from './CategoryIcon';
import { getPresetDisplayName } from '../config/categoryLabels';
import { useAppSelector } from '@/store/store';

interface Props {
  folder: CategoryFolder;
  categories: Category[];
  budgetLimits: Record<string, number>;
  onEditFolder: () => void;
  onEditCategory: (cat: Category) => void;
  onAddCategory: () => void;
}

export function FolderSection({ folder, categories, budgetLimits, onEditFolder, onEditCategory, onAddCategory }: Props) {
  const [expanded, setExpanded] = useState(true);
  const lang = useAppSelector((s) => s.ui.language) ?? 'ru';
  const color = folder.color ?? '#E07A5F';

  return (
    <div className="rounded-2xl border border-[#EDE0CC] bg-white overflow-hidden">
      {/* Folder header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FBF7F2] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <StickerIcon icon={folder.icon ?? 'box'} color={color} className="h-6 w-6" />
        </div>
        <span className="flex-1 text-sm font-bold text-[#3D2C1F]">
          {getPresetDisplayName(folder.id, lang) ?? folder.name}
        </span>
        <span className="text-[10px] text-[#B6A48E]">{categories.length}</span>
        {expanded
          ? <ChevronDown size={14} className="text-[#B6A48E]" />
          : <ChevronRight size={14} className="text-[#B6A48E]" />
        }
        <button
          onClick={(e) => { e.stopPropagation(); onEditFolder(); }}
          className="ml-1 text-xs text-[#B6A48E] hover:text-[#8E7A66] transition-colors px-1"
        >
          ✏️
        </button>
      </div>

      {/* Categories inside folder */}
      {expanded && (
        <div className="border-t border-[#F4ECDE]">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#FBF7F2] transition-colors border-b border-[#F4ECDE] last:border-b-0"
              onClick={() => onEditCategory(cat)}
            >
              <div
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <StickerIcon icon={cat.icon} color={cat.color} className="h-5 w-5" />
              </div>
              <span className="flex-1 text-sm font-medium text-[#3D2C1F]">
                {getPresetDisplayName(cat.id, lang) ?? cat.name}
              </span>
              {(budgetLimits[cat.id] ?? 0) > 0 && (
                <span className="text-[10px] text-[#8E7A66]">
                  ₪{budgetLimits[cat.id].toLocaleString()}/мес
                </span>
              )}
              <span className="text-[#B6A48E] text-sm">›</span>
            </div>
          ))}

          <button
            onClick={onAddCategory}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[#E07A5F] text-xs font-semibold hover:bg-[#FAEAE2] transition-colors"
          >
            + Добавить категорию
          </button>
        </div>
      )}
    </div>
  );
}
