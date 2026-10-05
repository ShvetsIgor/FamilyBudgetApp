import { describe, expect, it } from 'vitest';
import { buildExpenseParserJsonSchema, PARSER_CURRENCIES } from '@/features/ai/expenseParser/schema';

describe('ai.expenseParserSchema', () => {
  it('excludes EUR — not a real app Currency value', () => {
    // Pinned deliberately: the task spec asked for EUR, the app's Currency
    // type does not have it. See the comment in schema.ts for why.
    expect(PARSER_CURRENCIES).toEqual(['ILS', 'USD', 'CAD', 'RUB']);
    expect(PARSER_CURRENCIES).not.toContain('EUR');
  });

  it('constrains categoryId to exactly the ids passed in, plus null', () => {
    const schema = buildExpenseParserJsonSchema(['groceries', 'fuel']);
    expect(schema.schema.properties.categoryId.enum).toEqual(['groceries', 'fuel', null]);
  });

  it('constrains categoryId to only null when no active categories exist', () => {
    const schema = buildExpenseParserJsonSchema([]);
    expect(schema.schema.properties.categoryId.enum).toEqual([null]);
  });

  it('is strict and forbids extra properties', () => {
    const schema = buildExpenseParserJsonSchema(['groceries']);
    expect(schema.strict).toBe(true);
    expect(schema.schema.additionalProperties).toBe(false);
  });
});
