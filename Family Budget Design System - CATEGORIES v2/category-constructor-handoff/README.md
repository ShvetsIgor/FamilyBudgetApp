# Category Constructor v2 — Handoff

Дизайн-референс + промпт для имплементации новой модели категорий: **папки** (организационные контейнеры) + **плоские категории** (единственная финансовая сущность) + миграция parent/sub → folder/category.

## Структура

```
category-constructor-handoff/
├── README.md                                           ← этот файл
├── Category Constructor - Claude Code Prompt v2.md     ← план миграции для Claude Code
├── Category Constructor.html                           ← дизайн-референс, открой в браузере
│
├── cc-shared.jsx                                       ← tokens, StickerIcon, sample data, helpers
├── cc-hub.jsx                                          ← главный экран /categories
├── cc-v3-wizard.jsx                                    ← 3-step wizard
├── cc-editor.jsx                                       ← sheet редактирования категории (с folder picker)
│
├── icons-pack.jsx                                      ← 55 sticker-иконок + TAXONOMY (для референса)
├── ios-frame.jsx                                       ← iPhone frame (только для референса)
├── design-canvas.jsx                                   ← canvas (только для референса)
└── colors_and_type.css                                 ← warm-палитра + Nunito токены
```

## Что на референсе

8 артбордов в `Category Constructor.html`:

| Секция | Артборды | Что показывает |
|---|---|---|
| **Категории · хаб** | Базовый вид, С раскрытым архивом | Главная страница `/categories` — папки как секции, flat категории внутри, loose, архив |
| **Конструктор · 3 шага** | Шаг 1 (Папки), Шаг 2 (Категории), Шаг 2 с открытым «+ Добавить», Шаг 3 (Loose-разрешение) | Wizard end-to-end. Каждый артборд интерактивен. |
| **Редактор категории** | Базовый вид, Папка-пикер открыт | Sheet с inline folder picker + архив (вместо хард-удаления) |

## Ключевые архитектурные принципы

1. **Папка — только UI.** Не влияет на статистику. Переименование/удаление не задевает транзакции.
2. **Категория — единственная финансовая сущность.** `categoryId` стабилен. Поля name/icon/color/folderId меняются свободно.
3. **Нет parent/sub.** Старые subcategoryId мигрируют в новые categoryId. Старые parentId исчезают.
4. **Архив вместо удаления** для использованных категорий.
5. **Бюджет — отдельная коллекция**, не поле `Category`.

## Стартуем

См. `Category Constructor - Claude Code Prompt v2.md` § 6 — порядок шагов (миграция → editor → хаб → wizard → парсер → picker → тесты).
Промпт для Claude Code — § 12.
