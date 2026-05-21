'use client';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { addCategory, addFolder } from '@/features/categories/store/categoriesSlice';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import { bulkApplyConstructorDiff } from '@/features/categories/services/categoriesService';
import { bulkCreateFolders } from '@/features/categories/services/categoryFoldersService';
import { saveBudget } from '@/features/budget/services/budgetService';
import type { CategoryType } from '@/shared/types';
import { useConstructorState } from '../../hooks/useConstructorState';
import { WizardHeader } from './WizardHeader';
import { WizardFooter } from './WizardFooter';
import { StepPick } from './StepPick';
import { StepRefine } from './StepRefine';
import { StepBudget } from './StepBudget';
import { StepDone } from './StepDone';
import { CategoryEditorSheet } from '../CategoryEditorSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  existingCategoryIds: Set<string>;
  existingFolderIds: Set<string>;
}

export function ConstructorWizard({ open, onClose, existingCategoryIds, existingFolderIds }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency) ?? 'ILS';
  const currencySymbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '₪';

  const {
    step, setStep, folders, categories,
    toggleFolder, toggleCategory, setBudget,
    addCustomFolder, addCustomCategory,
    canNext, enabledFolders,
  } = useConstructorState(existingCategoryIds);

  const [saving, setSaving] = useState(false);
  const [showCustomSheet, setShowCustomSheet] = useState(false);

  if (!open) return null;

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleFinish = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const enabledFolderIds = new Set(enabledFolders.map((f) => f.id));

      // ── Folders to create ─────────────────────────────────────────────────
      const foldersToAdd = enabledFolders
        .filter((f) => !existingFolderIds.has(f.id))
        .map((f, order) => ({
          id: f.id,
          name: f.name,
          icon: f.icon,
          color: f.color,
          type: 'expense' as CategoryType,
          order,
        }));

      if (foldersToAdd.length > 0) {
        const created = await bulkCreateFolders(user.id, foldersToAdd);
        for (const folder of created) {
          dispatch(addFolder(folder));
        }
      }

      // ── Categories to create (flat, with folderId) ────────────────────────
      const catsToAdd = categories
        .filter((c) => c.enabled && enabledFolderIds.has(c.folderId) && !existingCategoryIds.has(c.id))
        .map((c, order) => {
          const folder = enabledFolders.find((f) => f.id === c.folderId)!;
          return {
            id: c.id,
            name: c.name,
            ru: c.ru,
            icon: c.icon,
            color: folder?.color ?? '#E07A5F',
            type: 'expense' as CategoryType,
            order,
            isPrivate: false,
            folderId: c.folderId,
          };
        });

      if (catsToAdd.length > 0) {
        await bulkApplyConstructorDiff(user.id, catsToAdd);
        for (const cat of catsToAdd) {
          dispatch(
            addCategory({
              id: cat.id,
              userId: user.id,
              name: cat.name,
              icon: cat.icon,
              color: cat.color,
              type: cat.type,
              order: cat.order,
              isPrivate: cat.isPrivate,
              folderId: cat.folderId,
            }),
          );
        }
      }

      // ── Budgets ────────────────────────────────────────────────────────────
      for (const folder of enabledFolders) {
        if (folder.budget && folder.budget > 0) {
          await saveBudget(user.id, folder.id, folder.budget);
          dispatch(setBudgetLimit({ categoryId: folder.id, limit: folder.budget }));
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const nextLabel =
    step === 1 ? 'Бюджет' :
    step === 2 ? 'Готово' :
    step === 0 ? `Далее · ${enabledFolders.length}` :
    undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FBF6EE] dark:bg-neutral-900">
      <WizardHeader step={step} onClose={onClose} />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {step === 0 && (
          <StepPick
            folders={folders}
            onToggle={toggleFolder}
            onAddCustom={() => setShowCustomSheet(true)}
          />
        )}
        {step === 1 && (
          <StepRefine
            folders={enabledFolders}
            categories={categories}
            onToggleCategory={toggleCategory}
            onAddCustomCategory={addCustomCategory}
          />
        )}
        {step === 2 && (
          <StepBudget
            folders={enabledFolders}
            onSetBudget={setBudget}
            currency={currencySymbol}
          />
        )}
        {step === 3 && (
          <StepDone
            folders={enabledFolders}
            categories={categories}
            onFinish={handleFinish}
            currency={currencySymbol}
          />
        )}
      </div>

      {step < 3 && (
        <WizardFooter
          step={step}
          canNext={canNext}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={step === 2 ? handleNext : undefined}
          nextLabel={nextLabel}
        />
      )}

      {/* Custom folder sheet */}
      <CategoryEditorSheet
        open={showCustomSheet}
        onClose={() => setShowCustomSheet(false)}
        type="expense"
        isWizardMode
        onSave={(cat) => {
          addCustomFolder({
            id: `custom_${Date.now()}`,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
          });
          setShowCustomSheet(false);
        }}
      />
    </div>
  );
}
