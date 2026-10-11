import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseReceiptImage } from '@/features/ai/receiptParser/parseReceiptImage';
import { sanitizeReceipt } from '@/features/ai/receiptParser/receipt';

// A synthetic Hebrew supermarket receipt (rendered from HTML): five lines,
// total ₪76.10, dated 09/10/26, with VAT and card lines that must be skipped.
const image = `data:image/jpeg;base64,${readFileSync(path.join(__dirname, 'fixtures/receipt-shufersal.jpg')).toString('base64')}`;
const categories = [
  { id: 'groceries', name: 'Продукты' }, { id: 'household', name: 'Хозтовары' }, { id: 'fuel', name: 'Топливо' },
];

test('reads total, date, currency and line items of a Hebrew receipt', { timeout: 60_000 }, async () => {
  const raw = await parseReceiptImage({ imageDataUrl: image, categories, language: 'ru', todayKey: '2026-10-11' });
  const result = sanitizeReceipt(raw, { categoryIds: categories.map((c) => c.id), defaultCurrency: 'ILS', todayKey: '2026-10-11' });
  expect(result.ok, JSON.stringify(raw)).toBe(true);
  if (!result.ok) return;
  const { receipt } = result;
  expect(receipt.total).toBe(76.1);
  expect(receipt.currency).toBe('ILS');
  expect(receipt.date).toBe('2026-10-09');
  // Groups always add up to exactly the total; VAT and payment lines were not counted as purchases
  expect(Math.round(receipt.groups.reduce((sum, g) => sum + g.amount, 0) * 100) / 100).toBe(76.1);
  expect(receipt.groups.find((g) => g.categoryId === 'household')?.amount, JSON.stringify(receipt)).toBe(14.9);
  expect(receipt.groups.some((g) => g.categoryId === 'fuel')).toBe(false);
});
