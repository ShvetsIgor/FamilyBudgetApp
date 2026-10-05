// @vitest-environment node
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ group: vi.fn(), where: vi.fn(), limit: vi.fn(), get: vi.fn(), update: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => ({ collectionGroup: mock.group }) }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'server-time' } }));
import { resolveShortcutAuthorization, resolveShortcutToken } from '@/features/ai/siriAuth';
const secret = 'ab'.repeat(32);
const document = (path = 'users/alice/shortcutTokens/phone') => ({ ref: { path, update: mock.update } });
beforeEach(() => {
  vi.resetAllMocks();
  mock.group.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ limit: mock.limit });
  mock.limit.mockReturnValue({ get: mock.get });
  mock.get.mockResolvedValue({ docs: [document()] });
  mock.update.mockResolvedValue(undefined);
});

describe('Siri token authentication', () => {
  it('looks up only the hash and derives the owner from its exact document path', async () => {
    expect(await resolveShortcutToken(secret)).toBe('alice');
    expect(mock.group).toHaveBeenCalledWith('shortcutTokens');
    expect(mock.where).toHaveBeenCalledWith('tokenHash', '==', createHash('sha256').update(secret).digest('hex'));
    expect(mock.limit).toHaveBeenCalledWith(2);
    expect(mock.update).toHaveBeenCalledWith({ lastUsedAt: 'server-time' });
  });
  it.each([null, '', 'Basic '+secret, 'Bearer', 'Bearer short', 'Bearer '+secret+' extra', 'Bearer '+secret.toUpperCase()])('rejects invalid authorization without a database call: %s', async (header) => {
    expect(await resolveShortcutAuthorization(header)).toBeNull();
    expect(mock.group).not.toHaveBeenCalled();
  });
  it('accepts a case-insensitive Bearer scheme and surrounding whitespace', async () => {
    expect(await resolveShortcutAuthorization('  bEaReR '+secret+'  ')).toBe('alice');
  });
  it('rejects an unknown or revoked token', async () => {
    mock.get.mockResolvedValue({ docs: [] });
    expect(await resolveShortcutToken(secret)).toBeNull();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('rejects duplicate hashes rather than selecting an arbitrary owner', async () => {
    mock.get.mockResolvedValue({ docs: [document(), document('users/bob/shortcutTokens/phone')] });
    expect(await resolveShortcutToken(secret)).toBeNull();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each(['families/alice/shortcutTokens/phone', 'users/alice/nested/item/shortcutTokens/phone'])('rejects a matching token in an unexpected path: %s', async (path) => {
    mock.get.mockResolvedValue({ docs: [document(path)] });
    expect(await resolveShortcutToken(secret)).toBeNull();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('does not turn a database outage into an invalid-token result', async () => {
    mock.get.mockRejectedValue(new Error('unavailable'));
    await expect(resolveShortcutToken(secret)).rejects.toThrow('unavailable');
  });
  it('ignores metadata update failure without recreating a token', async () => {
    mock.update.mockRejectedValue(new Error('not found'));
    expect(await resolveShortcutToken(secret)).toBe('alice');
  });
  it('does not wait for advisory usage metadata', async () => {
    mock.update.mockReturnValue(new Promise(() => {}));
    expect(await resolveShortcutToken(secret)).toBe('alice');
  });
});
