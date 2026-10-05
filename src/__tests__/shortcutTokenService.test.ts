// @vitest-environment node
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ setDoc: vi.fn(), deleteDoc: vi.fn(), getDocs: vi.fn() }));
vi.mock('@/shared/lib/firebase', () => ({ getDb: () => 'db' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
  doc: (path: string, id = 'new-token') => ({ path: `${path}/${id}`, id }),
  serverTimestamp: () => 'server-time', ...mocks,
}));
import { createShortcutToken, fetchShortcutTokens, revokeShortcutToken } from '@/features/shortcuts/services/shortcutTokenService';
beforeEach(() => { vi.resetAllMocks(); });

describe('personal shortcut tokens', () => {
  it('stores only the SHA-256 hash of a unique 256-bit secret under its owner', async () => {
    const first = await createShortcutToken('alice', ' iPhone ');
    const second = await createShortcutToken('alice', 'iPhone');
    expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(second.secret).not.toBe(first.secret);
    expect(mocks.setDoc.mock.calls[0]).toEqual([
      { path: 'users/alice/shortcutTokens/new-token', id: 'new-token' },
      { tokenHash: createHash('sha256').update(first.secret).digest('hex'), label: 'iPhone', createdAt: 'server-time', lastUsedAt: null },
    ]);
    expect(JSON.stringify(mocks.setDoc.mock.calls)).not.toContain(first.secret);
  });
  it.each(['', '   ', 'x'.repeat(81)])('rejects an invalid label before writing', async (label) => {
    await expect(createShortcutToken('alice', label)).rejects.toThrow();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
  it('does not return a secret if persistence fails', async () => {
    mocks.setDoc.mockRejectedValue(new Error('offline'));
    await expect(createShortcutToken('alice', 'iPhone')).rejects.toThrow('offline');
  });
  it('lists only display metadata, without returning stored hashes', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{ id: 'one', data: () => ({ label: 'Phone', tokenHash: 'hash' }) }] });
    expect(await fetchShortcutTokens('alice')).toEqual([{ id: 'one', label: 'Phone' }]);
    expect(mocks.getDocs).toHaveBeenCalledWith('users/alice/shortcutTokens');
  });
  it('revokes only the specified document and propagates write failure', async () => {
    await revokeShortcutToken('alice', 'one');
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: 'users/alice/shortcutTokens/one', id: 'one' });
    mocks.deleteDoc.mockRejectedValue(new Error('denied'));
    await expect(revokeShortcutToken('alice', 'one')).rejects.toThrow('denied');
  });
});
