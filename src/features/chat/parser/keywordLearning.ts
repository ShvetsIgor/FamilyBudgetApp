import type { KeywordHit } from './dictionary';

/**
 * Words the user teaches the chat by choosing a category: «шмулик 50» filed
 * under «Няня» means the next «шмулик 70» offers «Няня» first. A learned word
 * only ever RANKS the choice — saving still needs the user's tap.
 *
 * What is learned is the part of the message that is neither money nor time:
 * amounts, currencies, date words and small connecting words are stripped,
 * and at most two words remain. Anything longer is a sentence, not a word
 * worth remembering, and is not learned.
 */

const MAX_WORDS = 2;
const MAX_LENGTH = 40;

const NOISE = new Set([
  // currencies
  'ils', 'nis', 'usd', 'cad', 'rub', 'шек', 'шекель', 'шекеля', 'шекелей', 'шекелях', 'доллар', 'доллара', 'долларов',
  'бакс', 'бакса', 'баксов', 'рубль', 'рубля', 'рублей', 'руб', 'р', 'dollar', 'dollars', 'shekel', 'shekels', 'buck', 'bucks',
  // time
  'сегодня', 'вчера', 'позавчера', 'утром', 'днём', 'днем', 'вечером', 'ночью', 'today', 'yesterday', 'tonight', 'morning', 'evening',
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  // connecting words
  'на', 'в', 'во', 'за', 'для', 'из', 'с', 'со', 'у', 'к', 'по', 'и', 'от', 'при', 'about', 'at', 'for', 'in', 'on', 'of', 'to', 'the', 'a', 'an', 'and', 'from',
  // counting words
  'тысяча', 'тысячи', 'тысяч', 'тыс', 'k', 'к',
]);

/** Lowercased letters-and-spaces form used both to store and to match words. */
export function normalizeKeywordText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    // Anything that is not a letter separates words: digits, ₪ $ €, punctuation
    .replace(/[^\p{L}]+/gu, ' ')
    .trim();
}

/** The meaningful words of a message — what is stored, and what is searched. */
function meaningfulWords(text: string): string[] {
  return normalizeKeywordText(text).split(' ').filter((word) => word && !NOISE.has(word));
}

export function extractLearnableKeyword(text: string): string | null {
  const words = meaningfulWords(text);
  if (words.length === 0 || words.length > MAX_WORDS) return null;
  const keyword = words.join(' ');
  return keyword.length >= 2 && keyword.length <= MAX_LENGTH ? keyword : null;
}

/** The longest learned word or phrase that occurs in the text as whole words. */
export function matchLearnedKeyword(
  text: string,
  learned: Record<string, KeywordHit>,
): (KeywordHit & { keyword: string }) | null {
  // Same stripping as when learning, so «кофе на вокзале» finds «кофе вокзале»
  const haystack = ` ${meaningfulWords(text).join(' ')} `;
  let best: (KeywordHit & { keyword: string }) | null = null;
  for (const [stored, hit] of Object.entries(learned)) {
    const keyword = meaningfulWords(stored).join(' ');
    if (!keyword || !haystack.includes(` ${keyword} `)) continue;
    if (!best || keyword.length > best.keyword.length) best = { ...hit, keyword };
  }
  return best;
}
