# Desktop Chat · Handoff

Архив для внедрения V1 Classic Messenger поверх существующего десктоп-шелла FamilyBudgetApp.

## Содержимое

- **`Desktop Chat - Claude Code Prompt.md`** — главный документ. Открываешь Claude Code в репо `FamilyBudgetApp`, скармливаешь этот файл, дальше по чеклисту §13.
- **`Desktop Chat Concept.html`** — интерактивный canvas с 13 артбордами (3 layout варианта · 2 сцены · 4 состояния V1 · 4 правые панели). Tweaks: density / dark / ширина чата / правая панель.
- **JSX компоненты** — все шурупы для канваса. Их **не нужно копировать в репо** — это reference, не production-код. В репо переписываем под Tailwind + shadcn (см. промпт).

## Как развернуть

1. Положи всю папку в репо как `.claude/skills/familybudget-design/desktop-chat/` (или куда удобно).
2. Открой `Desktop Chat Concept.html` в браузере — посмотреть как должно выглядеть.
3. Claude Code: `Прочитай Desktop Chat - Claude Code Prompt.md и начни реализовывать чеклист по порядку`.

## Что НЕ в архиве (доступно в репо)

- Мобильные чат-компоненты `src/features/chat/**` — уже внедрены.
- Парсер + dictionary — уже работает (см. `Chat Concept - Claude Code Prompt.md` §4).
- Иконки `src/features/categories/icons/icons.tsx` — уже подключены.

В этом handoff'е речь только про **десктоп-обёртку поверх существующего чата** — мы не трогаем парсер, не трогаем mobile-вёрстку, не трогаем модель данных.
