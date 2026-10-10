import { expect, it } from 'vitest';
import { isMerchantDraftText, parseMerchantDraft } from '@/features/chat/parser/merchantDraft';

it.each([
  'Рами Леви 250', 'RAMI LEVY 250', '250 רמי לוי', '  Рами   Леви 25,50  ', 'Rami Levy 100',
  'Рами Леви продукты 250', 'Рами Леви 250 USD', 'вчера Рами Леви 250', 'Рами Леви -250', '+250 Рами Леви',
  'Рами Леви 0', 'Рами Леви 1,000', 'Unknown 250', 'Aroma 20', 'Вчера молоко 25.5 долларов', '250', '',
])('gates exactly the texts the dictionary would draft: %s', (text) => {
  expect(isMerchantDraftText(text)).toBe(parseMerchantDraft(text, 'ILS', '2026-10-06') !== null);
});
it('is independent of currency and date', () => {
  expect(isMerchantDraftText('Rami Levy 100')).toBe(true);
  expect(parseMerchantDraft('Rami Levy 100', 'CAD', '2020-01-01')).not.toBeNull();
});
