'use client';
import { useT } from '@/shared/hooks/useT';
import { useState } from 'react';
import type { WizardFolder } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';
import { CC } from '../../styles/tokens';

interface Props {
  folders: WizardFolder[];
  onToggle: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onAddCustom: () => void;
  locale?: string;
}

export function StepPick({ folders, onToggle, onToggleExpanded, onAddCustom, locale = 'ru' }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');

  const q = query.toLowerCase().trim();
  const filtered = q
    ? folders.filter((f) => {
        const name = (locale === 'ru' && f.ru ? f.ru : f.name).toLowerCase();
        return name.includes(q);
      })
    : folders;

  const enabledCount = folders.filter((f) => f.enabled).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-lg font-bold text-[#3D2C1F] mb-0.5">{t('categories.constructor.pickTitle')}</h2>
        <p className="text-sm text-[#8E7A66]">{t('categories.constructor.pickSubtitle')}</p>

        {/* Search */}
        <div className="relative mt-3">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E7A66]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('categories.constructor.searchGroups')}
            className="w-full rounded-xl border border-[#EDE0CC] bg-white pl-9 pr-4 py-2 text-sm text-[#3D2C1F] placeholder:text-[#C4AA8E] outline-hidden focus:border-[#E07A5F] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E7A66] hover:text-[#3D2C1F]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Selection count */}
        {enabledCount > 0 && (
          <p className="text-xs text-[#E07A5F] font-medium mt-2">
            {t('categories.constructor.selectedCount', { n: enabledCount })}
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-[#8E7A66]">
            {t('categories.nothingFound')}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((folder) => {
              const displayName = locale === 'ru' && folder.ru ? folder.ru : folder.name;
              return (
                <div key={folder.id} className="flex flex-col gap-1">
                  <button
                    onClick={() => onToggle(folder.id)}
                    className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-all ${
                      folder.enabled
                        ? 'border-transparent shadow-md'
                        : 'border-[#EDE0CC] bg-white hover:border-[#E07A5F]/30'
                    }`}
                    style={folder.enabled ? { backgroundColor: `${folder.color}15`, borderColor: `${folder.color}40` } : {}}
                  >
                    {folder.enabled && (
                      <div
                        className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: folder.color }}
                      >
                        ✓
                      </div>
                    )}
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${folder.color}20` }}
                    >
                      <StickerIcon icon={folder.icon} color={folder.color} className="h-8 w-8" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#3D2C1F] text-center leading-tight">
                      {displayName}
                    </span>
                  </button>
                  <button
                    onClick={() => onToggleExpanded(folder.id)}
                    className="text-[10px] text-[#8E7A66] flex items-center justify-center gap-0.5 hover:text-[#3D2C1F] transition-colors"
                  >
                    {folder.expanded ? '▲' : '▼'}
                  </button>
                </div>
              );
            })}

            {/* Custom folder tile — only when not searching */}
            {!q && (
              <button
                onClick={onAddCustom}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 border-2 border-dashed border-[#EDE0CC] bg-white hover:border-[#E07A5F]/50 hover:bg-[#FAEAE2] transition-all"
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${CC.primaryTint}` }}
                >
                  <span className="text-[#E07A5F] text-2xl font-bold">+</span>
                </div>
                <span className="text-[11px] font-semibold text-[#8E7A66] text-center">{t('categories.constructor.customShort')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
