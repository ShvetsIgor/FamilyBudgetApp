// @vitest-environment node
import { expect, it } from 'vitest';
import { readSiriRequest } from '@/features/ai/siriRequest';
import { toZonedDateKey } from '@/shared/utils/dateKey';
const request = (body: unknown) => new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) });
it.each([null, [], {}, { text: ' ' }, { text: 'x', timeZone: 'nonsense' }, { text: 'x'.repeat(2001), timeZone: 'UTC' }])('rejects invalid input', async (body) => {
  await expect(readSiriRequest(request(body))).rejects.toMatchObject({ status: 400 });
});
it('accepts a bounded text and explicit timezone', async () => {
  expect(await readSiriRequest(request({ text: ' Coffee 10 ', timeZone: 'Asia/Jerusalem' }))).toMatchObject({ text: 'Coffee 10', timeZone: 'Asia/Jerusalem', todayKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
});
it('rejects oversized bytes even without Content-Length', async () => {
  await expect(readSiriRequest(request({ text: 'x'.repeat(9000), timeZone: 'UTC' }))).rejects.toMatchObject({ status: 413 });
});
it('uses user-local dates across midnight and year boundaries', () => {
  const now = new Date('2026-12-31T23:30:00Z');
  expect(toZonedDateKey(now, 'Asia/Jerusalem')).toBe('2027-01-01');
  expect(toZonedDateKey(now, 'America/Toronto')).toBe('2026-12-31');
});

it.each(['', '../other', 'id\n', 'x'.repeat(129), 123])('rejects unsafe request IDs: %s', async (requestId) => {
  await expect(readSiriRequest(request({ text: 'Coffee 10', timeZone: 'UTC', requestId }))).rejects.toMatchObject({ status: 400 });
});
