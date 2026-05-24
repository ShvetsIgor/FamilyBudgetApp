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
  const isOverBudget = total > 20_000;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#3D2C1F] mb-1">Сколько в месяц?</h2>
        <p className="text-sm text-[#8E7A66]">Можно оставить пустым и установить позже.</p>
      </div>

      {/* Hero total card */}
      <div className={`rounded-2xl p-5 text-white transition-all ${
        isOverBudget
          ? 'bg-gradient-to-br from-[#C9684E] to-[#A0522D]'
          : 'bg-gradient-to-br from-[#E07A5F] to-[#C9684E]'
      }`}>
        <p className="text-sm font-medium opacity-80">Общий бюджет</p>
        <p className="text-3xl font-bold mt-1">
          {currency}{total > 0 ? total.toLocaleString() : '—'}
        </p>
        {total > 0 && (
          <p className="text-xs opacity-70 mt-1">
            {isOverBudget ? '⚠ Довольно большой бюджет' : 'в месяц по всем группам'}
          </p>
        )}
      </div>

      {/* Per-folder inputs with percentage bars */}
      <div className="space-y-5">
        {folders.map((folder) => {
          const displayName = locale === 'ru' && folder.ru ? folder.ru : folder.name;
          const pct = total > 0 ? Math.round(((folder.budget ?? 0) / total) * 100) : 0;

          return (
            <div key={folder.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${folder.color}20` }}
                >
                  <StickerIcon icon={folder.icon} color={folder.color} className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-[#3D2C1F] flex-1">{displayName}</span>
                {pct > 0 && (
                  <span className="text-xs font-bold text-[#8E7A66] shrink-0">{pct}%</span>
                )}
              </div>

              <BudgetField
                value={folder.budget}
                onChange={(v) => onSetBudget(folder.id, v)}
                currency={currency}
              />

              {/* Percentage bar */}
              {total > 0 && (folder.budget ?? 0) > 0 && (
                <div className="h-1.5 rounded-full bg-[#EDE0CC] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: folder.color,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly warning */}
      {isOverBudget && (
        <div className="rounded-xl bg-[#FDF3EE] border border-[#F0C8B5] px-4 py-3 text-sm text-[#A0522D]">
          Бюджет выглядит большим. Убедитесь, что суммы указаны в месяц, а не в год.
        </div>
      )}
    </div>
  );
}
