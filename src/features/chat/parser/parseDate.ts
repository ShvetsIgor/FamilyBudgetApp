const MONTHS: Record<string, number> = {
  'январь': 1, 'января': 1,
  'февраль': 2, 'февраля': 2,
  'март': 3, 'марта': 3,
  'апрель': 4, 'апреля': 4,
  'май': 5, 'мая': 5,
  'июнь': 6, 'июня': 6,
  'июль': 7, 'июля': 7,
  'август': 8, 'августа': 8,
  'сентябрь': 9, 'сентября': 9,
  'октябрь': 10, 'октября': 10,
  'ноябрь': 11, 'ноября': 11,
  'декабрь': 12, 'декабря': 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join('|');
const DATE_RE = new RegExp(`(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?`, 'i');

export interface ExtractedDate {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Human-readable label, e.g. "9 мая" */
  label: string;
  /** Original text with date tokens removed */
  rest: string;
}

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "5.06" or "5.06.2026" / "05.06" / "05/06/2026"
const NUMERIC_DATE_RE = /(?<![\d.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d.])/;
// "через N дней/неделю/месяц"
const RELATIVE_DAYS_RE = /через\s+(\d+)\s+(день|дня|дней|недел[юяи]|месяц|месяца|месяцев)/i;

function addDaysISO(days: number): string {
  return localDateISO(new Date(Date.now() + days * 86_400_000));
}

function addMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return localDateISO(d);
}

export function extractDate(text: string): ExtractedDate | null {
  const t = text.toLowerCase();

  // "вчера"
  if (t.includes('вчера')) {
    return { date: addDaysISO(-1), label: 'вчера', rest: text.replace(/вчера/i, '').trim() };
  }

  // "сегодня"
  if (t.includes('сегодня')) {
    return { date: localDateISO(new Date()), label: 'сегодня', rest: text.replace(/сегодня/i, '').trim() };
  }

  // "завтра"
  if (t.includes('завтра')) {
    return { date: addDaysISO(1), label: 'завтра', rest: text.replace(/завтра/i, '').trim() };
  }

  // "послезавтра"
  if (t.includes('послезавтра')) {
    return { date: addDaysISO(2), label: 'послезавтра', rest: text.replace(/послезавтра/i, '').trim() };
  }

  // "через N дней / N недель / N месяцев"
  const rel = t.match(RELATIVE_DAYS_RE);
  if (rel) {
    const n = parseInt(rel[1], 10);
    if (Number.isFinite(n) && n >= 0 && n <= 365) {
      const unit = rel[2];
      let iso: string;
      if (unit.startsWith('недел')) iso = addDaysISO(n * 7);
      else if (unit.startsWith('месяц')) iso = addMonthsISO(n);
      else iso = addDaysISO(n);
      return { date: iso, label: rel[0], rest: text.replace(new RegExp(rel[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim() };
    }
  }

  // "через неделю" (без числа) → +7 дней
  if (/через\s+недел[юяи]/i.test(t)) {
    const m = t.match(/через\s+недел[юяи]/i)!;
    return { date: addDaysISO(7), label: m[0], rest: text.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim() };
  }

  // "через месяц" (без числа) → +1 месяц
  if (/через\s+месяц/i.test(t)) {
    const m = t.match(/через\s+месяц/i)!;
    return { date: addMonthsISO(1), label: m[0], rest: text.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim() };
  }

  // "9 мая [2025]"
  const m = t.match(DATE_RE);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2]];
    const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();

    if (!month || day < 1 || day > 31) return null;

    const testDate = new Date(year, month - 1, day);
    if (isNaN(testDate.getTime()) || testDate.getMonth() !== month - 1) return null;

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const label = m[3] ? `${day} ${m[2]} ${year}` : `${day} ${m[2]}`;
    const rest = text.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
    return { date: isoDate, label, rest };
  }

  // "05.06" / "05.06.2026" / "5/6/26"
  const n = t.match(NUMERIC_DATE_RE);
  if (n) {
    const day = parseInt(n[1], 10);
    const month = parseInt(n[2], 10);
    let year = n[3] ? parseInt(n[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;

    if (day < 1 || day > 31 || month < 1 || month > 12) return null;

    const testDate = new Date(year, month - 1, day);
    if (isNaN(testDate.getTime()) || testDate.getMonth() !== month - 1) return null;

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const label = n[3]
      ? `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
      : `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
    const rest = text.replace(new RegExp(n[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ''), '').trim();
    return { date: isoDate, label, rest };
  }

  return null;
}
