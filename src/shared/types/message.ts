import type { Timestamp } from 'firebase/firestore';

export type MessageStatus = 'pending' | 'saved' | 'clarifying' | 'undone' | 'failed';

export type BotCardKind = 'morning' | 'saved' | 'clarify' | 'weekly' | 'envelopes' | 'goal' | 'undone' | 'alert' | 'future';

export interface BotCard {
  kind: BotCardKind;
  data: unknown;
}

export interface ParseResult {
  amount: number;
  categoryId: string | null;
  parentId: string | null;
  matchedKeyword?: string;
  confidence: 'high' | 'medium' | 'low' | 'failed';
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
  learnedParentId?: string;
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
