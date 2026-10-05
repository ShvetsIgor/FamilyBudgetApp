import type { Language } from '@/shared/types';

/** Shared wording for AI clients. A proposed name is never a category ID or a write. */
export function missingCategoryMessage(language: Language, suggestedName?: string | null): string {
  if (language === 'ru') {
    const detail = suggestedName ? `Подходящая категория: «${suggestedName}». ` : '';
    return `Расход не сохранён: не найдена подходящая активная категория. ${detail}Откройте «Категории» в приложении, добавьте или активируйте нужную категорию, затем повторите диктовку. Либо назовите существующую категорию.`;
  }
  const detail = suggestedName ? `Suggested category: “${suggestedName}”. ` : '';
  return `Expense not saved: no suitable active category was found. ${detail}Open Categories in the app, add or activate a suitable category, then dictate again. Or name an existing category.`;
}
