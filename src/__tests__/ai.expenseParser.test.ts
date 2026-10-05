import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseParserError, parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import type { Category } from '@/shared/types';

const CATEGORIES = [
  { id: 'groceries', name: 'Продукты' },
  { id: 'fuel', name: 'Топливо' },
  { id: 'fastfood', name: 'Фастфуд' },
  { id: 'utilities', name: 'Коммунальные' },
];

function mockGroqResponse(content: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  } as Response;
}

beforeEach(() => {
  vi.stubEnv('GROQ_API_KEY', 'test-key');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('parseExpenseText', () => {
  it('throws a clear error when GROQ_API_KEY is missing — never a silent no-op', async () => {
    vi.unstubAllEnvs();
    await expect(
      parseExpenseText({ text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru' }),
    ).rejects.toThrow(ExpenseParserError);
  });

  it('sends model, strict json_schema with the caller\'s categoryIds, and the raw text', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 187, currency: null, merchant: 'Shufersal', description: 'Shufersal',
        categoryId: 'groceries', date: null, confidence: 0.97, needsClarification: false, clarificationQuestion: null,
      }),
    );

    await parseExpenseText({ text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.properties.categoryId.enum).toEqual([
      'groceries', 'fuel', 'fastfood', 'utilities', null,
    ]);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Шуферсаль 187' });
  });

  it('"Шуферсаль 187" — no currency in text, defaults to the caller\'s defaultCurrency, not a hardcoded ILS', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 187, currency: null, merchant: 'Shufersal', description: 'Shufersal',
        categoryId: 'groceries', date: null, confidence: 0.97, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'USD', language: 'ru',
    });

    expect(result).toEqual({
      type: 'expense', amount: 187, currency: 'USD', merchant: 'Shufersal', description: 'Shufersal',
      categoryId: 'groceries', date: null, confidence: 0.97, needsClarification: false, clarificationQuestion: null,
    });
  });

  it('"залил 300 на Паз" — fuel merchant, explicit currency respected over the default', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 300, currency: 'ILS', merchant: 'Paz', description: 'Paz',
        categoryId: 'fuel', date: null, confidence: 0.9, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'залил 300 на Паз', categories: CATEGORIES, defaultCurrency: 'USD', language: 'ru',
    });

    expect(result.currency).toBe('ILS');
    expect(result.categoryId).toBe('fuel');
  });

  it.each(['EUR', 'GBP', '', 'ils', 123, {}, undefined])(
    'does not replace invalid or missing currency %j with the profile currency', async (currency) => {
      vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
        type: 'expense', amount: 50, currency, categoryId: 'groceries', date: null,
        confidence: 0.99, needsClarification: false, clarificationQuestion: 'Everything is fine',
      }));

      const result = await parseExpenseText({
        text: 'покупка 50', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
      });

      expect(result.amount).toBe(50);
      expect(result.currency).toBeNull();
      expect(result.needsClarification).toBe(true);
      expect(result.clarificationQuestion).toBe('В какой валюте был расход? Поддерживаются ILS, USD, CAD и RUB.');
    },
  );

  it('uses an English currency clarification for an English profile', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
      amount: 50, currency: 'EUR', needsClarification: false,
    }));

    const result = await parseExpenseText({
      text: 'purchase 50 euros', categories: CATEGORIES, defaultCurrency: 'USD', language: 'en',
    });
    expect(result.clarificationQuestion)
      .toBe('Which currency was the expense in? Supported currencies are ILS, USD, CAD and RUB.');
  });

  it('keeps a schema-compliant unsupported-currency refusal unresolved', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
      type: 'expense', amount: 50, currency: null, categoryId: 'groceries', date: null,
      confidence: 0.99, needsClarification: true, clarificationQuestion: 'EUR is not supported.',
    }));

    const result = await parseExpenseText({
      text: 'purchase 50 euros', categories: CATEGORIES, defaultCurrency: 'USD', language: 'en',
    });
    expect(result.currency).toBeNull();
    expect(result.needsClarification).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages[0].content).toContain('Never convert or replace it with another currency.');
  });

  it.each([['EUR', false], [null, true]] as const)(
    'parser → validator accepts only a genuinely unspecified currency (%s)', async (currency, valid) => {
      vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
        type: 'expense', amount: 50, currency, categoryId: 'groceries', date: null,
        confidence: 0.99, needsClarification: false, clarificationQuestion: null,
      }));
      const result = await parseExpenseText({
        text: 'purchase 50', categories: CATEGORIES, defaultCurrency: 'CAD', language: 'en',
      });
      const categories: Category[] = [{
        id: 'groceries', name: 'Groceries', userId: 'u1', type: 'expense',
        icon: 'cart', color: '#000000', order: 0, isPrivate: false,
      }];
      const validation = validateParsedExpense(result, { categories, todayKey: '2026-09-21' });

      expect(validation.valid).toBe(valid);
      if (valid) expect(validation).toMatchObject({ expense: { currency: 'CAD', amount: 50 } });
      else expect(validation).toEqual({ valid: false, reason: 'clarification_required' });
    },
  );

  it('"макдональдс 62.5" — decimal amount passes through untouched', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 62.5, currency: null, merchant: 'McDonald\'s', description: 'McDonald\'s',
        categoryId: 'fastfood', date: null, confidence: 0.95, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'макдональдс 62.5', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });

    expect(result.amount).toBe(62.5);
  });

  it('"вчера заплатил за электричество 420 шекелей" — explicit past date resolved by the model, passed through', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 420, currency: 'ILS', merchant: null, description: 'Electricity',
        categoryId: 'utilities', date: '2026-09-18', confidence: 0.9, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'вчера заплатил за электричество 420 шекелей', categories: CATEGORIES, defaultCurrency: 'ILS',
      language: 'ru', todayKey: '2026-09-19',
    });

    expect(result.date).toBe('2026-09-19'.replace('19', '18')); // sanity: fixture matches injected "yesterday"
  });

  it('missing amount forces needsClarification true even if the model claimed false — req. 10 as a code guarantee', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: null, currency: null, merchant: 'Кафе', description: null,
        categoryId: null, date: null, confidence: 0.4, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'зашёл в кафе', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });

    expect(result.needsClarification).toBe(true);
    expect(result.clarificationQuestion).toBeTruthy();
    expect(result.currency).toBeNull();
  });

  it.each(['yesterday', '2026-9-21', '2026-09-21T00:00:00Z', '', 123, {}, undefined])(
    'parser → validator rejects a malformed or missing date (%j) instead of using today', async (date) => {
      vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
        type: 'expense', amount: 50, currency: 'ILS', categoryId: 'groceries', date,
        confidence: 0.99, needsClarification: false, clarificationQuestion: 'Everything is fine',
      }));
      const result = await parseExpenseText({
        text: 'покупка 50', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
      });
      const categories: Category[] = [{
        id: 'groceries', name: 'Groceries', userId: 'u1', type: 'expense',
        icon: 'cart', color: '#000000', order: 0, isPrivate: false,
      }];

      expect(result).toMatchObject({
        amount: 50, currency: 'ILS', date: null, needsClarification: true,
        clarificationQuestion: 'Когда был расход? Уточните дату, пожалуйста.',
      });
      expect(validateParsedExpense(result, { categories, todayKey: '2026-09-21' }))
        .toEqual({ valid: false, reason: 'clarification_required' });
    },
  );

  it('uses an English clarification for a malformed date', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
      amount: 50, currency: 'USD', date: 'yesterday', needsClarification: false,
    }));
    const result = await parseExpenseText({
      text: 'purchase 50 yesterday', categories: CATEGORIES, defaultCurrency: 'USD', language: 'en',
    });
    expect(result.clarificationQuestion).toBe('What date was the expense? Please specify the date.');
  });

  it.each([
    { date: null, expected: '2026-09-21' },
    { date: '2026-09-20', expected: '2026-09-20' },
    { date: '2024-02-29', expected: '2024-02-29' },
    { date: '2026-02-31', expected: null },
  ])('parser → validator handles calendar date $date without replacing invalid dates', async ({ date, expected }) => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockGroqResponse({
      type: 'expense', amount: 50, currency: 'ILS', categoryId: 'groceries', date,
      confidence: 0.99, needsClarification: false, clarificationQuestion: null,
    }));
    const result = await parseExpenseText({
      text: 'покупка 50', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });
    const categories: Category[] = [{
      id: 'groceries', name: 'Groceries', userId: 'u1', type: 'expense',
      icon: 'cart', color: '#000000', order: 0, isPrivate: false,
    }];
    const validation = validateParsedExpense(result, { categories, todayKey: '2026-09-21' });
    if (expected === null) {
      expect(validation).toEqual({ valid: false, reason: 'invalid_date' });
    } else {
      expect(validation).toMatchObject({ valid: true, expense: { date: expected } });
    }
  });

  it('a categoryId the model returns outside the enum is dropped to null, never trusted blindly', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 50, currency: 'ILS', merchant: 'Something', description: null,
        categoryId: 'made-up-id', date: null, confidence: 0.8, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'что-то 50', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });

    // The dedicated validateParsedExpense step (later, API-route layer) will
    // also re-check membership against a FRESHLY re-fetched category list —
    // belt and braces — but this layer must not let it through either.
    expect(result.categoryId).toBeNull();
  });

  it('malformed JSON content from Groq degrades to a clarification result, never throws', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not valid json {' } }] }),
    } as Response);

    const result = await parseExpenseText({
      text: 'что-то непонятное', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'en',
    });

    expect(result.needsClarification).toBe(true);
    expect(result.amount).toBeNull();
    expect(result.clarificationQuestion).toContain("couldn't");
  });

  it('a non-ok HTTP response throws ExpenseParserError instead of returning a fake result', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 500, text: async () => 'internal error',
    } as Response);

    await expect(
      parseExpenseText({ text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru' }),
    ).rejects.toThrow(ExpenseParserError);
  });

  it.each([new TypeError('Failed to fetch'), 'connection lost', null])(
    'wraps transport failures in ExpenseParserError (%s)', async (cause) => {
      vi.spyOn(global, 'fetch').mockRejectedValue(cause);

      const result = parseExpenseText({
        text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
      });

      await expect(result).rejects.toBeInstanceOf(ExpenseParserError);
      await expect(result).rejects.toMatchObject({ message: 'Groq request or response failed', cause });
    },
  );

  it('wraps malformed provider response JSON in ExpenseParserError', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not JSON', { status: 200 }));

    await expect(parseExpenseText({
      text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    })).rejects.toBeInstanceOf(ExpenseParserError);
  });

  it.each([null, {}, { choices: [{ message: { content: 42 } }] }])(
    'rejects a provider response without text content (%j)', async (payload) => {
      vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));

      const result = parseExpenseText({
        text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
      });

      await expect(result).rejects.toBeInstanceOf(ExpenseParserError);
      await expect(result).rejects.toThrow('Groq response missing message content');
    },
  );

  it.each(['headers', 'body'] as const)('aborts a stalled response while waiting for %s', async (phase) => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(global, 'fetch').mockImplementation(async (_url, options) => {
      const signal = options!.signal!;
      requestSignal = signal;
      const pending = () => new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      if (phase === 'headers') return pending();
      return { ok: true, json: pending } as unknown as Response;
    });

    const result = parseExpenseText({
      text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });
    const rejected = expect(result).rejects.toBeInstanceOf(ExpenseParserError);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await rejected;
    await expect(result).rejects.toThrow('Groq request timed out after 15 seconds');
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200, 503])('clears the deadline after HTTP %i without reading an error body', async (status) => {
    vi.useFakeTimers();
    const response = new Response(JSON.stringify({
      choices: [{ message: { content: '{}' } }],
    }), { status });
    const readText = vi.spyOn(response, 'text');
    vi.spyOn(global, 'fetch').mockResolvedValue(response);

    const result = parseExpenseText({
      text: 'Шуферсаль 187', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });
    if (status === 200) {
      await expect(result).resolves.toHaveProperty('needsClarification', true);
    } else {
      await expect(result).rejects.toThrow('Groq request failed: HTTP 503');
    }

    expect(readText).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('confidence is clamped into [0, 1] even if the model returns something out of range', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockGroqResponse({
        type: 'expense', amount: 100, currency: 'ILS', merchant: null, description: null,
        categoryId: null, date: null, confidence: 1.4, needsClarification: false, clarificationQuestion: null,
      }),
    );

    const result = await parseExpenseText({
      text: 'что-то 100', categories: CATEGORIES, defaultCurrency: 'ILS', language: 'ru',
    });

    expect(result.confidence).toBe(1);
  });
});
