// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ doc: vi.fn(), profile: vi.fn(), collection: vi.fn(), categories: vi.fn(), folders: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => mock }));
import { loadSiriContext, SiriProfileError } from '@/features/ai/siriContext';
const item = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });
beforeEach(() => {
  vi.resetAllMocks();
  mock.doc.mockReturnValue({ get: mock.profile });
  mock.profile.mockResolvedValue({ data: () => ({ currency: 'CAD', language: 'en' }) });
  mock.collection.mockImplementation((path: string) => ({ orderBy: (field: string) => {
    expect(field).toBe('order');
    return { get: path.startsWith('categories/') ? mock.categories : mock.folders };
  } }));
  mock.categories.mockResolvedValue({ docs: [] });
  mock.folders.mockResolvedValue({ docs: [] });
});
it('reads only the owner, preserves privacy, excludes archived/income entries, and uses document IDs', async () => {
  mock.categories.mockResolvedValue({ docs: [
    item('food', { id: 'spoof', userId: 'bob', type: 'expense', name: 'Food', isPrivate: true }),
    item('archived', { type: 'expense', archived: true }),
    item('income', { type: 'income' }),
  ] });
  mock.folders.mockResolvedValue({ docs: [item('home', { type: 'expense', name: 'Home' })] });
  const result = await loadSiriContext('alice');
  expect(mock.doc).toHaveBeenCalledWith('users/alice');
  expect(mock.collection.mock.calls).toEqual([['categories/alice/expense'], ['categoryFolders/alice/expense']]);
  expect(result.currency).toBe('CAD'); expect(result.language).toBe('en');
  expect(result.categories).toEqual([{ id: 'food', userId: 'alice', type: 'expense', name: 'Food', isPrivate: true }]);
  expect(result.folders).toEqual([{ id: 'home', userId: 'alice', type: 'expense', name: 'Home' }]);
});
it.each([undefined, {}, { currency: 'EUR', language: 'en' }, { currency: 'ILS', language: 'he' }])('rejects missing or unsupported preferences without guessing defaults', async (profile) => {
  mock.profile.mockResolvedValue({ data: () => profile });
  await expect(loadSiriContext('alice')).rejects.toBeInstanceOf(SiriProfileError);
  expect(mock.collection).not.toHaveBeenCalled();
});
it('keeps an empty active list empty instead of seeding presets', async () => {
  expect((await loadSiriContext('alice')).categories).toEqual([]);
});
it('propagates read errors instead of returning a partial category list', async () => {
  mock.folders.mockRejectedValue(new Error('offline'));
  await expect(loadSiriContext('alice')).rejects.toThrow('offline');
});
