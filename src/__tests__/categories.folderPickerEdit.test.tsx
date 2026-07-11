/**
 * The /categories hub exposes folder editing through the picker's pencil:
 * open a folder → pencil in the header → onEditFolder(folder).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryFolderPickerView } from '@/features/categories/components/CategoryFolderPickerSheet';
import type { Category } from '@/shared/types';

vi.mock('@/shared/hooks/useT', () => {
  const t = ((key: string) => key) as ((key: string) => string) & { cat: (name: string) => string };
  t.cat = (name: string) => name;
  return { useT: () => t };
});

const folder = { id: 'f1', name: 'Food', icon: 'plate', color: '#E07A5F' };

const catInFolder: Category = {
  id: 'c1', userId: 'u1', name: 'Groceries', icon: 'cart', color: '#E07A5F',
  type: 'expense', order: 0, isPrivate: false, folderId: 'f1',
};

const ungroupedCat: Category = {
  id: 'c2', userId: 'u1', name: 'Loose', icon: 'box', color: '#E07A5F',
  type: 'expense', order: 0, isPrivate: false,
};

function renderPicker(onEditFolder?: (f: { id: string }) => void) {
  return render(
    <CategoryFolderPickerView
      title="Categories"
      mode="single"
      folders={[folder]}
      categories={[catInFolder, ungroupedCat]}
      onSelectCategory={() => {}}
      onEditFolder={onEditFolder}
      showSearch={false}
    />,
  );
}

describe('CategoryFolderPickerView folder editing', () => {
  it('shows the pencil inside an opened folder and calls onEditFolder', () => {
    const onEditFolder = vi.fn();
    renderPicker(onEditFolder);

    // Root grid: no header, no pencil yet
    expect(screen.queryByLabelText('categories.pickerAria.editFolder')).toBeNull();

    fireEvent.click(screen.getByText('Food'));

    const pencil = screen.getByLabelText('categories.pickerAria.editFolder');
    fireEvent.click(pencil);

    expect(onEditFolder).toHaveBeenCalledTimes(1);
    expect(onEditFolder.mock.calls[0][0]).toMatchObject({ id: 'f1', name: 'Food' });
  });

  it('hides the pencil for the ungrouped pseudo-folder', () => {
    renderPicker(vi.fn());

    fireEvent.click(screen.getByText('categories.picker.ungrouped'));

    expect(screen.getByLabelText('categories.pickerAria.back')).toBeInTheDocument();
    expect(screen.queryByLabelText('categories.pickerAria.editFolder')).toBeNull();
  });

  it('renders no pencil when onEditFolder is not provided (split/expense pickers)', () => {
    renderPicker(undefined);

    fireEvent.click(screen.getByText('Food'));

    expect(screen.getByLabelText('categories.pickerAria.back')).toBeInTheDocument();
    expect(screen.queryByLabelText('categories.pickerAria.editFolder')).toBeNull();
  });
});
