import { makeT } from '@/shared/utils/makeT';

export function unknownPhrase(language: string = 'ru'): string {
  return makeT(language)('chat.bot.unknown');
}
