export interface QuickAddParsed {
  amount?: number;
  merchant?: string;
}

/**
 * Parses a free-text quick-add string into merchant + amount.
 *
 * Strategy: find the last numeric token — that's the amount.
 * All other tokens (before and after) form the merchant string.
 *
 * Examples:
 *   "Dabbah 350"      → { merchant: "Dabbah", amount: 350 }
 *   "Coffee 18.50"    → { merchant: "Coffee", amount: 18.5 }
 *   "350"             → { amount: 350 }
 *   "Bus 7 morning"   → { merchant: "Bus morning", amount: 7 }
 *   "Groceries"       → { merchant: "Groceries" }
 */
export function parseQuickAdd(input: string): QuickAddParsed {
  const raw = input.trim();
  if (!raw) return {};

  const tokens = raw.split(/\s+/);

  let amountIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d+([.,]\d+)?$/.test(tokens[i])) {
      amountIdx = i;
      break;
    }
  }

  if (amountIdx === -1) {
    return { merchant: raw };
  }

  const amount = parseFloat(tokens[amountIdx].replace(',', '.'));
  const merchantTokens = [
    ...tokens.slice(0, amountIdx),
    ...tokens.slice(amountIdx + 1),
  ].filter(Boolean);

  return {
    amount: isNaN(amount) ? undefined : amount,
    merchant: merchantTokens.length > 0 ? merchantTokens.join(' ') : undefined,
  };
}
