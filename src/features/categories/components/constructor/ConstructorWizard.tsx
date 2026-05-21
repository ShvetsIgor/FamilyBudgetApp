'use client';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { addCategory } from '@/features/categories/store/categoriesSlice';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import { bulkApplyConstructorDiff } from '@/features/categories/services/categoriesService';
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
import type { WizardParent } from '../../hooks/useConstructorState';

interface Props {
  open: boolean;
  onClose: () => void;
  existingCategoryIds: Set<string>;
}

export function ConstructorWizard({ open, onClose, existingCategoryIds }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency) ?? 'ILS';
  const currencySymbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '₪';

  const {
    step, setStep, state, toggleParent, toggleSub,
    setBudget, addCustomParent, addCustomSub, canNext, enabledParents,
  } = useConstructorState(existingCategoryIds);

  const [saving, setSaving] = useState(false);
  const [showCustomSheet, setShowCustomSheet] = useState(false);

  if (!open) return null;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      // Build list of categories to add (not already existing)
      const toAdd: Array<{
        id: string; name: string; ru?: string; icon: string; color?: string;
        type: CategoryType; order: number; isPrivate: boolean;
      }> = [];

      enabledParents.forEach((parent, pi) => {
        if (!existingCategoryIds.has(parent.id)) {
          toAdd.push({
            id: parent.id,
            name: parent.name,
            ru: parent.ru,
            icon: parent.icon,
            color: parent.color,
            type: 'expense',
            order: pi,
            isPrivate: false,
          });
        }

        parent.subs
          .filter((s) => s.enabled && !existingCategoryIds.has(s.id))
          .forEach((sub, si) => {
            toAdd.push({
              id: sub.id,
              name: sub.name,
              ru: sub.ru,
              icon: sub.icon,
              color: parent.color,
              parentId: parent.id,
              type: 'expense',
              order: si,
              isPrivate: false,
            });
          });
      });

      // Write to Firestore
      if (toAdd.length > 0) {
        await bulkApplyConstructorDiff(user.id, toAdd);
      }

      // Save budgets
      for (const parent of enabledParents) {
        if (parent.budget && parent.budget > 0) {
          await saveBudget(user.id, parent.id, parent.budget);
          dispatch(setBudgetLimit({ categoryId: parent.id, limit: parent.budget }));
        }
      }

      // Dispatch to Redux
      for (const cat of toAdd) {
        dispatch(
          addCategory({
            id: cat.id,
            userId: user.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color ?? '#E07A5F',
            parentId: cat.parentId,
            type: cat.type,
            order: cat.order,
            isPrivate: cat.isPrivate,
          }),
        );
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const nextLabel =
    step === 1 ? 'Бюджет' :
    step === 2 ? 'Готово' :
    step === 0 ? `Далее · ${enabledParents.length}` :
    undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FBF6EE] dark:bg-neutral-900">
      <WizardHeader step={step} onClose={onClose} />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {step === 0 && (
          <StepPick
            state={state}
            onToggle={toggleParent}
            onAddCustom={() => setShowCustomSheet(true)}
          />
        )}
        {step === 1 && (
          <StepRefine
            parents={enabledParents}
            onToggleSub={toggleSub}
            onAddCustomSub={addCustomSub}
          />
        )}
        {step === 2 && (
          <StepBudget
            parents={enabledParents}
            onSetBudget={setBudget}
            currency={currencySymbol}
          />
        )}
        {step === 3 && (
          <StepDone
            parents={enabledParents}
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

      {/* Custom category sheet */}
      <CategoryEditorSheet
        open={showCustomSheet}
        onClose={() => setShowCustomSheet(false)}
        type="expense"
        isWizardMode
        onSave={(cat) => {
          addCustomParent({
            id: `custom_${Date.now()}`,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
          } as Omit<WizardParent, 'enabled' | 'budget' | 'subs'>);
          setShowCustomSheet(false);
        }}
      />
    </div>
  );
}
