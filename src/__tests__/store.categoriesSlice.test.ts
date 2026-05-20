import { describe, it, expect } from 'vitest';
import reducer, {
  setCategories,
  addCategory,
  updateCategory,
  removeCategory,
  archiveCategory,
  setFolders,
  addFolder,
  updateFolder,
  removeFolder,
} from '@/features/categories/store/categoriesSlice';
import type { Category, CategoryFolder } from '@/shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCategory = (id: string, type: 'expense' | 'income' = 'expense', overrides: Partial<Category> = {}): Category => ({
  id,
  userId: 'u1',
  name: `Cat ${id}`,
  icon: 'cart',
  color: '#E07A5F',
  type,
  isPrivate: false,
  order: 0,
  ...overrides,
});

const makeFolder = (id: string, type: 'expense' | 'income' = 'expense', overrides: Partial<CategoryFolder> = {}): CategoryFolder => ({
  id,
  userId: 'u1',
  name: `Folder ${id}`,
  icon: 'box',
  color: '#E07A5F',
  type,
  order: 0,
  ...overrides,
});

const initialState = {
  expense: [],
  income: [],
  folders: { expense: [], income: [] },
  status: 'idle' as const,
  error: null,
};

// ── Category actions ──────────────────────────────────────────────────────────

describe('categoriesSlice — category actions', () => {
  it('setCategories sets list for expense type', () => {
    const cat = makeCategory('1', 'expense');
    const state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    expect(state.expense).toHaveLength(1);
    expect(state.income).toHaveLength(0);
    expect(state.status).toBe('ready');
  });

  it('setCategories sets list for income type', () => {
    const cat = makeCategory('1', 'income');
    const state = reducer(initialState, setCategories({ type: 'income', categories: [cat] }));
    expect(state.income).toHaveLength(1);
    expect(state.expense).toHaveLength(0);
  });

  it('addCategory appends to correct list', () => {
    const cat = makeCategory('1', 'expense');
    const state = reducer(initialState, addCategory(cat));
    expect(state.expense).toHaveLength(1);
    expect(state.expense[0].id).toBe('1');
  });

  it('updateCategory replaces matching entry', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, updateCategory({ ...cat, name: 'Updated' }));
    expect(state.expense[0].name).toBe('Updated');
  });

  it('updateCategory supports folderId change', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, updateCategory({ ...cat, folderId: 'folder-a' }));
    expect(state.expense[0].folderId).toBe('folder-a');
  });

  it('updateCategory does not affect other types', () => {
    const expCat = makeCategory('1', 'expense');
    const incCat = makeCategory('1', 'income');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [expCat] }));
    state = reducer(state, setCategories({ type: 'income', categories: [incCat] }));
    state = reducer(state, updateCategory({ ...expCat, name: 'Changed' }));
    expect(state.income[0].name).toBe('Cat 1');
  });

  it('removeCategory removes from expense list', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, removeCategory({ id: '1', type: 'expense' }));
    expect(state.expense).toHaveLength(0);
  });

  it('removeCategory ignores wrong type', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, removeCategory({ id: '1', type: 'income' }));
    expect(state.expense).toHaveLength(1);
  });

  it('archiveCategory sets archived=true without removing', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, archiveCategory({ id: '1', type: 'expense' }));
    expect(state.expense).toHaveLength(1);
    expect(state.expense[0].archived).toBe(true);
  });

  it('archiveCategory does not affect other categories', () => {
    const cat1 = makeCategory('1', 'expense');
    const cat2 = makeCategory('2', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat1, cat2] }));
    state = reducer(state, archiveCategory({ id: '1', type: 'expense' }));
    expect(state.expense.find((c) => c.id === '2')?.archived).toBeFalsy();
  });

  it('archived category is still in the list', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, archiveCategory({ id: '1', type: 'expense' }));
    expect(state.expense.some((c) => c.id === '1')).toBe(true);
  });
});

// ── Folder actions ────────────────────────────────────────────────────────────

describe('categoriesSlice — folder actions', () => {
  it('setFolders sets folder list for expense type', () => {
    const folder = makeFolder('f1', 'expense');
    const state = reducer(initialState, setFolders({ type: 'expense', folders: [folder] }));
    expect(state.folders.expense).toHaveLength(1);
    expect(state.folders.income).toHaveLength(0);
  });

  it('setFolders sets folder list for income type', () => {
    const folder = makeFolder('f1', 'income');
    const state = reducer(initialState, setFolders({ type: 'income', folders: [folder] }));
    expect(state.folders.income).toHaveLength(1);
    expect(state.folders.expense).toHaveLength(0);
  });

  it('addFolder appends to correct list', () => {
    const folder = makeFolder('f1', 'expense');
    const state = reducer(initialState, addFolder(folder));
    expect(state.folders.expense).toHaveLength(1);
    expect(state.folders.expense[0].id).toBe('f1');
  });

  it('updateFolder replaces matching folder', () => {
    const folder = makeFolder('f1', 'expense');
    let state = reducer(initialState, setFolders({ type: 'expense', folders: [folder] }));
    state = reducer(state, updateFolder({ ...folder, name: 'Updated Folder' }));
    expect(state.folders.expense[0].name).toBe('Updated Folder');
  });

  it('updateFolder supports color change', () => {
    const folder = makeFolder('f1', 'expense');
    let state = reducer(initialState, setFolders({ type: 'expense', folders: [folder] }));
    state = reducer(state, updateFolder({ ...folder, color: '#81B29A' }));
    expect(state.folders.expense[0].color).toBe('#81B29A');
  });

  it('removeFolder removes from expense folders', () => {
    const folder = makeFolder('f1', 'expense');
    let state = reducer(initialState, setFolders({ type: 'expense', folders: [folder] }));
    state = reducer(state, removeFolder({ id: 'f1', type: 'expense' }));
    expect(state.folders.expense).toHaveLength(0);
  });

  it('removeFolder does not affect income folders', () => {
    const expFolder = makeFolder('f1', 'expense');
    const incFolder = makeFolder('f1', 'income');
    let state = reducer(initialState, setFolders({ type: 'expense', folders: [expFolder] }));
    state = reducer(state, setFolders({ type: 'income', folders: [incFolder] }));
    state = reducer(state, removeFolder({ id: 'f1', type: 'expense' }));
    expect(state.folders.income).toHaveLength(1);
  });

  it('folders and categories are independent — removing folder does not remove cats', () => {
    const folder = makeFolder('f1', 'expense');
    const cat = makeCategory('c1', 'expense', { folderId: 'f1' });
    let state = reducer(initialState, setFolders({ type: 'expense', folders: [folder] }));
    state = reducer(state, addCategory(cat));
    state = reducer(state, removeFolder({ id: 'f1', type: 'expense' }));
    expect(state.expense).toHaveLength(1);
    expect(state.folders.expense).toHaveLength(0);
  });
});

// ── folderId on Category ──────────────────────────────────────────────────────

describe('categoriesSlice — folderId field', () => {
  it('category with folderId is stored correctly', () => {
    const cat = makeCategory('1', 'expense', { folderId: 'folder-food' });
    const state = reducer(initialState, addCategory(cat));
    expect(state.expense[0].folderId).toBe('folder-food');
  });

  it('category without folderId has undefined folderId', () => {
    const cat = makeCategory('1', 'expense');
    const state = reducer(initialState, addCategory(cat));
    expect(state.expense[0].folderId).toBeUndefined();
  });

  it('multiple categories in same folder', () => {
    const cat1 = makeCategory('1', 'expense', { folderId: 'food' });
    const cat2 = makeCategory('2', 'expense', { folderId: 'food' });
    const cat3 = makeCategory('3', 'expense', { folderId: 'transport' });
    let state = reducer(initialState, addCategory(cat1));
    state = reducer(state, addCategory(cat2));
    state = reducer(state, addCategory(cat3));
    const inFood = state.expense.filter((c) => c.folderId === 'food');
    expect(inFood).toHaveLength(2);
  });
});
