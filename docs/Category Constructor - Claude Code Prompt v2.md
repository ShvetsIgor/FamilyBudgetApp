# FamilyBudget · Категории v2 — папки + плоские категории · Implementation Handoff

> Этот документ — **UI-часть** рефакторинга категорий. Контекст и архитектурные требования описаны в исходном промпте «Refactor the category architecture» (folders как организационные контейнеры, flat категории как единственная финансовая сущность, миграция parent/sub → folder/category, архив вместо хард-удаления).
>
> Дизайн-референс: `.claude/skills/familybudget-design/Category Constructor.html` — 8 артбордов:
> - **Хаб** (2 состояния — базовый вид и с раскрытым архивом)
> - **Wizard** (4 фрейма — шаг 1, шаг 2 свёрнутый, шаг 2 с открытым добавлением, шаг 3 loose-разрешение)
> - **Editor** (2 фрейма — базовый вид и с открытым folder-пикером)

---

## 0. Главные правила (нерушимые)

1. **Папка — только UI.** Никакой связи с экспенсами, статистикой, парсером. Переименование/удаление папки **никогда** не ломает существующие транзакции.
2. **Категория — единственная финансовая сущность.** `categoryId` стабильный, переименование name/icon/color/folderId не задевает старые записи.
3. **Нет parent/sub.** Старые subcategoryId в expense'ах при миграции становятся categoryId. Старые parentId стираются.
4. **Архив вместо удаления.** Если категория использована в expense/income/recurring/savings — нельзя удалить, только архивировать (`archived: true`), категория исчезает из выбора, но в статистике остаётся.
5. **Mobile-first.** Десктоп опционально на ≥ 1024px (хаб разворачивается в 2 колонки).
6. **Нет новых цветов / иконок.** Только `colors_and_type.css` (warm-палитра) + 55 sticker-иконок из `src/features/categories/icons/icons.tsx`.

---

## 1. Дизайн-токены

Используем уже существующий чат-токен-сет (`src/features/chat/styles/tokens.ts` → `C`, `SHADOW`, `RAD`). Если он там не доступен, повторить в `src/features/categories/styles/tokens.ts`:

```ts
export const CC = {
  primary: '#E07A5F', primaryDeep: '#C9684E', primaryTint: '#FAEAE2',
  sage: '#81B29A', rose: '#C97B84', caramel: '#D4A574', yellow: '#F2CC8F',
  lavender: '#A48BC9', blueSoft: '#8AA9D6', olive: '#A8B89C',

  bg: '#FBF6EE', bgSoft: '#F4ECDE', card: '#FFFFFF', cardTint: '#FEFAF3',
  fg: '#3D2C1F', sub: '#8E7A66', subLight: '#B6A48E', hairline: '#EDE0CC',
} as const;
```

Шкала радиусов: `999` (chip) → `12–14` (input/sub-tile) → `16–18` (row card) → `22` (hero) → `28` (sheet).
Шрифт: **Nunito** 400/700/800/900, `tabular-nums` на всех суммах.

---

## 2. Модель данных (UI-слой)

Опирается на типы из refactor-плана:

```ts
// src/shared/types/index.ts
interface CategoryFolder {
  id: string;
  userId: string;
  name: string;
  icon: string;        // ОБЯЗАТЕЛЬНО, не optional (UI всегда показывает)
  color: string;       // ОБЯЗАТЕЛЬНО
  type: 'expense' | 'income';
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;          // дефолт = color родительской папки, но переопределяемо
  folderId: string | null; // null = «Без папки» / loose
  isPrivate: boolean;
  order: number;
  type: 'expense' | 'income';
  archived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

### Селекторы (обязательны)

```ts
// src/features/categories/store/selectors.ts
selectFoldersByType(state, type)                  // упорядочено по order
selectCategoriesByFolder(state, folderId, type)   // !archived, упорядочено
selectLooseCategories(state, type)                // folderId == null && !archived
selectArchivedCategories(state, type)             // archived === true
selectCategoryById(state, id)                     // включая archived
selectCategoryDisplayName(state, id)              // для UI: «Архив · {name}» если archived
```

### Бюджет — отдельно

Бюджет хранится в `budgets/{userId}/{categoryId}` через `budgetService`, **не** в `Category`. На UI берётся селектором `selectBudgetFor(catId)`.

---

## 3. Структура файлов

### Создать

```
src/features/categories/
  components/
    CategoriesHub.tsx                   — главная страница /categories
    FolderSection.tsx                   — раскрываемая секция папки (icon + cats + add)
    LooseSection.tsx                    — секция «Без папки»
    ArchiveSection.tsx                  — свёрнутая секция архива
    CategoryRow.tsx                     — flat-ряд категории внутри секции
    CategoryEditorSheet.tsx             — sheet редактирования категории
    FolderEditorSheet.tsx               — sheet редактирования папки
    IconPickerGrid.tsx                  — общий picker иконок (tabs + grid 6×N)
    ColorPaletteRow.tsx                 — палитра 12 цветов horizontal scroll
    BudgetField.tsx                     — input + quick-presets
    FolderPickerInline.tsx              — раскрывающийся picker папки в editor

    constructor/
      ConstructorWizard.tsx             — оркестратор 3-х шагов
      WizardHeader.tsx                  — stepper progress
      WizardFooter.tsx                  — Назад / Далее
      StepFolders.tsx                   — Шаг 1: grid папок
      StepCategories.tsx                — Шаг 2: папки с chip-rows
      StepLoose.tsx                     — Шаг 3: loose resolution (показ только если loose > 0)
      DoneScreen.tsx                    — success после Шага 2 если loose=0 ИЛИ после Шага 3
      AddCategoryPanel.tsx              — inline panel с предложениями для «+ Добавить»

  hooks/
    useConstructorState.ts              — wizard state machine
    useCategoryUsage.ts                 — проверка «есть ли траты у категории» (для архива vs удаления)

  styles/
    tokens.ts
```

### Тронуть

```
src/app/(app)/categories/page.tsx        — ПЕРЕДЕЛАТЬ в <CategoriesHub />
src/features/categories/services/categoriesService.ts
                                         — добавить applyConstructorDiff()
                                         — добавить archiveCategory() / restoreCategory()
src/features/categories/services/folderService.ts   — НОВЫЙ
                                         — addFolder / updateFolder / deleteFolder / fetchFolders
src/features/categories/store/categoriesSlice.ts
                                         — добавить state.folders + reducers
src/features/budget/services/budgetService.ts
                                         — убедиться есть setCategoryBudget()
src/messages/{en,ru,he}.json             — добавить categories.hub.* / categories.wizard.* / categories.editor.* / categories.folder.*
```

### Не трогать

- `CategoryTree.tsx`, `CategoryForm.tsx` — старые компоненты можно удалить только после полного перехода. Пока **оставить** и не использовать в новом UI.
- `CategoryPicker.tsx` — переделать под flat-модель (используется в `ExpenseForm`, `FastExpenseEntry`, `IncomeForm`). См. § 8.

---

## 4. Поведение — экраны

### 4.1 Хаб (`CategoriesHub`)

```
┌─ Header ────────────────────────────────────┐
│  ←   Категории                          ⋯   │
│      32 категории · ₪7,400/мес              │
├─────────────────────────────────────────────┤
│  [Расходы (32)]    [Доходы (8)]             │   segmented control
├─────────────────────────────────────────────┤
│  ┌─ Конструктор папок ──────────────────┐   │
│  │ 🗂  Конструктор папок              →  │   │   gradient terracotta, ОДИН CTA
│  │     Папки, категории и бюджеты        │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  🛒  Продукты                       ✎  ⌄    │   ← folder header (tap = collapse)
│   4 · ₪1,800/мес                             │
│  ┌────────────────────────────────────┐     │
│  │ 🍰 Супермаркет     ₪1,200   →      │     │   ← flat category rows
│  │ 🍷 Алкоголь        ₪200     →      │     │
│  │ 🧴 Бытовая химия   ₪150     →      │     │
│  │ 🧹 Хоз. товары     ₪250     →      │     │
│  │ + Добавить категорию               │     │
│  └────────────────────────────────────┘     │
│                                              │
│  …other folder sections (Home, Transport…)  │
│                                              │
│  ─  Без папки                                │
│   2 категории                                │
│  ┌────────────────────────────────────┐     │
│  │ ☕ Кофе у работы   ₪180     →      │     │
│  │ 🐶 Питомец         ₪250     →      │     │
│  └────────────────────────────────────┘     │
│                                              │
│  [□ Создать папку]   [+ Категорию]          │   двойная пунктирная кнопка
│                                              │
│  [Архив · 1                       Показать ⌄│   collapsed by default
│   …on expand: archived rows + Восстановить] │
└─────────────────────────────────────────────┘
```

**Взаимодействия:**

| Действие | Эффект |
|---|---|
| Tap на header папки | Свернуть/раскрыть содержимое секции |
| Tap на ✎ рядом с папкой | Открыть `FolderEditorSheet` для этой папки |
| Tap на ряд категории | Открыть `CategoryEditorSheet` для этой категории |
| Tap на «+ Добавить категорию» внутри папки | Открыть `CategoryEditorSheet` с предзаполненным `folderId` |
| Tap на «Создать папку» | Открыть `FolderEditorSheet` для новой папки |
| Tap на «+ Категорию» (нижняя кнопка) | Открыть `CategoryEditorSheet` без папки (`folderId = null`) |
| Tap на «Архив · N» | Развернуть свёрнутую секцию архива |
| Tap на «Восстановить» в архивной строке | Поставить `archived: false`. Если у категории нет папки — спросить куда (диалог) |
| Tap на «Конструктор папок» card | Открыть `ConstructorWizard` (full-screen overlay) |
| Long-press на ряд категории | Reveal drag-handle для reorder внутри папки. На отпускании — `updateCategoryInDb({order})` |
| Long-press на header папки | Reveal drag-handle для reorder папок |
| Swipe влево на ряд категории | Reveal `[Архив]` или `[Удалить]` (delete только если usage=0) |
| Swipe влево на ряд loose | Reveal `[→ В папку…]` + `[Архив]` |

**Tab `Доходы`** — та же логика, своя коллекция папок + категорий с `type: 'income'`. Конструктор подходит тоже (он type-aware).

### 4.2 Конструктор-wizard

Full-screen overlay поверх хаба. Внутреннее состояние держим **в `useConstructorState`** до финального коммита.

#### Шаг 1 · «Папки» (`StepFolders`)

3-кол grid из 12 заготовок TAXONOMY + плитка «Своя».

- Tap = toggle папки. Selected = цветная рамка + tinted-tile + ✓ в углу.
- 5 пре-чекнуты: `groceries, home, transport, health, shopping`.
- Long-press / 2-й tap на already-selected → открывает `FolderEditorSheet` для редактирования имени/иконки/цвета.
- Tap «Своя» → открывает `FolderEditorSheet` с пустыми полями.
- Footer: только «Дальше · N». Disabled при N=0.

**Сноска под grid'ом:** «Папки можно переименовать, переместить или удалить позже — категории внутри не пострадают.»

#### Шаг 2 · «Категории» (`StepCategories`)

Для каждой выбранной на шаге 1 папки — секция:

- Header: tinted icon-tile + имя + цветной счёт-chip + ✎.
- Chip-row: каждая категория — chip с иконкой + именем + × (удалить из state).
  - Tap на тело chip → `CategoryEditorSheet` для конкретной категории (предзаполнено).
  - Tap на × → удалить из state (без подтверждения; ничего не записано в Firestore ещё).
- В конце row — пунктирный chip «+ Добавить». Tap → раскрывает `AddCategoryPanel` под этой секцией.

**`AddCategoryPanel` устройство:**
```
┌─ Добавить в «Продукты» ──────────────────┐
│ [✨ Своя категория]                       │   ← кнопка-чип ярким акцентом
│                                            │
│ ПОД ЭТОЙ ПАПКОЙ                            │   ← если есть подходящие из TAXONOMY
│ [🥡 Готовая еда +] [📦 Доставка +]         │
│                                            │
│ ИЗ ДРУГИХ ПАПОК                            │
│ [☕ Кофе] [🍕 Фастфуд] [🍦 Снеки] [+N ещё] │   ← остатки TAXONOMY не использованные
└───────────────────────────────────────────┘
```

- «Своя категория» → открывает `CategoryEditorSheet` в режиме `create` с предзаполненным `folderId = текущей папки`. После Save — возвращается в wizard, категория появляется в chip-row.
- «Под этой папкой» — подкатегории TAXONOMY того же id (например, для папки `groceries` — это `supermarket, alcohol, household_chem, home_essentials, gro_other`). Tap = добавить в state.
- «Из других папок» — все остальные TAXONOMY subs (не использованные нигде). Показываем 6, остальные через «+N ещё» → разворачивает full list.

В конце экрана — секция **«Без папки»**:
```
─  Без папки
[☕ Кофе у работы ×] [🐶 Питомец ×] [+ Добавить]
```

«+ Добавить» здесь работает так же, но без same-folder секции — только `[Своя]` + универсальный список.

#### Шаг 3 · «Без папки» (`StepLoose`) — условный

**Показывается только если в state есть loose-категории (folderId == null).** Если loose=0 — wizard сразу переходит в `DoneScreen`.

Для каждой loose-категории — ряд:
```
┌─ icon-tile · «Кофе у работы» ─────────────┐
│  Останется без папки                       │   ← подпись = текущий выбор
│                                       [Куда?▾]│
└────────────────────────────────────────────┘
```

При тапе на «Куда?» раскрывается inline-меню:

```
○ Оставить без папки                  [✓]
─────────────────────────────────────────
🛒 В «Продукты»
🏠 В «Дом»
🚌 В «Транспорт»
…enabled folders…
─────────────────────────────────────────
📦 Архивировать         (сохранить статистику)
🗑 Удалить              (только если нет старых трат)
```

- «Удалить» disabled если у категории есть expense'ы (показать tooltip «Архивируйте — есть {n} трат»).
- Footer: «Готово».

#### `DoneScreen` (после шага 2 если loose=0 или после шага 3)

Piggy hero + «Всё готово!» + краткая статистика:
- N папок
- M категорий
- ₪K в месяц (сумма всех бюджетов)

Кнопка «Начать пользоваться» → коммит diff в Firestore → закрытие overlay → возврат на хаб.

**Коммит (`applyConstructorDiff`):**
```ts
async function applyConstructorDiff(userId, oldState, newState) {
  const batch = writeBatch(db);

  // 1. Папки
  newState.folders.forEach((f) => {
    const old = oldState.folders.find((x) => x.id === f.id);
    if (!old)                       batch.set(folderRef(userId, f.id), f);
    else if (!shallowEq(old, f))    batch.update(folderRef(userId, f.id), f);
  });
  oldState.folders.forEach((f) => {
    if (!newState.folders.find((x) => x.id === f.id))
      batch.delete(folderRef(userId, f.id));
  });

  // 2. Категории (то же)
  // ...

  // 3. Бюджеты (отдельная коллекция)
  for (const c of newState.categories) {
    if (c.budget != null) await setCategoryBudget(userId, c.id, c.budget);
  }

  await batch.commit();
}
```

### 4.3 Editor-sheet (`CategoryEditorSheet`)

Bottom sheet (или full-screen на мобильном).

```
[Header: ← Редактирование · Супермаркет     [📦 Архив]]

[─ Live preview card ────────────────────┐
│ 🛒 (big icon)   Супермаркет             │
│                 [🛒 Продукты]           │   ← folder pill
│                 ₪1,200 /мес             │
└────────────────────────────────────────┘]

НАЗВАНИЕ
[Супермаркет          ]

ПАПКА
[🛒 Продукты                          ⌄ ]   ← tap toggles inline picker
   ─ on expand ─
   [📁 Без папки           ●]               ← + check if currently selected
   [🛒 Продукты            ●]
   [🏠 Дом                  ]
   …enabled folders…
   [+ Новая папка]                          ← dashed, opens FolderEditorSheet

ИКОНКА                                   55
[Все | Еда | Дом | Транспорт | …]        ← scrollable tabs
[grid 6 cols × N rows of sticker icons]

ЦВЕТ
[● ● ● ● ● ● ● ● ● ● ● ●]                ← 12 цветов

МЕСЯЧНЫЙ БЮДЖЕТ                опционально
[₪ ___________  /мес]
[₪500] [₪1k] [₪1.5k] [₪2k] [₪3k]         ← quick presets

[🔒 Приватная           [toggle]]
   Скрыть от семьи

[Сохранить]                              ← coloured by current `color`
```

**Поведение:**
- Live preview обновляется в реальном времени.
- При смене папки — `color` автоматически меняется на цвет новой папки (если юзер не успел руками сменить); если юзер потом меняет color — он становится sticky.
- В create-режиме (новая категория) шапка — «Новая категория», нет кнопки «Архив».
- «Архив» в шапке → confirm dialog. После архива — обратно на хаб.

### 4.4 Folder-editor sheet (`FolderEditorSheet`)

Меньший аналог:
```
[Header: ← Папка · Продукты        [Удалить]]

[Live preview card]

ИМЯ        [Продукты]
ИКОНКА     [grid из 55]
ЦВЕТ       [palette]

[Сохранить]
```

**Удаление папки:**
1. Если в папке нет категорий → сразу удалить.
2. Если есть → confirm dialog:
   ```
   В папке «Продукты» 4 категории.
   [   Сделать «Без папки»   ]
   [   Переместить в…  →     ]
   [   Отмена                ]
   ```
   - «Сделать без папки» — `categories.forEach({folderId: null})` + delete folder.
   - «Переместить в…» — открывает folder-picker, потом перемещает.

---

## 5. Поведение — крайние случаи

| Сценарий | Что делать |
|---|---|
| Юзер впервые открыл `/categories` | Если коллекция категорий пустая → сразу запустить wizard. После Done — попадает на хаб. |
| Юзер удалил категорию с тратами | Запрет на hard-delete. Кнопка «Удалить» скрыта/disabled в editor, остаётся только «Архив». Tooltip объясняет почему. |
| Юзер удалил папку | См. § 4.4 — выбирает destination. Категории не удаляются никогда. |
| Юзер архивировал, потом восстановил | `archived: false`, появляется обратно. Если `folderId` указывает на уже несуществующую папку → автоматически становится loose. |
| Юзер пытается выйти из wizard в середине | Шаг 1: close без подтверждения (ничего не записано). Шаги 2-3: confirm dialog «Выйти без сохранения?». На Done — commit. |
| Юзер создаёт свою папку через «+ Своя» | Sheet поверх wizard'a. На Save — добавляется в state шага 1. После закрытия sheet — возвращается в grid. |
| Создание custom категории в шаге 2 | Аналогично — sheet поверх wizard'a, на Save категория добавляется в state с folderId текущей папки. |
| Категория с budget=null | Показывать имя без «/мес» строки. Не учитывать в total. |
| Drag-reorder | Long-press → reveal grab-handle → drag. На drop — записать `order` всем затронутым через `writeBatch`. |
| Перенос категории между папками через editor | `updateCategoryInDb({folderId})`. **НЕ ТРОГАТЬ EXPENSES** — это и есть главное архитектурное правило. |
| Income tab | Папок для income обычно одна-две (Salary / Other). UI тот же. Конструктор предлагает только income TAXONOMY. |

---

## 6. Порядок шагов

1. **Tokens + типы.** `categories/styles/tokens.ts`, обновить `shared/types/index.ts` под новый `Category` и `CategoryFolder`. Запустить `tsc --noEmit`.
2. **Селекторы + slice.** Расширить `categoriesSlice` чтобы хранить `folders: Folder[]` + `categories: Category[]` отдельно (не parents/children). Добавить селекторы из § 2.
3. **Services.** `folderService.ts` с add/update/delete/fetch. Расширить `categoriesService.ts` (`archiveCategory`, `restoreCategory`, `applyConstructorDiff`).
4. **Migration.** См. § 7. **Запускается один раз** при первом открытии новой версии у каждого юзера, после успеха ставит flag `users/{uid}.flags.migratedV2 = true`.
5. **Editor sheets.** `CategoryEditorSheet` + `FolderEditorSheet` + общие `IconPickerGrid` / `ColorPaletteRow` / `BudgetField` / `FolderPickerInline`. Тестировать через temp route `/dev/category-editor`.
6. **Хаб (read-only).** `CategoriesHub` + `FolderSection` + `LooseSection` + `ArchiveSection` + `CategoryRow`. Только просмотр.
7. **Хаб (взаимодействие).** Tap на ряд → editor. Tap на «Конструктор» → wizard. Swipe влево → quick actions. Long-press → reorder.
8. **Wizard каркас.** `ConstructorWizard` + `useConstructorState` + `WizardHeader` + `WizardFooter`. State машина, навигация со skip-логикой для шага 3.
9. **Шаг 1.** `StepFolders` + edit через `FolderEditorSheet`.
10. **Шаг 2.** `StepCategories` + `AddCategoryPanel` + edit chip через `CategoryEditorSheet`.
11. **Шаг 3 + DoneScreen.** `StepLoose` + `DoneScreen`. Логика skip если loose=0.
12. **Коммит.** `applyConstructorDiff` через `writeBatch`. После успеха — закрытие overlay, refresh state из Firestore через onSnapshot.
13. **Переделать `/categories/page.tsx`.** Заменить tree-view на `<CategoriesHub />`. Wizard монтировать как portal-overlay.
14. **Обновить парсер.** Возвращать только `categoryId` (см. refactor-плана). Удалить любые `parentId`/`subId` из `ParseResult`. Обновить `dictionary.ts`, `itemDictionary.ts`, `storeDictionary.ts` под flat IDs.
15. **Обновить `CategoryPicker.tsx`.** В `ExpenseForm`, `FastExpenseEntry`, `IncomeForm` — теперь picker показывает flat-список категорий, опционально сгруппированных по folder header'ам. Возвращает `categoryId` (не parentId+subId).
16. **i18n.** Все строки через `useT()`.
17. **Тесты:**
    - Unit: `useConstructorState` — toggle/add/remove/diff.
    - Unit: `applyConstructorDiff` — построение write-batch'ей.
    - Unit: миграция (старое expense с subcategoryId → новый categoryId).
    - RTL: хаб → wizard → шаг 1→2→3 → коммит, проверка что folders + categories в Firestore.
    - RTL: rename папки не задевает linked expense'ы.
18. **`npm run lint && npm run build`.**

---

## 7. Миграция (один раз на юзера)

```ts
async function migrateToFolderModel(userId: string) {
  // 1. Прочитать старые категории
  const oldCats = await fetchOldCategories(userId);
  const oldParents = oldCats.filter((c) => !c.parentId);
  const oldSubs    = oldCats.filter((c) =>  c.parentId);

  // 2. Сгенерировать папки из родителей
  const folders: CategoryFolder[] = oldParents.map((p) => ({
    id: p.id, userId, name: p.name, icon: p.icon, color: p.color,
    type: p.type, order: p.order,
  }));

  // 3. Сгенерировать flat-категории из субов
  //    Родители без субов тоже становятся отдельной категорией (loose) — иначе теряются.
  const newCats: Category[] = oldSubs.map((s) => ({
    id: s.id, userId, name: s.name, icon: s.icon, color: s.color,
    folderId: s.parentId!, isPrivate: s.isPrivate, order: s.order,
    type: s.type, archived: false,
  }));
  const parentsWithNoSubs = oldParents.filter((p) =>
    !oldSubs.find((s) => s.parentId === p.id));
  for (const p of parentsWithNoSubs) {
    newCats.push({
      id: p.id + '_cat', userId, name: p.name, icon: p.icon, color: p.color,
      folderId: p.id, isPrivate: p.isPrivate, order: 0, type: p.type, archived: false,
    });
  }

  // 4. Записать всё через writeBatch
  const batch = writeBatch(db);
  folders.forEach((f) => batch.set(folderRef(userId, f.id), f));
  newCats.forEach((c) => batch.set(categoryRef(userId, c.id), c));
  await batch.commit();

  // 5. Мигрировать существующие expense'ы
  const expenses = await fetchAllExpenses(userId);
  const batch2 = writeBatch(db);
  for (const e of expenses) {
    const newCategoryId =
      e.subcategoryId ? e.subcategoryId :
      e.categoryId    ? (newCats.find((c) => c.id === e.categoryId + '_cat')?.id ?? e.categoryId) :
      null;
    if (newCategoryId && newCategoryId !== e.categoryId) {
      batch2.update(expenseRef(userId, e.id), { categoryId: newCategoryId, subcategoryId: null });
    }
  }
  await batch2.commit();

  // 6. То же для income, recurring, savings, splits
  // ...

  // 7. Удалить старые parent-категории
  const batch3 = writeBatch(db);
  oldParents.forEach((p) => batch3.delete(oldCategoryRef(userId, p.id)));
  await batch3.commit();

  // 8. Flag
  await updateUserFlags(userId, { migratedV2: true });
}
```

**Защита от двойного запуска:** проверять `users/{uid}.flags.migratedV2` перед миграцией.

**Если миграция упала на полпути:** оставить flag в `migratedV2: 'in_progress'`, при следующем заходе показать «попробуйте перезагрузить страницу» (Firestore tx гарантия не нужна — структурно безопасно повторять).

---

## 8. Обновление `CategoryPicker.tsx`

Сейчас picker строит дерево parent→sub. Новый picker:

```
┌─ Header: Выбери категорию ─────────────┐
│ [search input]                          │
├────────────────────────────────────────┤
│  🛒 Продукты                            │  ← collapsed folder header (tap to expand)
│  🏠 Дом                                 │
│     🏘 Аренда                           │  ← if expanded, flat rows nested
│     ⚡ Электричество                    │
│     💧 Вода                             │
│  🚌 Транспорт                           │
│  ─ Без папки                            │
│     ☕ Кофе у работы                    │
│     🐶 Питомец                          │
└────────────────────────────────────────┘
```

- Все папки свёрнуты по умолчанию (показываются только заголовки).
- Tap на header — разворачивает.
- Если активен search — все папки развёрнуты, не подходящие категории скрыты.
- Loose-секция всегда видна.
- Возвращает один `categoryId`. Никаких `parentId` / `subId` в return.

---

## 9. i18n-ключи (минимум)

```json
"categories": {
  "title":               "Категории",
  "summary":             "{n, plural, one {# категория} few {# категории} other {# категорий}} · ₪{total}/мес",
  "tabExpense":          "Расходы",
  "tabIncome":           "Доходы",

  "hub": {
    "constructorCard":         "Конструктор папок",
    "constructorCardSubtitle": "Папки, категории и бюджеты — пошагово",
    "noFolder":                "Без папки",
    "addCategory":             "Добавить категорию",
    "createFolder":            "Создать папку",
    "addCategoryShort":        "Категорию",
    "archive":                 "Архив",
    "show": "Показать", "hide": "Скрыть",
    "restore":                 "Восстановить",
    "txCount":                 "{n, plural, one {# трата} few {# траты} other {# трат}}"
  },

  "wizard": {
    "step":         "Шаг {current} из {total}",
    "next":         "Дальше", "back": "Назад",

    "folders":      { "title": "Папки", "h": "Какие папки?",
                       "sub":   "Папки — это просто способ сгруппировать категории. На статистику не влияют.",
                       "own":   "Своя",
                       "tip":   "Папки можно переименовать, переместить или удалить позже — категории внутри не пострадают.",
                       "nextWith": "Дальше · {n}", "nextEmpty": "Выбери папку" },

    "categories":   { "title": "Категории", "h": "Категории в папках",
                       "sub":   "Можно добавить готовые, создать свои или редактировать.",
                       "addBtn":         "Добавить",
                       "addPanelTitle":  "Добавить в «{folder}»",
                       "ownCategory":    "Своя категория",
                       "sameFolder":     "Под этой папкой",
                       "otherFolders":   "Из других папок",
                       "more":           "+{n} ещё",
                       "noFolderSection": "Без папки" },

    "loose":        { "title": "Без папки",
                       "h": "Куда эти {n, plural, one {# категория} few {# категории} other {# категорий}}?",
                       "sub": "Без папки тоже норм — папки только для удобства.",
                       "tip": "Архив скрывает категорию из выбора, но старые траты остаются нетронутыми и видны в статистике.",
                       "where": "Куда?",
                       "keepLoose":   "Оставить без папки",
                       "moveTo":      "В «{folder}»",
                       "archive":     "Архивировать",
                       "archiveHint": "сохранить статистику, скрыть из выбора",
                       "delete":      "Удалить",
                       "deleteHint":  "безопасно только если нет старых трат" },

    "done": {
      "headline": "Всё готово!",
      "sub":      "{folders} {fold, plural, one {папка} few {папки} other {папок}} · {cats} {c, plural, one {категория} few {категории} other {категорий}}",
      "cta":      "Начать пользоваться"
    }
  },

  "editor": {
    "title":      "Редактирование",
    "titleNew":   "Новая категория",
    "name":       "Название",
    "folder":     "Папка",
    "folderNone": "Без папки",
    "newFolder":  "Новая папка",
    "icon":       "Иконка",
    "color":      "Цвет",
    "budget":     "Месячный бюджет",
    "budgetOpt":  "опционально",
    "private":    "Приватная",
    "privateHint": "Скрыть от семьи",
    "save":       "Сохранить",
    "archive":    "Архив",
    "archiveConfirm": "Архивировать «{name}»? Категория исчезнет из выбора. Старые траты останутся.",
    "delete":     "Удалить",
    "deleteBlocked": "Архивируйте — есть {n, plural, one {# трата} few {# траты} other {# трат}}"
  },

  "folder": {
    "title":      "Папка",
    "titleNew":   "Новая папка",
    "name":       "Имя",
    "icon":       "Иконка",
    "color":      "Цвет",
    "delete":     "Удалить",
    "deleteWithCats": "В папке «{name}» {n, plural, one {# категория} few {# категории} other {# категорий}}. Что с ними делать?",
    "moveToLoose": "Сделать без папки",
    "moveTo":      "Переместить в…",
    "cancel":      "Отмена"
  }
}
```

---

## 10. Приёмка

- [ ] `/categories` показывает `CategoriesHub` (а не tree-view). Tree-view удалён или disabled через feature-flag.
- [ ] Хаб показывает: верхняя сводка, tabs, card «Конструктор папок», секции папок с их категориями, секцию «Без папки» (если есть loose), кнопки «Создать папку» + «Категорию», свёрнутую секцию «Архив» (если есть).
- [ ] Tap по header папки сворачивает/раскрывает её. State сохраняется в localStorage (опционально).
- [ ] Tap на ✎ рядом с папкой открывает `FolderEditorSheet`. Tap на ряд категории → `CategoryEditorSheet`.
- [ ] Tap на «Конструктор» открывает wizard. 3 шага, прогресс-полоса корректная.
- [ ] Wizard шаг 1: 3-кол grid из 12 заготовок + плитка «Своя». 5 пре-чекнуты.
- [ ] Wizard шаг 2: каждая выбранная папка показывает chip-row своих категорий + «+ Добавить». Tap × удаляет из state.
- [ ] «+ Добавить» раскрывает inline-panel с «Своя категория» + suggestion-chips «Под этой папкой» и «Из других папок».
- [ ] Wizard шаг 3 показывается только если есть loose. Каждая loose-категория имеет «Куда?» меню с опциями: оставить / в папку / архив / удалить.
- [ ] Done screen + «Начать пользоваться» коммитит diff через `writeBatch` (1 батч на категории, 1 на бюджеты).
- [ ] Editor sheet — folder picker раскрывается inline, показывает «Без папки» + список папок + «+ Новая папка». Смена папки автоматически меняет color (sticky если юзер потом руками меняет).
- [ ] Editor: «Архив» в шапке. Если у категории есть expenses — кнопка «Удалить» в Folder editor disabled с tooltip.
- [ ] Folder editor delete с категориями внутри показывает confirm dialog с опциями «Без папки» / «Переместить в…» / «Отмена».
- [ ] Архив expandable в хабе. Tap «Восстановить» возвращает категорию (если её папка удалена — становится loose).
- [ ] Парсер `ParseResult` возвращает только `categoryId` (нет `parentId`/`subId`).
- [ ] `CategoryPicker` в `ExpenseForm` / `FastExpenseEntry` / `IncomeForm` показывает flat-список с folder-заголовками + loose-секция.
- [ ] Миграция запускается один раз, ставит `flags.migratedV2 = true`, мигрирует expenses (`subcategoryId → categoryId`), income, recurring, savings, splits, learnedKeywords, storeProfiles, monthlyStats.
- [ ] **CRITICAL:** rename папки **не** меняет `categoryId` у категорий. Move категории в другую папку **не** меняет старые expense'ы. Unit-тест это проверяет.
- [ ] Lint + build чистые. Unit-тесты `useConstructorState`, миграции, парсера, селекторов зелёные. RTL-тест полного wizard flow зелёный.

---

## 11. Чего не делать

- ❌ Не оставлять `subcategoryId` в новых write-операциях. Только в read-fallback для legacy-записей до миграции.
- ❌ Не вводить иерархию `folderId → parentFolderId`. Папки flat.
- ❌ Не делать аналитику по `folderId`. Только по `categoryId`. Группировка по папке — только в UI-слое.
- ❌ Не делать hard-delete категорий с usage > 0. Только архив.
- ❌ Не выкидывать `Category.color` — категория может иметь свой цвет, отличный от папки.
- ❌ Не использовать эмодзи в UI вне sticker-иконок.
- ❌ Не делать поле «бюджет» прямо в `Category`. Только в `budgets/{uid}/{categoryId}`.
- ❌ Не запускать миграцию более одного раза — проверять flag.

---

## 12. Промт для запуска

> Открой `.claude/skills/familybudget-design/category-constructor-handoff/Category Constructor — Claude Code Prompt v2.md` — план перестройки `/categories` под новую архитектуру: папки (только UI) + плоские категории + миграция parent/sub → folder/category + 3-шаговый wizard-конструктор + editor sheet с folder picker. Перед каждым шагом покажи список файлов и diff — после моего OK пиши код. **Не трогай** Firebase config напрямую (только через сервисы), не запускай миграцию без проверки flag, не делай hard-delete категорий с usage. Дизайн-референс — `Category Constructor.html` (8 артбордов: 2 хаба + 4 wizard + 2 editor). Стартуем с **Шага 1** (tokens + типы + миграция-flag в `users.flags`).
