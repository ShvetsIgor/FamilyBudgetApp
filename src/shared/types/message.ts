import type { Timestamp } from 'firebase/firestore';

export type MessageStatus = 'pending' | 'saved' | 'clarifying' | 'undone' | 'failed';

export type BotCardKind = 'morning' | 'saved' | 'clarify' | 'weekly' | 'envelopes' | 'goal' | 'undone' | 'alert' | 'future';

export interface BotCard {
  kind: BotCardKind;
  data: unknown;
}

export type ParseConfidence = 'high' | 'medium' | 'low' | 'failed';

/**
 * A single candidate item extracted from input text.
 * Populated by parser keyword matching, OCR line items, or AI extraction.
 * TODO(OCR): receipt scanner populates this from line-item text
 * TODO(AI): model returns richer items with quantity, unit price, sub-category
 */
export interface ParseResultItem {
  title: string;
  amount?: number;
  categoryId?: string;
  confidence: number; // 0–1 score
  source: 'parser' | 'ocr' | 'ai';
}

export interface ParseResult {
  amount: number;
  categoryId: string | null;
  matchedKeyword?: string;
  confidence: ParseConfidence;
  /** true when the parser is confident enough for auto-save but wants user to confirm */
  needsConfirmation?: boolean;
  /**
   * Candidate items extracted from input.
   * Empty for regular single-amount messages; populated by OCR/AI multi-item flow.
   * TODO(OCR/AI): populate via extractCandidateItems stage override
   */
  items?: ParseResultItem[];
  /** true when input started with "+", meaning this is an income entry */
  isIncome?: boolean;
  /** ISO date string YYYY-MM-DD if the user specified a date in the message */
  date?: string;
  /** Human-readable date label, e.g. "9 мая" */
  dateLabel?: string;
  /** Unknown word from the message — saved as expense comment */
  note?: string;
  /** Canonical store ID from STORE_DICTIONARY */
  storeId?: string;
  /** Display name of the matched store */
  storeName?: string;
  /** Store group, e.g. 'supermarket', 'pharmacy', 'fuel' */
  storeGroup?: string;
  /** Previously learned category ID for this keyword — triggers clarify with it as top chip */
  learnedCategoryId?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderId: string;
  kind: 'user' | 'bot';

  text: string;
  parsed?: ParseResult;
  expenseId?: string;
  incomeId?: string;
  card?: BotCard;

  status: MessageStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface SerializableChatMessage {
  id: string;
  userId: string;
  senderId: string;
  kind: 'user' | 'bot';

  text: string;
  parsed?: ParseResult;
  expenseId?: string;
  incomeId?: string;
  card?: BotCard;

  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}
