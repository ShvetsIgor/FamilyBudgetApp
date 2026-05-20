'use client';
import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { addCategory, updateCategory, removeCategory } from '@/features/categories/store/categoriesSlice';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import {
  addCategory as addCategoryToDb,
  updateCategory as updateCategoryInDb,
  deleteCategory as deleteCategoryFromDb,
} from '@/features/categories/services/categoriesService';
import { saveBudget } from '@/features/budget/services/budgetService';
import type { Category, CategoryType } from '@/shared/types';
import { CategoryRow } from './CategoryRow';
import { CategoryEditorSheet } from './CategoryEditorSheet';
import { ConstructorWizard } from './constructor/ConstructorWizard';
import { StickerIcon } from './CategoryIcon';
import { selectActiveParents, selectSubsOf, selectBudgetFor, selectAvailableLibrary } from '../store/selectors';

interface EditorState {
  open: boolean;
  category?: Category;
  parentId?: string;
}

export function CategoriesHub() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<CategoryType>('expense');
  const [showWizard, setShowWizard] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });

  const activeParents = useAppSelector((s) => selectActiveParents(s, tab));
  const libraryItems = useAppSelector((s) => selectAvailableLibrary(s, tab));
  const allCategories = useAppSelector((s) =>
    tab === 'expense' ? s.categories.expense : s.categories.income,
  );
  const budgetLimits = useAppSelector((s) => s.budget.limits);

  const existingCategoryIds = new Set(allCategories.map((c) => c.id));

  const totalBudget = activeParents.reduce(
    (sum, p) => sum + (budgetLimits[p.id] ?? 0),
    0,
  );

  if (!user) return null;

  const handleSave = async (cat: Omit<Category, 'id' | 'userId'> & { id?: string }) => {
    if (!user) return;
    const { id, ...data } = cat;

    if (id) {
      // Update existing
      const updated: Category = { ...data, id, userId: user.id };
      await updateCategoryInDb(user.id, updated);
      dispatch(updateCategory(updated));
    } else {
      // Add new
      const created = await addCategoryToDb(user.id, data);
      dispatch(addCategory(created));
    }
    setEditor({ open: false });
  };

  const handleDelete = async () => {
    if (!editor.category || !user) return;
    if (!confirm('Удалить эту категорию?')) return;
    await deleteCategoryFromDb(user.id, editor.category.id, editor.category.type);
    dispatch(removeCategory({ id: editor.category.id, type: editor.category.type }));
    setEditor({ open: false });
  };

  const handleActivateFromLibrary = async (libraryParent: ReturnType<typeof selectAvailableLibrary>[number]) => {
    if (!user) return;
    const created = await addCategoryToDb(user.id, {
      name: libraryParent.name,
      icon: libraryParent.icon,
      color: libraryParent.color,
      type: tab,
      order: activeParents.length,
      isPrivate: false,
    });
    dispatch(addCategory(created));
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-lg mx-auto">
      {/* Tab bar */}
      <div className="flex rounded-2xl bg-[#F4ECDE] p-1">
        {(['expense', 'income'] as CategoryType[]).map((tp) => (
          <button
            key={tp}
            onClick={() => setTab(tp)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === tp
                ? 'bg-white text-[#3D2C1F] shadow-sm'
                : 'text-[#8E7A66]'
            }`}
          >
            {tp === 'expense' ? 'Расходы' : 'Доходы'}
          </button>
        ))}
      </div>

      {/* Constructor CTA — only for expenses */}
      {tab === 'expense' && (
        <button
          onClick={() => setShowWizard(true)}
          className="w-full rounded-2xl p-5 text-left bg-gradient-to-br from-[#E07A5F] to-[#C9684E] text-white relative overflow-hidden"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
            <StickerIcon icon="chart_up" color="white" className="h-16 w-16" />
          </div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">Конструктор</p>
            <p className="text-base font-bold">Настройте категории по шагам</p>
            <p className="text-xs opacity-75 mt-1">Выберите из 19 групп, уточните подкатегории, установите бюджеты</p>
          </div>
        </button>
      )}

      {/* Summary */}
      {activeParents.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[#8E7A66]">
            {activeParents.length} активных
            {totalBudget > 0 ? ` · ₪${totalBudget.toLocaleString()}/мес` : ''}
          </span>
          <button
            onClick={() =>
              setEditor({
                open: true,
                parentId: undefined,
                category: undefined,
              })
            }
            className="text-xs font-semibold text-[#E07A5F]"
          >
            + Добавить
          </button>
        </div>
      )}

      {/* Active categories */}
      <div className="space-y-2">
        {activeParents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#EDE0CC] py-10 text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[#F4ECDE] flex items-center justify-center">
              <StickerIcon icon="box" color="#8E7A66" className="h-9 w-9" />
            </div>
            <p className="text-sm font-semibold text-[#3D2C1F]">Нет активных категорий</p>
            <p className="text-xs text-[#8E7A66]">Запустите конструктор или добавьте вручную</p>
            {tab === 'expense' && (
              <button
                onClick={() => setShowWizard(true)}
                className="rounded-2xl bg-[#E07A5F] px-5 py-2.5 text-sm font-bold text-white"
              >
                Запустить конструктор
              </button>
            )}
          </div>
        ) : (
          activeParents.map((cat) => {
            const subs = allCategories.filter((c) => c.parentId === cat.id);
            const budget = budgetLimits[cat.id] ?? 0;
            return (
              <CategoryRow
                key={cat.id}
                category={cat}
                subs={subs}
                budget={budget}
                onEdit={() => setEditor({ open: true, category: cat })}
              />
            );
          })
        )}
      </div>

      {/* Library section */}
      {libraryItems.length > 0 && tab === 'expense' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowLibrary((v) => !v)}
            className="flex items-center justify-between w-full px-1"
          >
            <span className="text-xs font-semibold text-[#8E7A66] uppercase tracking-wide">
              В библиотеке ({libraryItems.length})
            </span>
            <span className="text-xs text-[#B6A48E]">{showLibrary ? 'Скрыть' : 'Показать'}</span>
          </button>

          {showLibrary && (
            <div className="space-y-2">
              {libraryItems.map((libCat) => {
                const asCat: Category = {
                  id: libCat.id,
                  userId: user.id,
                  name: libCat.name,
                  icon: libCat.icon,
                  color: libCat.color,
                  type: tab,
                  order: 0,
                  isPrivate: false,
                };
                return (
                  <CategoryRow
                    key={libCat.id}
                    category={asCat}
                    subs={[]}
                    fromLibrary
                    onEdit={() => {}}
                    onActivate={() => handleActivateFromLibrary(libCat)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create manually */}
      <button
        onClick={() => setEditor({ open: true })}
        className="w-full rounded-2xl border-2 border-dashed border-[#EDE0CC] py-3 text-sm font-semibold text-[#8E7A66] hover:border-[#E07A5F]/40 hover:text-[#E07A5F] transition-colors"
      >
        + Создать категорию вручную
      </button>

      {/* Editor Sheet */}
      <CategoryEditorSheet
        open={editor.open}
        onClose={() => setEditor({ open: false })}
        initial={editor.category}
        type={tab}
        parentId={editor.parentId}
        budget={editor.category ? (budgetLimits[editor.category.id] ?? 0) || undefined : undefined}
        onBudgetChange={async (v) => {
          if (!editor.category || !user) return;
          const limit = v ?? 0;
          await saveBudget(user.id, editor.category.id, limit);
          dispatch(setBudgetLimit({ categoryId: editor.category.id, limit }));
        }}
        onSave={handleSave}
        onDelete={editor.category ? handleDelete : undefined}
      />

      {/* Constructor Wizard */}
      <ConstructorWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        existingCategoryIds={existingCategoryIds}
      />
    </div>
  );
}
