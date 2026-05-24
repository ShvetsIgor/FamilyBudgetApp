'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  addCategory, updateCategory, archiveCategory,
  addFolder, updateFolder as updateFolderAction, removeFolder,
} from '@/features/categories/store/categoriesSlice';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import {
  addCategory as addCategoryToDb,
  addCategoryWithId,
  updateCategory as updateCategoryInDb,
  archiveCategoryInFirestore,
} from '@/features/categories/services/categoriesService';
import {
  addFolder as addFolderToDb,
  updateFolder as updateFolderInDb,
  deleteFolder as deleteFolderFromDb,
} from '@/features/categories/services/categoryFoldersService';
import { saveBudget } from '@/features/budget/services/budgetService';
import type { Category, CategoryFolder, CategoryType } from '@/shared/types';
import { CategoryEditorSheet } from './CategoryEditorSheet';
import { FolderEditorSheet } from './FolderEditorSheet';
import { ConstructorWizard } from './constructor/ConstructorWizard';
import { StickerIcon } from './CategoryIcon';
import { getPresetCategoriesForFolder } from '../preset/categoryPresets';
import { selectAvailableLibrary } from '../store/librarySelectors';
import {
  selectFolders,
  selectCategoriesInFolder,
  selectUnfolderedCategories,
  selectAllActiveCategories,
  selectRootFolders,
  selectChildFolders,
} from '../store/selectors';
import { filterCategoriesByQuery } from '../utils/tagUtils';
import { CATEGORY_ALIAS_MAP } from '../config/categoryLabels';
import { useT } from '@/shared/hooks/useT';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#FBF6EE',
  bgSoft: '#F4ECDE',
  card: '#FFFFFF',
  fg: '#3D2C1F',
  sub: '#8E7A66',
  subLight: '#B6A48E',
  hairline: '#EDE0CC',
  primary: '#E07A5F',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface EditorState {
  open: boolean;
  category?: Category;
  folderId?: string;
}

interface FolderEditorState {
  open: boolean;
  folder?: CategoryFolder;
}

type ContextMenuTarget =
  | { kind: 'folder'; id: string }
  | { kind: 'category'; id: string };

interface InlineEditState {
  kind: 'folder-rename' | 'cat-rename' | 'cat-new' | 'folder-new';
  id: string; // folder id for cat-new; target id for renames; '' for folder-new
}

// ─── Small chevron icons ──────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L7.5 6l-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 7.5l3.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ─── Inline input row ─────────────────────────────────────────────────────────

interface InlineInputRowProps {
  placeholder: string;
  indent?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function InlineInputRow({ placeholder, indent, onSave, onCancel }: InlineInputRowProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    else onCancel();
  }, [value, onSave, onCancel]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: indent ? 44 : 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        minHeight: 40,
      }}
    >
      {/* placeholder icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: T.bgSoft,
          flexShrink: 0,
        }}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        style={{
          flex: 1,
          fontSize: 13,
          color: T.fg,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          borderBottom: `1px solid ${T.hairline}`,
          padding: '2px 0',
        }}
      />
      <span style={{ fontSize: 11, color: T.subLight, flexShrink: 0 }}>Enter ↵</span>
    </div>
  );
}

// ─── Inline rename span/input ─────────────────────────────────────────────────

interface InlineRenameProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}

function InlineRename({ value: initial, onSave, onCancel, style }: InlineRenameProps) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initial) onSave(trimmed);
    else onCancel();
  }, [value, initial, onSave, onCancel]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={commit}
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        fontWeight: 700,
        color: T.fg,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        borderBottom: `1px solid ${T.primary}`,
        ...style,
      }}
    />
  );
}

// ─── Context menu dropdown ────────────────────────────────────────────────────

interface MenuOption {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  options: MenuOption[];
  onClose: () => void;
}

function ContextMenu({ options, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        right: 0,
        top: '100%',
        zIndex: 100,
        backgroundColor: T.card,
        border: `1px solid ${T.hairline}`,
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        minWidth: 160,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => { opt.onClick(); onClose(); }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: opt.danger ? '#E05050' : T.fg,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderBottom: i < options.length - 1 ? `1px solid ${T.hairline}` : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoriesHub() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<CategoryType>('expense');
  const [showWizard, setShowWizard] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [folderEditor, setFolderEditor] = useState<FolderEditorState>({ open: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  const folders = useAppSelector((s) => selectFolders(s, tab));
  const rootFolders = useAppSelector((s) => selectRootFolders(s, tab));
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
  const childFoldersMap = useAppSelector((s) =>
    Object.fromEntries(
      rootFolders.map((f) => [f.id, selectChildFolders(s, f.id, tab)])
    )
  );
  const ungroupedCats = useAppSelector((s) => selectUnfolderedCategories(s, tab));
  const allActiveCats = useAppSelector((s) => selectAllActiveCategories(s, tab));
  const searchResults = filterCategoriesByQuery(searchQuery, allActiveCats, CATEGORY_ALIAS_MAP);
  const t = useT();

  const existingCategoryIds = new Set(allCategories.map((c) => c.id));
  const existingFolderIds = new Set(folders.map((f) => f.id));

  if (!user) return null;

  const isEmpty = folders.length === 0 && ungroupedCats.length === 0;

  const toggleFolder = (id: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────

  const openEditor = (cat: Category) => {
    setEditor({ open: true, category: cat, folderId: cat.folderId ?? undefined });
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

  const handleDeleteCategory = async (cat: Category) => {
    if (!user) return;
    if (!confirm('Архивировать эту категорию?')) return;
    await archiveCategoryInFirestore(user.id, cat.id, cat.type);
    dispatch(archiveCategory({ id: cat.id, type: cat.type }));
  };

  // ── Inline rename handlers ─────────────────────────────────────────────────

  const handleFolderRename = async (folder: CategoryFolder, newName: string) => {
    if (!user) return;
    const updated: CategoryFolder = { ...folder, name: newName };
    await updateFolderInDb(user.id, updated);
    dispatch(updateFolderAction(updated));
    setInlineEdit(null);
  };

  const handleCategoryRename = async (cat: Category, newName: string) => {
    if (!user) return;
    const updated: Category = { ...cat, name: newName };
    await updateCategoryInDb(user.id, updated);
    dispatch(updateCategory(updated));
    setInlineEdit(null);
  };

  const handleInlineCreateCategory = async (folderId: string, name: string, folder: CategoryFolder) => {
    if (!user) return;
    const catsInFolder = categoriesInFolderMap[folderId] ?? [];
    const created = await addCategoryToDb(user.id, {
      name,
      icon: folder.icon ?? 'box',
      color: folder.color ?? T.primary,
      type: tab,
      folderId,
      order: catsInFolder.length,
      isPrivate: false,
    });
    dispatch(addCategory(created));
    setInlineEdit(null);
  };

  const handleInlineCreateFolder = async (name: string) => {
    if (!user) return;
    const created = await addFolderToDb(user.id, {
      name,
      icon: 'box',
      color: T.primary,
      type: tab,
      order: folders.length,
    });
    dispatch(addFolder(created));
    setInlineEdit(null);
  };

  // ── Folder CRUD ────────────────────────────────────────────────────────────

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

  const handleFolderDelete = async (folder: CategoryFolder) => {
    if (!user) return;
    const catsInFolder = categoriesInFolderMap[folder.id] ?? [];
    for (const cat of catsInFolder) {
      const updated: Category = { ...cat, folderId: null };
      await updateCategoryInDb(user.id, updated);
      dispatch(updateCategory(updated));
    }
    await deleteFolderFromDb(user.id, folder.id, folder.type);
    dispatch(removeFolder({ id: folder.id, type: folder.type }));
    setConfirmDeleteFolderId(null);
  };

  // ── Library activation ─────────────────────────────────────────────────────

  const handleActivateFromLibrary = async (libraryParent: ReturnType<typeof selectAvailableLibrary>[number]) => {
    if (!user) return;
    const folder = await addFolderToDb(user.id, {
      name: libraryParent.name,
      icon: libraryParent.icon,
      color: libraryParent.color,
      type: tab,
      order: folders.length,
    });
    dispatch(addFolder(folder));
    for (const sub of getPresetCategoriesForFolder(libraryParent.id)) {
      const s = await addCategoryWithId(user.id, sub.id, {
        name: sub.name,
        icon: sub.icon,
        color: libraryParent.color,
        type: tab,
        folderId: folder.id,
        order: 0,
        isPrivate: false,
      });
      dispatch(addCategory(s));
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderFolderRow = (folder: CategoryFolder, indent = 0) => {
    const cats = categoriesInFolderMap[folder.id] ?? [];
    const isCollapsed = collapsedFolderIds.has(folder.id);
    const isRenamingThis = inlineEdit?.kind === 'folder-rename' && inlineEdit.id === folder.id;
    const isMenuOpen = contextMenu?.kind === 'folder' && contextMenu.id === folder.id;
    const isConfirmDelete = confirmDeleteFolderId === folder.id;

    return (
      <div key={folder.id} style={{ marginBottom: 2 }}>
        {/* Folder header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 8 + indent * 20,
            paddingRight: 8,
            height: 48,
            cursor: 'pointer',
            borderRadius: 14,
            backgroundColor: isMenuOpen ? T.bgSoft : 'transparent',
            position: 'relative',
          }}
        >
          {/* Chevron — tap to collapse */}
          <button
            onClick={() => toggleFolder(folder.id)}
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.subLight,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
          </button>

          {/* Icon tile */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${folder.color ?? T.primary}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <StickerIcon icon={folder.icon ?? 'box'} color={folder.color ?? T.primary} className="h-5 w-5" />
          </div>

          {/* Folder name (tap to rename inline) */}
          {isRenamingThis ? (
            <InlineRename
              value={folder.name}
              onSave={(v) => handleFolderRename(folder, v)}
              onCancel={() => setInlineEdit(null)}
            />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setInlineEdit({ kind: 'folder-rename', id: folder.id });
              }}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontWeight: 700,
                color: T.fg,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'text',
              }}
            >
              {t.cat(folder.name)}
            </span>
          )}

          {/* Category count badge */}
          <span
            style={{
              fontSize: 10,
              color: T.subLight,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {cats.length}
          </span>

          {/* ··· button */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(isMenuOpen ? null : { kind: 'folder', id: folder.id });
              }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                color: T.subLight,
                background: isMenuOpen ? T.hairline : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <DotsIcon />
            </button>

            {isMenuOpen && (
              <ContextMenu
                options={[
                  {
                    label: 'Изменить',
                    onClick: () => setFolderEditor({ open: true, folder }),
                  },
                  {
                    label: isCollapsed ? 'Развернуть' : 'Свернуть',
                    onClick: () => toggleFolder(folder.id),
                  },
                  {
                    label: 'Удалить папку',
                    danger: true,
                    onClick: () => setConfirmDeleteFolderId(folder.id),
                  },
                ]}
                onClose={() => setContextMenu(null)}
              />
            )}
          </div>
        </div>

        {/* Delete confirm */}
        {isConfirmDelete && (
          <div
            style={{
              marginLeft: 8 + indent * 20,
              marginRight: 8,
              marginBottom: 4,
              padding: '10px 14px',
              borderRadius: 12,
              backgroundColor: '#FFF0F0',
              border: '1px solid #FFD5D5',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ flex: 1, fontSize: 12, color: '#E05050' }}>
              Удалить «{t.cat(folder.name)}»? Категории потеряют группу.
            </span>
            <button
              onClick={() => handleFolderDelete(folder)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                backgroundColor: '#E05050',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Удалить
            </button>
            <button
              onClick={() => setConfirmDeleteFolderId(null)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                backgroundColor: T.bgSoft,
                color: T.sub,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
          </div>
        )}

        {/* Expanded contents */}
        {!isCollapsed && (
          <div style={{ marginBottom: 4 }}>
            {cats.map((cat) => renderCategoryRow(cat))}

            {/* Inline new category input */}
            {inlineEdit?.kind === 'cat-new' && inlineEdit.id === folder.id ? (
              <InlineInputRow
                placeholder="Название категории"
                indent
                onSave={(name) => handleInlineCreateCategory(folder.id, name, folder)}
                onCancel={() => setInlineEdit(null)}
              />
            ) : (
              <button
                onClick={() => setInlineEdit({ kind: 'cat-new', id: folder.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 44,
                  paddingRight: 12,
                  height: 32,
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.primary,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                + Добавить категорию
              </button>
            )}

            {/* Separator */}
            <div style={{ height: 1, backgroundColor: T.hairline, margin: '4px 8px' }} />
          </div>
        )}
      </div>
    );
  };

  const renderCategoryRow = (cat: Category) => {
    const isRenamingThis = inlineEdit?.kind === 'cat-rename' && inlineEdit.id === cat.id;
    const isMenuOpen = contextMenu?.kind === 'category' && contextMenu.id === cat.id;

    return (
      <div
        key={cat.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 44,
          paddingRight: 8,
          height: 40,
          borderRadius: 12,
          backgroundColor: isMenuOpen ? T.bgSoft : 'transparent',
          position: 'relative',
        }}
      >
        {/* Icon tile */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: `${cat.color}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <StickerIcon icon={cat.icon} color={cat.color} className="h-4 w-4" />
        </div>

        {/* Name (tap to rename) */}
        {isRenamingThis ? (
          <InlineRename
            value={cat.name}
            onSave={(v) => handleCategoryRename(cat, v)}
            onCancel={() => setInlineEdit(null)}
            style={{ fontSize: 13, fontWeight: 500 }}
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setInlineEdit({ kind: 'cat-rename', id: cat.id });
            }}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 500,
              color: T.fg,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'text',
            }}
          >
            {t.cat(cat.name)}
          </span>
        )}

        {/* ··· button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(isMenuOpen ? null : { kind: 'category', id: cat.id });
            }}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              color: T.subLight,
              background: isMenuOpen ? T.hairline : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <DotsIcon />
          </button>

          {isMenuOpen && (
            <ContextMenu
              options={[
                {
                  label: 'Изменить',
                  onClick: () => openEditor(cat),
                },
                {
                  label: 'Переместить',
                  onClick: () => openEditor(cat),
                },
                {
                  label: 'Архивировать',
                  danger: true,
                  onClick: () => handleDeleteCategory(cat),
                },
              ]}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        backgroundColor: T.bg,
        minHeight: '100%',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: T.bgSoft,
            borderRadius: 16,
            padding: 4,
            marginBottom: 12,
          }}
        >
          {(['expense', 'income'] as CategoryType[]).map((tp) => (
            <button
              key={tp}
              onClick={() => { setTab(tp); setSearchQuery(''); }}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: '8px 0',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: tab === tp ? T.card : 'transparent',
                color: tab === tp ? T.fg : T.sub,
                boxShadow: tab === tp ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tp === 'expense' ? 'Расходы' : 'Доходы'}
            </button>
          ))}
        </div>

        {/* Header row: search + constructor link */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          {/* Search bar */}
          <div style={{ flex: 1, position: 'relative' }}>
            <svg
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.subLight }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск…"
              style={{
                width: '100%',
                paddingLeft: 30,
                paddingRight: searchQuery ? 28 : 10,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: T.bgSoft,
                border: 'none',
                outline: 'none',
                color: T.fg,
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: T.subLight,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Quick-add actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setFolderEditor({ open: true })}
              style={{
                padding: '8px 10px',
                borderRadius: 12,
                backgroundColor: T.bgSoft,
                color: T.sub,
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${T.hairline}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Папка
            </button>
            <button
              onClick={() => setEditor({ open: true })}
              style={{
                padding: '8px 10px',
                borderRadius: 12,
                backgroundColor: `${T.primary}15`,
                color: T.primary,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Категория
            </button>
          </div>
        </div>

        {/* ── Content area ────────────────────────────────────────────────── */}

        {searchQuery ? (
          /* Search results */
          searchResults.length > 0 ? (
            <div
              style={{
                backgroundColor: T.card,
                borderRadius: 18,
                border: `1px solid ${T.hairline}`,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div style={{ padding: '8px 12px 4px', fontSize: 11, color: T.sub, fontWeight: 600 }}>
                {searchResults.length} результатов
              </div>
              {searchResults.map((cat) => renderCategoryRow(cat))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: T.bgSoft,
                borderRadius: 18,
                padding: '32px 16px',
                textAlign: 'center',
                gap: 6,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: T.fg }}>Ничего не найдено</p>
              <p style={{ fontSize: 12, color: T.sub }}>Попробуйте другой запрос</p>
            </div>
          )
        ) : isEmpty ? (
          /* Empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px dashed ${T.hairline}`,
              borderRadius: 18,
              padding: '40px 16px',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: T.bgSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StickerIcon icon="box" color={T.sub} className="h-8 w-8" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.fg }}>Нет активных категорий</p>
            <p style={{ fontSize: 12, color: T.sub }}>Создайте папку с нуля или запустите конструктор</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={() => setFolderEditor({ open: true })}
                style={{
                  padding: '10px 16px',
                  borderRadius: 14,
                  backgroundColor: T.fg,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Настроить с нуля
              </button>
              {tab === 'expense' && (
                <button
                  onClick={() => setShowWizard(true)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 14,
                    backgroundColor: T.primary,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Конструктор
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Outliner list */
          <div
            style={{
              backgroundColor: T.card,
              borderRadius: 18,
              border: `1px solid ${T.hairline}`,
              overflow: 'hidden',
              marginBottom: 8,
              padding: '4px 0',
            }}
          >
            {rootFolders.map((folder) => (
              <div key={folder.id}>
                {renderFolderRow(folder)}
                {/* Child folders */}
                {(childFoldersMap[folder.id] ?? []).map((child) =>
                  renderFolderRow(child, 1)
                )}
              </div>
            ))}

            {/* Ungrouped categories */}
            {ungroupedCats.map((cat) => renderCategoryRow(cat))}

            {/* Add folder row */}
            {inlineEdit?.kind === 'folder-new' ? (
              <div style={{ padding: '4px 8px' }}>
                <InlineInputRow
                  placeholder="Название папки"
                  indent={false}
                  onSave={handleInlineCreateFolder}
                  onCancel={() => setInlineEdit(null)}
                />
              </div>
            ) : (
              <button
                onClick={() => setInlineEdit({ kind: 'folder-new', id: '' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  margin: '8px 0 4px',
                  padding: '8px 0',
                  border: `1.5px dashed ${T.hairline}`,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.sub,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                ＋ Новая папка
              </button>
            )}
          </div>
        )}

        {/* Library section */}
        {libraryItems.length > 0 && tab === 'expense' && !searchQuery && (
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setShowLibrary((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                В библиотеке ({libraryItems.length})
              </span>
              <span style={{ fontSize: 11, color: T.subLight }}>
                {showLibrary ? '▴ Скрыть' : '▸ Показать'}
              </span>
            </button>

            {showLibrary && (
              <div
                style={{
                  backgroundColor: T.card,
                  borderRadius: 18,
                  border: `1px solid ${T.hairline}`,
                  overflow: 'hidden',
                  padding: '4px 0',
                }}
              >
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
                    <div
                      key={libCat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        paddingLeft: 12,
                        paddingRight: 12,
                        height: 44,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          backgroundColor: `${asCat.color}33`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <StickerIcon icon={asCat.icon} color={asCat.color} className="h-4 w-4" />
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.fg }}>
                        {t.cat(libCat.name)}
                      </span>
                      <button
                        onClick={() => handleActivateFromLibrary(libCat)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 10,
                          backgroundColor: `${T.primary}15`,
                          color: T.primary,
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Добавить
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────────── */}

      <CategoryEditorSheet
        open={editor.open}
        onClose={() => setEditor({ open: false })}
        initial={editor.category}
        type={tab}
        folderId={editor.folderId}
        availableFolders={folders}
        budget={editor.category ? (budgetLimits[editor.category.id] ?? 0) || undefined : undefined}
        onBudgetChange={async (v) => {
          if (!editor.category || !user) return;
          const limit = v ?? 0;
          await saveBudget(user.id, editor.category.id, limit);
          dispatch(setBudgetLimit({ categoryId: editor.category.id, limit }));
        }}
        onSave={handleSave}
        onDelete={editor.category ? async () => {
          if (!editor.category || !user) return;
          await archiveCategoryInFirestore(user.id, editor.category.id, editor.category.type);
          dispatch(archiveCategory({ id: editor.category.id, type: editor.category.type }));
          setEditor({ open: false });
        } : undefined}
      />

      <FolderEditorSheet
        open={folderEditor.open}
        onClose={() => setFolderEditor({ open: false })}
        initial={folderEditor.folder}
        type={tab}
        onSave={handleFolderSave}
        onDelete={folderEditor.folder ? async () => {
          if (!folderEditor.folder) return;
          if (!confirm('Удалить папку? Категории останутся, но потеряют группу.')) return;
          await handleFolderDelete(folderEditor.folder);
          setFolderEditor({ open: false });
        } : undefined}
        availableFolders={rootFolders.filter((f) => f.id !== folderEditor.folder?.id)}
      />

      <ConstructorWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        existingCategoryIds={existingCategoryIds}
        existingFolderIds={existingFolderIds}
      />
    </div>
  );
}
