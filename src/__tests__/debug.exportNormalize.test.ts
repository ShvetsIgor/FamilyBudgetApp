/**
 * Timestamp.toJSON() runs before any JSON.stringify replacer, so the export
 * must deep-normalize Timestamps to ISO strings BEFORE stringifying.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { normalizeForExport } from '@/features/debug/services/exportAllDataService';

describe('normalizeForExport', () => {
  const ts = Timestamp.fromDate(new Date('2026-07-11T10:00:00.000Z'));

  it('converts nested Timestamps to ISO strings', () => {
    const input = {
      createdAt: ts,
      items: [{ date: ts, amount: 5 }],
      profile: { deep: { expiresAt: ts } },
      plain: 'x',
      n: 3,
      none: null,
    };
    const out = normalizeForExport(input) as Record<string, unknown>;
    expect(out.createdAt).toBe('2026-07-11T10:00:00.000Z');
    expect((out.items as Array<Record<string, unknown>>)[0].date).toBe('2026-07-11T10:00:00.000Z');
    expect((out.profile as { deep: { expiresAt: string } }).deep.expiresAt).toBe('2026-07-11T10:00:00.000Z');
    expect(out.plain).toBe('x');
    expect(out.n).toBe(3);
    expect(out.none).toBeNull();
  });

  it('survives JSON round-trip with ISO dates (no {seconds, nanoseconds})', () => {
    const json = JSON.stringify(normalizeForExport({ d: ts }));
    const parsed = JSON.parse(json) as { d: unknown };
    expect(parsed.d).toBe('2026-07-11T10:00:00.000Z');
    expect(json).not.toContain('seconds');
    // Regression guard: replacer-based conversion would produce this shape
    const broken = JSON.stringify({ d: ts }, (_k, v) => (v instanceof Timestamp ? 'never-happens' : v));
    expect(broken).toContain('seconds');
  });
});
