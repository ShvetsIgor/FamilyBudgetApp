export function toLocalDateKey(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toLocalMonthKey(value: Date | string): string {
  return toLocalDateKey(value).slice(0, 7);
}

/** Server callers must use the user's timezone rather than the host timezone. */
export function toZonedDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A date without a time is stored at noon in the user's timezone. */
export function zonedDateToDate(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = new Date(0);
  target.setUTCFullYear(year, month - 1, day);
  target.setUTCHours(12, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    calendar: 'gregory', numberingSystem: 'latn',
  });
  let instant = target.getTime();
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((item) => item.type === type)!.value);
    const wall = new Date(0);
    wall.setUTCFullYear(part('year'), part('month') - 1, part('day'));
    wall.setUTCHours(part('hour'), part('minute'), part('second'), 0);
    const correction = target.getTime() - wall.getTime();
    instant += correction;
    if (correction === 0) break;
  }
  const result = new Date(instant);
  if (toZonedDateKey(result, timeZone) !== dateKey) throw new Error('Invalid local expense date');
  return result;
}
