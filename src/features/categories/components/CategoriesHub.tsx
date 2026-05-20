'use client';
import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  addCategory, updateCategory, removeCategory, archiveCategory,
  addFolder, updateFolder as updateFolderAction, removeFolder,
} from '@/features/categories/store/categoriesSlice';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import {
  addCategory as addCategoryToDb,
  addCategoryWithId,
  updateCategory as updateCategoryInDb,
  deleteCategory as deleteCategoryFromDb,
  archiveCategoryInFirestore,
} from '@/features/categories/services/categoriesService';
import {
  addFolder as addFolderToDb,
  updateFolder as updateFolderInDb,
  deleteFolder as deleteFolderFromDb,
} from '@/features/categories/services/categoryFoldersService';
import { saveBudget } from '@/features/budget/services/budgetService';
import type { Category, CategoryFolder, CategoryType } from '@/shared/types';
import { CategoryRow } from './CategoryRow';
import { FolderSection } from './FolderSection';
import { CategoryEditorSheet } from './CategoryEditorSheet';
import { FolderEditorSheet } from './FolderEditorSheet';
import { ConstructorWizard } from './constructor/ConstructorWizard';
import { StickerIcon } from './CategoryIcon';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';
import {
  selectActiveParents,
  selectAvailableLibrary,
  selectFolders,
  selectCategoriesInFolder,
} from '../store/selectors';

interface TaxSub { id: string; name: string; ru?: string; icon: string }

interface EditorState {
  open: boolean;
  category?: Category;
  parentId?: string;
  folderId?: string;
  existingSubs?: Category[];
  taxonomySubs?: TaxSub[];
}

interface FolderEditorState {
  open: boolean;
  folder?: CategoryFolder;
}

export function CategoriesHub() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<CategoryType>('expense');
  const [showWizard, setShowWizard] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [folderEditor, setFolderEditor] = useState<FolderEditorState>({ open: false });

  const folders = useAppSelector((s) => selectFolders(s, tab));
  const activeParents = useAppSelector((s) => selectActiveParents(s, tab));
  const libraryItems = useAppSelector((s) => selectAvailableLibrary(s, tab));
  const allCategories = useAppSelector((s) =>
    tab === 'expense' ? s.categories.expense : s.categories.income,
  );
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const categoriesInFolderMap = useAppSelector((s) =>
    Object.fromEntries(
      folders.map((f) => [f.id, selectCategoriesInFolder(s, f.id, tab)])
    )
  );

  const hasFolders = folders.length > 0;
  const existingCategoryIds = new Set(allCategories.map((c) => c.id));

  // For summary bar — count active items depending on model
  const activeCount = hasFolders
    ? folders.length
    : activeParents.length;
  const totalBudget = hasFolders
    ? Object.values(categoriesInFolderMap).flat().reduce((s, c) => s + (budgetLimits[c.id] ?? 0), 0)
    : activeParents.reduce((s, p) => s + (budgetLimits[p.id] ?? 0), 0);

  if (!user) return null;

  // ── Category editor ────────────────────────────────────────────────────────

  const openEditor = (cat: Category) => {
    // Legacy model: find sub-categories by parentId. In folder model, subs are found via folderId.
    const subs = allCategories.filter((c) => c.parentId === cat.id);
    const taxEntry = TAXONOMY.find((p) => p.id === cat.id)
      ?? (INCOME_TAXONOMY.id === cat.id ? INCOME_TAXONOMY : null);
    setEditor({
      open: true,
      category: cat,
      existingSubs: subs,
      taxonomySubs: taxEntry ? (taxEntry.subs as TaxSub[]) : undefined,
    });
  };

  const openNewCategoryInFolder = (folderId: string) => {
    setEditor({ open: true, folderId });
  };

  const handleSave = async (catData: Omit<Category, 'id' | 'userId'> & { id?: string }) => {
    if (!user) return;
    const { id, ...data } = catData;
    if (id) {
      const updated: Category = { ...data, id, userId: user.id };
      await updateCategoryInDb(user.id, updated);
      dispatch(updateCategory(updated));
    } else {
      const created = await addCategoryToDb(user.id, data);
      dispatch(addCategory(created));
    }
  };

  const handleSubsChange = async (
    toAdd: TaxSub[],
    toRemove: string[],
    customNames: string[],
  ) => {
    if (!user || !editor.category) return;
    const parentCat = editor.category;
    // TODO: Legacy migration path — new sub-categories still use parentId for backwards compat.
    // When fully migrated to folder model, replace parentId with folderId here.
    for (const sub of toAdd) {
      const created = await addCategoryWithId(user.id, sub.id, {
        name: sub.name,
        icon: sub.icon,
        color: parentCat.color,
        type: parentCat.type,
        parentId: parentCat.id, // @legacy: parentId used during migration period
        order: 0,
        isPrivate: false,
      });
      dispatch(addCategory(created));
    }
    for (const n of customNames) {
      const created = await addCategoryToDb(user.id, {
        name: n,
        icon: parentCat.icon,
        color: parentCat.color,
        type: parentCat.type,
        parentId: parentCat.id, // @legacy: parentId used during migration period
        order: 0,
        isPrivate: false,
      });
      dispatch(addCategory(created));
    }
    // Archive (soft-delete) instead of hard-delete — categories may have historical expenses
    for (const id of toRemove) {
      await archiveCategoryInFirestore(user.id, id, parentCat.type);
      dispatch(archiveCategory({ id, type: parentCat.type }));
    }
  };

  const handleDelete = async () => {
    if (!editor.category || !user) return;
    if (!confirm('Удалить эту категорию?')) return;
    // Archive (soft-delete) — never hard-delete categories that may have expenses
    const subs = allCategories.filter((c) => c.parentId === editor.category!.id);
    for (const sub of subs) {
      await archiveCategoryInFirestore(user.id, sub.id, sub.type);
      dispatch(archiveCategory({ id: sub.id, type: sub.type }));
    }
    await archiveCategoryInFirestore(user.id, editor.category.id, editor.category.type);
    dispatch(archiveCategory({ id: editor.category.id, type: editor.category.type }));
    setEditor({ open: false });
  };

  // ── Folder editor ──────────────────────────────────────────────────────────

  const handleFolderSave = async (data: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string }) => {
    if (!user) return;
    const { id, ...rest } = data;
    if (id) {
      const updated: CategoryFolder = { ...rest, id, userId: user.id };
      await updateFolderInDb(user.id, updated);
      dispatch(updateFolderAction(updated));
    } else {
      const created = await addFolderToDb(user.id, rest);
      dispatch(addFolder(created));
    }
  };

  const handleFolderDelete = async () => {
    if (!folderEditor.folder || !user) return;
    if (!confirm('Удалить папку? Категории останутся, но потеряют группу.')) return;
    // Unlink all categories in this folder
    const catsInFolder = categoriesInFolderMap[folderEditor.folder.id] ?? [];
    for (const cat of catsInFolder) {
      const updated: Category = { ...cat, folderId: null };
      await updateCategoryInDb(user.id, updated);
      dispatch(updateCategory(updated));
    }
    await deleteFolderFromDb(user.id, folderEditor.folder.id, folderEditor.folder.type);
    dispatch(removeFolder({ id: folderEditor.folder.id, type: folderEditor.folder.type }));
    setFolderEditor({ open: false });
  };

  // ── Library activation ─────────────────────────────────────────────────────

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
    const taxEntry = TAXONOMY.find((p) => p.id === libraryParent.id);
    if (taxEntry) {
      for (const sub of taxEntry.subs) {
        const s = await addCategoryWithId(user.id, sub.id, {
          name: sub.name,
          icon: sub.icon,
          color: libraryParent.color,
          type: tab,
          parentId: created.id,
          order: 0,
          isPrivate: false,
        });
        dispatch(addCategory(s));
      }
    }
  };

  const isEmpty = hasFolders ? folders.length === 0 : activeParents.length === 0;

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-lg mx-auto">
      {/* Tab bar */}
      <div className="flex rounded-2xl bg-[#F4ECDE] p-1">
        {(['expense', 'income'] as CategoryType[]).map((tp) => (
          <button
            key={tp}
            onClick={() => setTab(tp)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === tp ? 'bg-white text-[#3D2C1F] shadow-sm' : 'text-[#8E7A66]'
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
      {activeCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[#8E7A66]">
            {hasFolders ? `${activeCount} папок` : `${activeCount} активных`}
            {totalBudget > 0 ? ` · ₪${totalBudget.toLocaleString()}/мес` : ''}
          </span>
          <div className="flex gap-3">
            {hasFolders && (
              <button
                onClick={() => setFolderEditor({ open: true })}
                className="text-xs font-semibold text-[#8E7A66]"
              >
                + Папка
              </button>
            )}
            <button
              onClick={() => setEditor({ open: true })}
              className="text-xs font-semibold text-[#E07A5F]"
            >
              + Добавить
            </button>
          </div>
        </div>
      )}

      {/* Categories / Folders list */}
      <div className="space-y-2">
        {isEmpty ? (
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
        ) : hasFolders ? (
          // ── New model: folder-based view ──────────────────────────────────
          folders.map((folder) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              categories={categoriesInFolderMap[folder.id] ?? []}
              budgetLimits={budgetLimits}
              onEditFolder={() => setFolderEditor({ open: true, folder })}
              onEditCategory={openEditor}
              onAddCategory={() => openNewCategoryInFolder(folder.id)}
            />
          ))
        ) : (
          // ── Legacy model: parentId-based view ─────────────────────────────
          // Used when no folders exist. parentId filter is correct for this migration-adapter path.
          activeParents.map((cat) => {
            const subs = allCategories.filter((c) => c.parentId === cat.id);
            const budget = budgetLimits[cat.id] ?? 0;
            return (
              <CategoryRow
                key={cat.id}
                category={cat}
                subs={subs}
                budget={budget}
                onEdit={() => openEditor(cat)}
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
      <div className="flex gap-2">
        {hasFolders && (
          <button
            onClick={() => setFolderEditor({ open: true })}
            className="flex-1 rounded-2xl border-2 border-dashed border-[#EDE0CC] py-3 text-sm font-semibold text-[#8E7A66] hover:border-[#8E7A66]/40 transition-colors"
          >
            + Папка
          </button>
        )}
        <button
          onClick={() => setEditor({ open: true })}
          className="flex-1 rounded-2xl border-2 border-dashed border-[#EDE0CC] py-3 text-sm font-semibold text-[#8E7A66] hover:border-[#E07A5F]/40 hover:text-[#E07A5F] transition-colors"
        >
          + Создать категорию
        </button>
      </div>

      {/* Category Editor Sheet */}
      <CategoryEditorSheet
        open={editor.open}
        onClose={() => setEditor({ open: false })}
        initial={editor.category}
        type={tab}
        parentId={editor.parentId}
        folderId={editor.folderId}
        availableFolders={folders}
        existingSubs={editor.existingSubs}
        taxonomySubs={editor.taxonomySubs}
        budget={editor.category ? (budgetLimits[editor.category.id] ?? 0) || undefined : undefined}
        onBudgetChange={async (v) => {
          if (!editor.category || !user) return;
          const limit = v ?? 0;
          await saveBudget(user.id, editor.category.id, limit);
          dispatch(setBudgetLimit({ categoryId: editor.category.id, limit }));
        }}
        onSave={handleSave}
        onSubsChange={handleSubsChange}
        onDelete={editor.category ? handleDelete : undefined}
      />

      {/* Folder Editor Sheet */}
      <FolderEditorSheet
        open={folderEditor.open}
        onClose={() => setFolderEditor({ open: false })}
        initial={folderEditor.folder}
        type={tab}
        onSave={handleFolderSave}
        onDelete={folderEditor.folder ? handleFolderDelete : undefined}
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
