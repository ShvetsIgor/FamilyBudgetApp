/**
 * Contribution shape normalization: reads accept both the legacy array and
 * the new id-keyed map, always surfacing stable ids for the map shape.
 * (The transactional apply/reverse logic itself is covered end-to-end by the
 * Firestore rules tests against the emulator.)
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeContributions,
  newContributionId,
} from '@/features/savings/services/savingsService';

describe('normalizeContributions', () => {
  it('reads the legacy array shape (no ids)', () => {
    const out = normalizeContributions([
      { amount: 100, date: '2026-07-01', byId: 'alice' },
      { amount: 50, date: '2026-07-05', byId: 'bob', byName: 'Bob' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ amount: 100, byId: 'alice' });
    expect(out[0].id).toBeUndefined();
    expect(out[1]).toMatchObject({ amount: 50, byName: 'Bob' });
  });

  it('reads the map shape and surfaces the map key as id, sorted by date', () => {
    const out = normalizeContributions({
      cB: { amount: 50, date: '2026-07-05', byId: 'bob' },
      cA: { amount: 100, date: '2026-07-01', byId: 'alice' },
    });
    expect(out.map((c) => c.id)).toEqual(['cA', 'cB']); // date-sorted
    expect(out[0]).toMatchObject({ id: 'cA', amount: 100, byId: 'alice' });
  });

  it('treats empty/undefined as no contributions', () => {
    expect(normalizeContributions(undefined)).toEqual([]);
    expect(normalizeContributions([])).toEqual([]);
    expect(normalizeContributions({})).toEqual([]);
  });
});

describe('newContributionId', () => {
  it('produces unique ids usable as Firestore map keys', () => {
    const a = newContributionId();
    const b = newContributionId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[./]/); // no path separators
  });
});
