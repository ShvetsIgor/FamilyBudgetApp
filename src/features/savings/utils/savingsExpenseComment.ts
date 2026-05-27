export function buildSavingsExpenseComment(
  prefix: string,
  goalName: string,
  note?: string,
): string {
  const base = `${prefix}: ${goalName}`;
  return note ? `${base} · ${note}` : base;
}

export function localizeSavingsExpenseComment(
  comment: string,
  prefix: string,
): string {
  if (!comment) return comment;
  if (comment.startsWith('Savings: ')) {
    return `${prefix}: ${comment.slice('Savings: '.length)}`;
  }
  return comment;
}
