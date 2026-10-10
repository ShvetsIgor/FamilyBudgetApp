/**
 * Month stats are computed from the raw collections when no trusted aggregate
 * exists. Only a server-confirmed computation of a CLOSED month may be cached
 * back; offline, the screens still get numbers from the local cache instead
 * of an error, and nothing partial is written into the aggregate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toLocalMonthKey } from '@/shared/utils/dateKey';

const f = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
    collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    query: (path: string) => path,
    where: () => null,
    orderBy: () => null,
    getDoc: async () => ({ data: () => undefined }),
    getDocs: f.getDocs,
    getDocsFromServer: f.getDocsFromServer,
    runTransaction: f.runTransaction,
  };
});

import { fetchMonthStats } from '@/features/stats/services/statsService';

function snapshot(path: string) {
  const rows = path.startsWith('expenses')
    ? [{ amount: 40, currency: 'ILS', categoryId: 'food', splits: [] }]
    : [{ amount: 1000, currency: 'ILS' }];
  return { docs: rows.map(data => ({ data: () => data })) };
}

beforeEach(() => {
  f.getDocs.mockReset().mockImplementation(async (path: string) => snapshot(path));
  f.getDocsFromServer.mockReset().mockImplementation(async (path: string) => snapshot(path));
  f.runTransaction.mockReset().mockResolvedValue(undefined);
});

describe('fetchMonthStats', () => {
  it('caches a closed month computed from the server', async () => {
    const stats = await fetchMonthStats('bob', '2020-01');
    expect(stats.totalExpenses).toBe(40);
    expect(f.getDocs).not.toHaveBeenCalled();
    expect(f.runTransaction).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local cache offline and does not write it back', async () => {
    f.getDocsFromServer.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
    const stats = await fetchMonthStats('bob', '2020-01');
    expect(stats.totalExpenses).toBe(40);
    expect(stats.totalIncome).toBe(1000);
    expect(f.getDocs).toHaveBeenCalled();
    expect(f.runTransaction).not.toHaveBeenCalled();
  });

  it('reads the current month like any query and never caches it', async () => {
    const stats = await fetchMonthStats('bob', toLocalMonthKey(new Date()));
    expect(stats.totalExpenses).toBe(40);
    expect(f.getDocsFromServer).not.toHaveBeenCalled();
    expect(f.runTransaction).not.toHaveBeenCalled();
  });
});
