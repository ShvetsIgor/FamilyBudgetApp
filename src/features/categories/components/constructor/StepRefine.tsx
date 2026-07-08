'use client';
import { useT } from '@/shared/hooks/useT';
import { useState } from 'react';
import type { WizardFolder, WizardCategory } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';

interface Props {
  folders: WizardFolder[];
  categories: WizardCategory[];
  onToggleCategory: (id: string) => void;
  onAddCustomCategory: (folderId: string, cat: Omit<WizardCategory, 'enabled' | 'folderId'>) => void;
  locale?: string;
}

export function StepRefine({ folders, categories, onToggleCategory, onAddCustomCategory, locale = 'ru' }: Props) {
  const t = useT();
  const [customInput, setCustomInput] = useState<Record<string, string>>({});

  const handleAddCustom = (folderId: string) => {
    const val = customInput[folderId]?.trim();
    if (!val) return;
    onAddCustomCategory(folderId, {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: val,
      icon: 'box',
      isCustom: true,
    });
    setCustomInput((prev) => ({ ...prev, [folderId]: '' }));
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#3D2C1F] mb-1">{t('categories.constructor.refineTitle')}</h2>
        <p className="text-sm text-[#8E7A66]">{t('categories.constructor.refineSubtitle')}</p>
      </div>

      {folders.map((folder) => {
        const folderCats = categories.filter((c) => c.folderId === folder.id);
        const enabledCount = folderCats.filter((c) => c.enabled).length;
        const displayName = locale === 'ru' && folder.ru ? folder.ru : folder.name;

        return (
          <div key={folder.id} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${folder.color}20` }}
              >
                <StickerIcon icon={folder.icon} color={folder.color} className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[#3D2C1F] text-sm">{displayName}</span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: folder.color }}
              >
                {enabledCount}/{folderCats.length}
              </span>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {folderCats.map((cat) => {
                const catName = locale === 'ru' && cat.ru ? cat.ru : cat.name;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onToggleCategory(cat.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      cat.enabled
                        ? 'text-white border-transparent'
                        : 'bg-white text-[#8E7A66] border-[#EDE0CC] hover:border-[#E07A5F]/40'
                    }`}
                    style={cat.enabled ? { backgroundColor: folder.color, borderColor: folder.color } : {}}
                  >
                    {cat.enabled && <span className="text-white text-[10px]">✓</span>}
                    <StickerIcon
                      icon={cat.icon}
                      color={cat.enabled ? 'white' : '#8E7A66'}
                      className="h-3.5 w-3.5"
                    />
                    {catName}
                  </button>
                );
              })}

              {/* Custom category input */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder={t('categories.constructor.customPlaceholder')}
                  value={customInput[folder.id] ?? ''}
                  onChange={(e) => setCustomInput((prev) => ({ ...prev, [folder.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustom(folder.id)}
                  className="rounded-full border border-dashed border-[#EDE0CC] px-3 py-1.5 text-xs text-[#8E7A66] w-24 outline-none focus:border-[#E07A5F] focus:text-[#3D2C1F] bg-white"
                />
                {customInput[folder.id]?.trim() && (
                  <button
                    onClick={() => handleAddCustom(folder.id)}
                    className="h-6 w-6 rounded-full bg-[#E07A5F] text-white text-xs flex items-center justify-center shrink-0"
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
