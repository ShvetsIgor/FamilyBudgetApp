# Category Constructor — Handoff

Дизайн-референс + промпт для имплементации страницы «Категории» (хаб) + 4-шагового wizard-конструктора + editor sheet.

## Структура

```
category-constructor-handoff/
├── README.md                                  ← этот файл
├── Category Constructor - Claude Code Prompt.md  ← план миграции для Claude Code
├── Category Constructor.html                  ← дизайн-референс, открой в браузере
│
├── cc-shared.jsx                              ← tokens, StickerIcon, helpers
├── cc-hub.jsx                                 ← главный экран /categories
├── cc-v3-wizard.jsx                           ← 4-step wizard (основной поток)
├── cc-editor.jsx                              ← sheet редактирования одной категории
├── cc-v1-catalog.jsx                          ← альтернативный вариант (для сравнения)
├── cc-v2-shelves.jsx                          ← альтернативный вариант (для сравнения)
│
├── icons-pack.jsx                             ← 55 sticker-иконок + TAXONOMY
├── ios-frame.jsx                              ← iPhone frame (только для референса)
├── design-canvas.jsx                          ← canvas (только для референса)
└── colors_and_type.css                        ← warm-палитра + Nunito токены
```

## Что на референсе

9 артбордов в `Category Constructor.html`:

| Секция | Артборды | Что показывает |
|---|---|---|
| **Категории · хаб** | Текущий набор / С раскрытой библиотекой | Главная страница /categories |
| **Конструктор · 4 шага** | Шаг 1 · Категории, Шаг 2 · Уточни, Шаг 3 · Бюджет, Шаг 4 · Готово | Wizard end-to-end (каждый артборд интерактивен) |
| **Редактор категории** | Редактирование · Продукты | Sheet (имя / иконка / цвет / бюджет / privacy) |
| **Альтернативы** | V1 Каталог с галочками, V2 Полки | Другие подходы (для контекста, реализуем только wizard) |

## Что реализуем

→ **Хаб** (CategoriesHub) + **Wizard** (ConstructorWizard) + **Editor sheet** (CategoryEditorSheet).
**Не** реализуем альтернативы V1 / V2.

## Стартуем

См. `Category Constructor - Claude Code Prompt.md` § 8 — порядок шагов.
Промпт для Claude Code — § 12 того же документа.
