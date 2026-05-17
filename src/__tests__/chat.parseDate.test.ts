import { describe, it, expect } from 'vitest';
import { extractDate } from '@/features/chat/parser/parseDate';
import { parseMessage } from '@/features/chat/parser/parse';

const noLearned = { learned: {} };

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('extractDate', () => {
  it('«9 мая» → правильный ISO и метка', () => {
    const r = extractDate('хлеб 50 9 мая');
    expect(r).not.toBeNull();
    expect(r!.date).toMatch(/^\d{4}-05-09$/);
    expect(r!.label).toBe('9 мая');
    expect(r!.rest).toBe('хлеб 50');
  });

  it('«15 января 2025» → ISO 2025-01-15', () => {
    const r = extractDate('15 января 2025 бензин 200');
    expect(r!.date).toBe('2025-01-15');
    expect(r!.label).toContain('2025');
    expect(r!.rest).toBe('бензин 200');
  });

  it('«вчера» → yesterday ISO', () => {
    const yest = new Date(Date.now() - 86_400_000);
    const yesterday = localISO(yest);
    const r = extractDate('кофе 65 вчера');
    expect(r!.date).toBe(yesterday);
    expect(r!.label).toBe('вчера');
    expect(r!.rest).toBe('кофе 65');
  });

  it('«сегодня» → today ISO', () => {
    const today = localISO(new Date());
    const r = extractDate('сегодня хлеб 30');
    expect(r!.date).toBe(today);
  });

  it('без даты → null', () => {
    expect(extractDate('хлеб 50')).toBeNull();
  });

  it('«1 декабря» → декабрь', () => {
    const r = extractDate('аренда 5000 1 декабря');
    expect(r!.date).toMatch(/-12-01$/);
    expect(r!.rest).toBe('аренда 5000');
  });
});

describe('parseMessage с датой', () => {
  it('«даббах 1065 9 мая» → amount=1065, date=...-05-09, confidence=failed', () => {
    const r = parseMessage('даббах 1065 9 мая', noLearned);
    expect(r.amount).toBe(1065);
    expect(r.date).toMatch(/-05-09$/);
    expect(r.dateLabel).toBe('9 мая');
    expect(r.confidence).toBe('failed');
  });

  it('«хлеб 50 9 мая» → groceries + date', () => {
    const r = parseMessage('хлеб 50 9 мая', noLearned);
    expect(r.amount).toBe(50);
    expect(r.parentId).toBe('groceries');
    expect(r.date).toMatch(/-05-09$/);
    expect(r.confidence).toBe('medium');
  });

  it('«65 кофе вчера» → dining + yesterday date', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const r = parseMessage('65 кофе вчера', noLearned);
    expect(r.amount).toBe(65);
    expect(r.parentId).toBe('dining');
    expect(r.date).toBe(yesterday);
  });

  it('«1065 9 мая» (только число с датой) → amount=1065, date, confidence=failed (нет слова)', () => {
    const r = parseMessage('1065 9 мая', noLearned);
    expect(r.amount).toBe(1065);
    expect(r.date).toMatch(/-05-09$/);
    expect(r.categoryId).toBeNull();
    expect(r.confidence).toBe('failed');
  });

  it('дата не мешает матчингу ключевых слов', () => {
    const r = parseMessage('аренда 5000 1 декабря', noLearned);
    expect(r.amount).toBe(5000);
    expect(r.parentId).toBe('home');
    expect(r.categoryId).toBe('rent');
    expect(r.date).toMatch(/-12-01$/);
  });
});
