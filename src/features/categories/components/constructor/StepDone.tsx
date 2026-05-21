'use client';
import type { WizardFolder, WizardCategory } from '../../hooks/useConstructorState';
import { StickerIcon } from '../CategoryIcon';

interface Props {
  folders: WizardFolder[];
  categories: WizardCategory[];
  onFinish: () => void;
  currency: string;
  locale?: string;
}

export function StepDone({ folders, categories, onFinish, currency, locale = 'ru' }: Props) {
  const enabledFolderIds = new Set(folders.map((f) => f.id));
  const totalCategories = categories.filter(
    (c) => c.enabled && enabledFolderIds.has(c.folderId)
  ).length;
  const totalBudget = folders.reduce((sum, f) => sum + (f.budget ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col">
      {/* Success hero */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="h-20 w-20 rounded-3xl bg-[#FAEAE2] flex items-center justify-center mb-4">
          <StickerIcon icon="piggy" color="#E07A5F" className="h-14 w-14" />
        </div>
        <h2 className="text-2xl font-bold text-[#3D2C1F] mb-1">Всё готово!</h2>
        <p className="text-sm text-[#8E7A66] max-w-xs">
          Можно начинать отслеживать бюджет. Категории всегда можно изменить в настройках.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl bg-[#FAEAE2] p-4 text-center">
          <p className="text-2xl font-bold text-[#E07A5F]">{folders.length}</p>
          <p className="text-[10px] text-[#8E7A66] font-medium mt-1">групп</p>
        </div>
        <div className="rounded-2xl bg-[#F4ECDE] p-4 text-center">
          <p className="text-2xl font-bold text-[#D4A574]">{totalCategories}</p>
          <p className="text-[10px] text-[#8E7A66] font-medium mt-1">категорий</p>
        </div>
        <div className="rounded-2xl bg-[#EBF5EF] p-4 text-center">
          <p className="text-xl font-bold text-[#81B29A]">
            {totalBudget > 0 ? `${currency}${Math.round(totalBudget / 1000)}к` : '—'}
          </p>
          <p className="text-[10px] text-[#8E7A66] font-medium mt-1">в месяц</p>
        </div>
      </div>

      {/* Folder preview */}
      <div className="space-y-2 mb-6 flex-1">
        {folders.map((folder) => {
          const folderCats = categories.filter((c) => c.folderId === folder.id && c.enabled);
          const displayName = locale === 'ru' && folder.ru ? folder.ru : folder.name;
          return (
            <div
              key={folder.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ backgroundColor: `${folder.color}10` }}
            >
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${folder.color}25` }}
              >
                <StickerIcon icon={folder.icon} color={folder.color} className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#3D2C1F] truncate">{displayName}</p>
                <p className="text-[10px] text-[#8E7A66]">{folderCats.length} категорий</p>
              </div>
              {folder.budget ? (
                <span className="shrink-0 text-xs font-semibold text-[#8E7A66]">
                  {currency}{folder.budget.toLocaleString()}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        onClick={onFinish}
        className="w-full rounded-2xl bg-[#E07A5F] py-4 text-base font-bold text-white hover:bg-[#C9684E] transition-colors"
      >
        Начать вести бюджет
      </button>
    </div>
  );
}
