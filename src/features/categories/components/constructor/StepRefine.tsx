'use client';
import { useState } from 'react';
import type { WizardParent, WizardSub } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';

interface Props {
  parents: WizardParent[];
  onToggleSub: (pid: string, sid: string) => void;
  onAddCustomSub: (pid: string, sub: Omit<WizardSub, 'enabled'>) => void;
  locale?: string;
}

export function StepRefine({ parents, onToggleSub, onAddCustomSub, locale = 'ru' }: Props) {
  const [customInput, setCustomInput] = useState<Record<string, string>>({});

  const handleAddCustom = (pid: string) => {
    const val = customInput[pid]?.trim();
    if (!val) return;
    onAddCustomSub(pid, {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: val,
      icon: 'box',
      isCustom: true,
    });
    setCustomInput((prev) => ({ ...prev, [pid]: '' }));
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#3D2C1F] mb-1">Уточните каждую категорию</h2>
        <p className="text-sm text-[#8E7A66]">Больше подкатегорий = лучшая статистика.</p>
      </div>

      {parents.map((parent) => {
        const displayName = locale === 'ru' && parent.ru ? parent.ru : parent.name;
        const enabledCount = parent.subs.filter((s) => s.enabled).length;

        return (
          <div key={parent.id} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${parent.color}20` }}
              >
                <StickerIcon icon={parent.icon} color={parent.color} className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[#3D2C1F] text-sm">{displayName}</span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: parent.color }}
              >
                {enabledCount}/{parent.subs.length}
              </span>
            </div>

            {/* Sub chips */}
            <div className="flex flex-wrap gap-2">
              {parent.subs.map((sub) => {
                const subName = locale === 'ru' && sub.ru ? sub.ru : sub.name;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onToggleSub(parent.id, sub.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      sub.enabled
                        ? 'text-white border-transparent'
                        : 'bg-white text-[#8E7A66] border-[#EDE0CC] hover:border-[#E07A5F]/40'
                    }`}
                    style={sub.enabled ? { backgroundColor: parent.color, borderColor: parent.color } : {}}
                  >
                    {sub.enabled && <span className="text-white text-[10px]">✓</span>}
                    <StickerIcon
                      icon={sub.icon}
                      color={sub.enabled ? 'white' : '#8E7A66'}
                      className="h-3.5 w-3.5"
                    />
                    {subName}
                  </button>
                );
              })}

              {/* Custom sub input */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="+ Своя"
                  value={customInput[parent.id] ?? ''}
                  onChange={(e) => setCustomInput((prev) => ({ ...prev, [parent.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustom(parent.id)}
                  className="rounded-full border border-dashed border-[#EDE0CC] px-3 py-1.5 text-xs text-[#8E7A66] w-24 outline-none focus:border-[#E07A5F] focus:text-[#3D2C1F] bg-white"
                />
                {customInput[parent.id]?.trim() && (
                  <button
                    onClick={() => handleAddCustom(parent.id)}
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
