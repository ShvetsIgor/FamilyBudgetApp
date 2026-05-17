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

export function extractDate(text: string): ExtractedDate | null {
  const t = text.toLowerCase();

  // "вчера"
  if (t.includes('вчера')) {
    const d = new Date(Date.now() - 86_400_000);
    const iso = localDateISO(d);
    return { date: iso, label: 'вчера', rest: text.replace(/вчера/i, '').trim() };
  }

  // "сегодня"
  if (t.includes('сегодня')) {
    const iso = localDateISO(new Date());
    return { date: iso, label: 'сегодня', rest: text.replace(/сегодня/i, '').trim() };
  }

  // "9 мая [2025]"
  const m = t.match(DATE_RE);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2]];
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();

  if (!month || day < 1 || day > 31) return null;

  // Validate day/month combination
  const testDate = new Date(year, month - 1, day);
  if (isNaN(testDate.getTime()) || testDate.getMonth() !== month - 1) return null;

  // Format directly to avoid UTC offset shifting the date
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const label = m[3] ? `${day} ${m[2]} ${year}` : `${day} ${m[2]}`;

  // Remove the matched date from the original text (case-insensitive)
  const rest = text.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();

  return { date: isoDate, label, rest };
}
