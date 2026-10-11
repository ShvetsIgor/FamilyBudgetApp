/**
 * Saving an edited category without a folder failed silently: the object
 * carried folderId: undefined, which updateDoc rejects. Absent fields are now
 * deletes — moving a category out of its folder really removes folderId.
 */
import { describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (original) => ({
  ...await original<typeof import('firebase/firestore')>(),
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  updateDoc: vi.fn(async (...args: unknown[]) => { fs.calls.push(args); }),
  deleteField: () => '<delete>',
}));

import { updateCategory } from '@/features/categories/services/categoriesService';
import { updateFolder } from '@/features/categories/services/categoryFoldersService';
import { toUpdatePayload } from '@/shared/lib/firestoreUpdate';

describe('edit saves', () => {
  it('turn absent fields into deletes instead of undefined', () => {
    expect(toUpdatePayload({ name: 'Nanny', folderId: undefined, tags: [] })).toEqual({ name: 'Nanny', folderId: '<delete>', tags: [] });
  });

  it('a category without a folder saves', async () => {
    fs.calls = [];
    await updateCategory('u1', { id: 'c1', userId: 'u1', name: 'Nanny', icon: 'teddy', color: '#123456', type: 'expense',
      isPrivate: false, order: 0, folderId: undefined, extraFolderIds: [] });
    expect(fs.calls).toHaveLength(1);
    const [path, data] = fs.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('categories/u1/expense/c1');
    expect(Object.values(data)).not.toContain(undefined);
    expect(data).toMatchObject({ color: '#123456', folderId: '<delete>' });
  });

  it('a top-level folder saves', async () => {
    fs.calls = [];
    await updateFolder('u1', { id: 'f1', userId: 'u1', name: 'Home', type: 'expense', order: 0, parentId: undefined } as never);
    expect(Object.values(fs.calls[0][1] as Record<string, unknown>)).not.toContain(undefined);
  });
});
