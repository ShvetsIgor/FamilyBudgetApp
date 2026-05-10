'use client';

import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { addCategory, updateCategory, removeCategory, setCategories } from '@/features/categories/store/categoriesSlice';
import {
  addCategory as addCategoryToDb,
  updateCategory as updateCategoryInDb,
  deleteCategory as deleteCategoryFromDb,
  resetCategoriesToDefaults,
  fetchCategories,
} from '@/features/categories/services/categoriesService';
import { CategoryTree } from '@/features/categories/components/CategoryTree';
import { CategoryForm } from '@/features/categories/components/CategoryForm';
import type { Category, CategoryType } from '@/shared/types';

type Sheet = { mode: 'add'; parentId?: string } | { mode: 'edit'; category: Category } | null;

export default function CategoriesPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { expense, income } = useAppSelector((s) => s.categories);
  const [tab, setTab] = useState<CategoryType>('expense');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [resetting, setResetting] = useState(false);

  if (!user) return null;

  async function handleSave(data: Omit<Category, 'id' | 'userId'>) {
    if (!user) return;
    if (sheet?.mode === 'add') {
      const saved = await addCategoryToDb(user.id, data);
      dispatch(addCategory(saved));
    } else if (sheet?.mode === 'edit') {
      const updated = { ...sheet.category, ...data };
      await updateCategoryInDb(user.id, updated);
      dispatch(updateCategory(updated));
    }
    setSheet(null);
  }

  async function handleReset() {
    if (!user) return;
    if (!confirm('Reset all categories to defaults? Your custom categories will be deleted.')) return;
    setResetting(true);
    try {
      await resetCategoriesToDefaults(user.id);
      const [expenseCats, incomeCats] = await Promise.all([
        fetchCategories(user.id, 'expense'),
        fetchCategories(user.id, 'income'),
      ]);
      dispatch(setCategories({ type: 'expense', categories: expenseCats }));
      dispatch(setCategories({ type: 'income', categories: incomeCats }));
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!user) return;
    if (!confirm(`Delete "${category.name}"?`)) return;
    await deleteCategoryFromDb(user.id, category.id, category.type);
    dispatch(removeCategory({ id: category.id, type: category.type }));
  }

  const categories = tab === 'expense' ? expense : income;

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Categories</h1>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : '↺ Reset'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-muted p-1 mb-4">
        {(['expense', 'income'] as CategoryType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Category tree */}
      {sheet ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">
              {sheet.mode === 'add' ? 'New Category' : `Edit "${sheet.category.name}"`}
            </h2>
          </div>
          <CategoryForm
            type={tab}
            parentId={sheet.mode === 'add' ? sheet.parentId : sheet.category.parentId}
            initial={sheet.mode === 'edit' ? sheet.category : undefined}
            onSave={handleSave}
            onCancel={() => setSheet(null)}
          />
        </div>
      ) : (
        <CategoryTree
          categories={categories}
          onAdd={(parentId) => setSheet({ mode: 'add', parentId })}
          onEdit={(category) => setSheet({ mode: 'edit', category })}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
