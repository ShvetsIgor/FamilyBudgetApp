import type { Timestamp } from 'firebase/firestore';
import type { Currency } from './index';

/**
 * `saving`: the user chose a category and the expense write is in flight.
 * `failed`: the write threw, so whether money was recorded is unknown until
 * the retry (same operation id, never a duplicate) or the receipt check says.
 */
export type MessageStatus = 'pending' | 'saving' | 'saved' | 'clarifying' | 'undone' | 'failed';

/** The category a chat expense was being saved under — enough to retry it exactly. */
export interface ChatSaveAttempt {
  categoryId: string;
  startedAt: string;
}

export type BotCardKind = 'morning' | 'saved' | 'clarify' | 'weekly' | 'envelopes' | 'goal' | 'undone' | 'alert' | 'future' | 'starter' | 'receipt';

export interface BotCard {
  kind: BotCardKind;
  data: unknown;
}

/**
 * First-expense setup: the user wrote an expense before having any category.
 * `pendingText` is the original message, finished after setup without
 * retyping; `resolved` is persisted so the card never offers setup twice.
 */
export interface StarterCardData {
  pendingText: string;
  userMsgId: string;
  /** The server found no category although this device had some (archived elsewhere). */
  fromServer?: boolean;
  /**
   * Local YYYY-MM-DD the user wrote the message. Sent as the parse reference
   * date when the message is finished later, so «yesterday» keeps its meaning.
   * Absent on cards created before the field existed.
   */
  writtenOn?: string;
  resolved?: { count: number };
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
  /** Exact supermarket + amount input; rank category choices from merchant history. */
  merchantOnly?: boolean;
  amount: number;
  /** Recognized currency, pinned through confirmation even if settings change. */
  currency?: Currency;
  categoryId: string | null;
  matchedKeyword?: string;
  confidence: ParseConfidence;
  /** true when the parser is confident enough for auto-save but wants user to confirm */
  needsConfirmation?: boolean;
  /** Set only after an explicit category choice in the clarification UI. */
  confirmed?: boolean;
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
  saveAttempt?: ChatSaveAttempt;
  /** One purchase split out of a list message («хлеб 12, кофе 18»): the list's id */
  derivedFrom?: string;
  /** A receipt photo was sent. The photo itself is never stored, so it cannot be re-parsed. */
  receipt?: boolean;

  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}
