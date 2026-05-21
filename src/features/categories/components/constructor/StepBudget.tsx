'use client';
import type { WizardFolder } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';
import { BudgetField } from '../BudgetField';

interface Props {
  folders: WizardFolder[];
  onSetBudget: (folderId: string, v: number | null) => void;
  currency: string;
  locale?: string;
}

export function StepBudget({ folders, onSetBudget, currency, locale = 'ru' }: Props) {
  const total = folders.reduce((sum, f) => sum + (f.budget ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#3D2C1F] mb-1">Сколько в месяц?</h2>
        <p className="text-sm text-[#8E7A66]">Можно оставить пустым и установить позже.</p>
      </div>

      {/* Hero total card */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-[#E07A5F] to-[#C9684E] text-white">
        <p className="text-sm font-medium opacity-80">Общий бюджет</p>
        <p className="text-3xl font-bold mt-1">
          {currency}{total > 0 ? total.toLocaleString() : '—'}
        </p>
        {total > 0 && (
          <p className="text-xs opacity-70 mt-1">в месяц по всем группам</p>
        )}
      </div>

      {/* Per-folder inputs */}
      <div className="space-y-4">
        {folders.map((folder) => {
          const displayName = locale === 'ru' && folder.ru ? folder.ru : folder.name;
          return (
            <div key={folder.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${folder.color}20` }}
                >
                  <StickerIcon icon={folder.icon} color={folder.color} className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-[#3D2C1F]">{displayName}</span>
              </div>
              <BudgetField
                value={folder.budget}
                onChange={(v) => onSetBudget(folder.id, v)}
                currency={currency}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
