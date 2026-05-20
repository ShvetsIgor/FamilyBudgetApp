'use client';
import type { WizardParent } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';
import { CC } from '../../styles/tokens';

interface Props {
  state: WizardParent[];
  onToggle: (id: string) => void;
  onAddCustom: () => void;
  locale?: string;
}

export function StepPick({ state, onToggle, onAddCustom, locale = 'ru' }: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <h2 className="text-lg font-bold text-[#3D2C1F] mb-1">Какие расходы вы отслеживаете?</h2>
      <p className="text-sm text-[#8E7A66] mb-5">Выберите всё подходящее. Всегда можно изменить.</p>

      <div className="grid grid-cols-3 gap-3">
        {state.map((parent) => {
          const displayName = locale === 'ru' && parent.ru ? parent.ru : parent.name;
          return (
            <button
              key={parent.id}
              onClick={() => onToggle(parent.id)}
              className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-all ${
                parent.enabled
                  ? 'border-transparent shadow-md'
                  : 'border-[#EDE0CC] bg-white'
              }`}
              style={parent.enabled ? { backgroundColor: `${parent.color}15`, borderColor: `${parent.color}40` } : {}}
            >
              {parent.enabled && (
                <div
                  className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: parent.color }}
                >
                  ✓
                </div>
              )}
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${parent.color}20` }}
              >
                <StickerIcon icon={parent.icon} color={parent.color} className="h-8 w-8" />
              </div>
              <span className="text-[11px] font-semibold text-[#3D2C1F] text-center leading-tight">
                {displayName}
              </span>
            </button>
          );
        })}

        {/* Custom tile */}
        <button
          onClick={onAddCustom}
          className="flex flex-col items-center gap-2 rounded-2xl p-3 border-2 border-dashed border-[#EDE0CC] bg-white hover:border-[#E07A5F]/50 hover:bg-[#FAEAE2] transition-all"
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${CC.primaryTint}` }}
          >
            <span className="text-[#E07A5F] text-2xl font-bold">+</span>
          </div>
          <span className="text-[11px] font-semibold text-[#8E7A66] text-center">Своя</span>
        </button>
      </div>

    </div>
  );
}
