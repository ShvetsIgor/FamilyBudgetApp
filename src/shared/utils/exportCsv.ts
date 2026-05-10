import type { SerializableExpense, SerializableIncome } from '@/shared/types';

function escapeCsv(val: unknown): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: unknown[]): string {
  return cells.map(escapeCsv).join(',');
}

export function expensesToCsv(expenses: SerializableExpense[], categoryNames: Record<string, string>): string {
  const header = row(['Date', 'Category', 'Subcategory', 'Store', 'Amount', 'Currency', 'Payment', 'Comment', 'Tags', 'Privacy']);
  const rows = expenses.map((e) =>
    row([
      e.date.slice(0, 10),
      categoryNames[e.categoryId] ?? e.categoryId,
      e.subcategoryId ? (categoryNames[e.subcategoryId] ?? e.subcategoryId) : '',
      e.store ?? '',
      e.amount,
      e.currency,
      e.paymentMethod,
      e.comment ?? '',
      e.tags.join('; '),
      e.privacy,
    ])
  );
  return [header, ...rows].join('\n');
}

export function incomeTocsv(incomes: SerializableIncome[], categoryNames: Record<string, string>): string {
  const header = row(['Date', 'Category', 'Amount', 'Currency', 'Method', 'Comment', 'Privacy']);
  const rows = incomes.map((i) =>
    row([
      i.date.slice(0, 10),
      categoryNames[i.categoryId] ?? i.categoryId,
      i.amount,
      i.currency,
      i.method,
      i.comment ?? '',
      i.privacy,
    ])
  );
  return [header, ...rows].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const bom = '\uFEFF'; // UTF-8 BOM — нужен для корректного открытия в Excel
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
