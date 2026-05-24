# Chat Concept · handoff bundle

Этот архив — всё, что нужно Claude Code, чтобы реализовать чат-концепт.

## Что положить в репо

Распакуй и положи всю папку в:

```
<repo>/.claude/skills/familybudget-design/
```

(Если папки нет — создай. Это та же папка, что используется для остальной дизайн-системы.)

## Что внутри

| Файл | Что |
|---|---|
| `Chat Concept — Claude Code Prompt.md` | **Главный документ** — пошаговый план реализации. Дай его Claude Code как стартовый промпт. |
| `Chat Concept.html` | Визуальный референс — открой в браузере чтобы увидеть 4 экрана и tokens. Claude Code тоже сможет открыть. |
| `chat-app.jsx` | Готовые React-компоненты чата (header, bubbles, composer, menu). Можно переписать как `.tsx` или взять идеи. |
| `chat-screens.jsx` | Сборка экранов из компонентов — буквальный референс «как должны выглядеть» Утро / Clarify / Weekly / Menu. |
| `chat-design-tokens.jsx` | Reference-артборд токенов (палитра, типографика, радиусы, парсер cheatsheet). |
| `icons-pack.jsx` | Sticker-иконки + TAXONOMY. У тебя в проекте уже есть `src/features/categories/icons/icons.tsx` — этот файл просто для контекста дизайна. |
| `ios-frame.jsx`, `design-canvas.jsx` | Технический скаффолд для рендера дизайна. К коду продукта отношения не имеют — нужны только для просмотра `Chat Concept.html`. |

## Стартовый промпт для Claude Code

> Открой `.claude/skills/familybudget-design/Chat Concept — Claude Code Prompt.md` — это план переделки главного экрана /home в чат-интерфейс с локальным ботом-парсером (без LLM). Дизайн-референс — `Chat Concept.html` (4 экрана) + артборд «Design tokens».
>
> Перед каждым шагом покажи мне список файлов и краткий diff. После моего OK — пиши код одного шага. После каждого шага запусти `npm run lint`.
>
> Не трогай: Firebase config, типы из `shared/types`, `expensesService`, `categoriesSlice`, `savingsService`, `incomeService` — только UI и новый chat-слой поверх существующих сервисов.
>
> Стартуем с Шага 1 (tokens + типы).
