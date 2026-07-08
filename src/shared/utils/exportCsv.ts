import type {
  Category,
  CategoryFolder,
  SavingsGoal,
  SerializableExpense,
  SerializableIncome,
  SerializableRecurringPayment,
} from '@/shared/types';

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
  const header = row(['Date', 'Category', 'Store', 'Amount', 'Currency', 'Payment', 'Comment', 'Tags', 'Privacy']);
  const rows = expenses.map((e) =>
    row([
      e.date.slice(0, 10),
      categoryNames[e.categoryId] ?? e.categoryId,
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

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows: unknown[][]): string {
  const body = rows.map((cells, r) => {
    const rowNum = r + 1;
    const rowCells = cells.map((cell, c) => {
      const ref = `${columnName(c)}${rowNum}`;
      if (typeof cell === 'number') return `<c r="${ref}"><v>${Number.isFinite(cell) ? cell : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join('');
    return `<row r="${rowNum}">${rowCells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function workbookXml(sheets: { name: string }[]): string {
  const sheetTags = sheets.map((sheet, i) =>
    `<sheet name="${escapeXml(sheet.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
}

function workbookRelsXml(count: number): string {
  const rels = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function contentTypesXml(count: number): string {
  const sheets = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}</Types>`;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] { return [n & 0xff, (n >>> 8) & 0xff]; }
function u32(n: number): number[] { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

function zipStore(files: { path: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
      ...name, ...data,
    ]);
    chunks.push(local);

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name,
    ]));
    offset += local.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);
  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...chunks, ...central, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export interface BudgetExportData {
  expenses: SerializableExpense[];
  incomes: SerializableIncome[];
  recurring: SerializableRecurringPayment[];
  goals: SavingsGoal[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  expenseFolders: CategoryFolder[];
}

export function budgetExportSheets(t: (key: string) => string, data: BudgetExportData): { name: string; rows: unknown[][] }[] {
  const expenseCategoryById = new Map(data.expenseCategories.map((c) => [c.id, c]));
  const incomeCategoryById = new Map(data.incomeCategories.map((c) => [c.id, c]));
  const folderById = new Map(data.expenseFolders.map((f) => [f.id, f]));
  const categoryName = (id: string, map: Map<string, Category>) => map.get(id)?.name ?? id;
  const sectionName = (categoryId: string) => {
    const folderId = expenseCategoryById.get(categoryId)?.folderId;
    return folderId ? folderById.get(folderId)?.name ?? '' : '';
  };
  const marker = (expense: SerializableExpense) => expense.store ?? expense.tags.join('; ');

  return [
    {
      name: t('export.sheetExpenses'),
      rows: [
        [t('export.colDate'), t('export.colSection'), t('export.colCategory'), t('export.colAmount'), t('export.colStoreTag'), t('export.colComment')],
        ...data.expenses.map((e) => [
          e.date.slice(0, 10),
          sectionName(e.categoryId),
          categoryName(e.categoryId, expenseCategoryById),
          e.amount,
          marker(e),
          e.comment ?? '',
        ]),
      ],
    },
    {
      name: t('export.sheetIncome'),
      rows: [
        [t('export.colDate'), t('export.colCategory'), t('export.colAmount'), t('export.colComment')],
        ...data.incomes.map((i) => [
          i.date.slice(0, 10),
          categoryName(i.categoryId, incomeCategoryById),
          i.amount,
          i.comment ?? '',
        ]),
      ],
    },
    {
      name: t('export.sheetRecurring'),
      rows: [
        [t('export.colName'), t('export.colAmount'), t('export.colFrequency'), t('export.colNextDate')],
        ...data.recurring.map((r) => [r.name, r.amount, r.frequency, r.nextDueDate.slice(0, 10)]),
      ],
    },
    {
      name: t('export.sheetGoals'),
      rows: [
        [t('export.colGoal'), t('export.colSaved'), t('export.colGoal'), t('export.colLeft')],
        ...data.goals.map((g) => [g.name, g.currentAmount, g.targetAmount, Math.max(0, g.targetAmount - g.currentAmount)]),
      ],
    },
  ];
}

export function downloadXlsx(sheets: { name: string; rows: unknown[][] }[], filename: string): void {
  const files = [
    { path: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { path: 'xl/workbook.xml', content: workbookXml(sheets) },
    { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    ...sheets.map((sheet, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(sheet.rows) })),
  ];
  const bytes = zipStore(files);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
