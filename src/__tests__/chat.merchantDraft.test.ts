import { expect, it } from 'vitest';
import { parseMerchantDraft } from '@/features/chat/parser/merchantDraft';

it.each(['Рами Леви 250', 'RAMI LEVY 250', 'rami levi 250', '250 רמי לוי', '  Рами   Леви 250  '])(
  'recognizes only the merchant and amount shorthand: %s', (text) => {
    expect(parseMerchantDraft(text, 'USD', '2026-10-06')).toEqual({
      amount: 250, currency: 'USD', date: '2026-10-06', merchant: 'Рами Леви',
      description: null, categoryId: null, merchantOnly: true,
    });
  },
);
it('preserves a decimal amount', () => {
  expect(parseMerchantDraft('Рами Леви 25,50', 'ILS', '2026-10-06')?.amount).toBe(25.5);
});
it.each([
  'Рами Леви продукты 250', 'Рами Леви одежда 250', 'Рами Леви 250 USD', 'Рами Леви 250 EUR',
  'вчера Рами Леви 250', 'Рами Леви -250', '+250 Рами Леви', 'возврат Рами Леви 250',
  'Рами Леви 250 и кофе 20', 'Рами Леви 20 30', 'Рами Леви 0', 'Рами Леви 1,000',
  'Не Рами Леви 250', 'Unknown 250', 'Aroma 20',
])('leaves richer, ambiguous or signed input to the AI validator: %s', (text) => {
  expect(parseMerchantDraft(text, 'ILS', '2026-10-06')).toBeNull();
});
