# FamilyBudget · Конструктор категорий + страница «Категории» · Implementation Handoff

> Идея — переделать вкладку `/categories` из tree-view + сухой формы в **хаб со всеми текущими категориями** + понятный вход в **wizard-конструктор** для bulk-настройки. Каждую категорию можно отредактировать одним тапом (бот-шит с иконкой / цветом / бюджетом / приватностью). Wizard ведёт по 4 шагам: выбор → уточнение саб → бюджеты → готово.
>
> Дизайн-референс: `.claude/skills/familybudget-design/Category Constructor.html` — 9 артбордов:
> - **Хаб** (2 состояния: со свёрнутой и раскрытой библиотекой)
> - **Wizard** (4 шага: Категории / Уточни / Бюджет / Готово)
> - **Editor** (sheet редактирования одной категории)
> - **Альтернативы** (V1 Каталог, V2 Полки) — для сравнения, реализуем только Wizard

---

## 0. Главные правила

1. **Никаких новых цветов / иконок.** Берём из `colors_and_type.css` (warm-палитра) и `src/features/categories/icons/icons.tsx` (sticker-set, 55 SVG). Никаких эмодзи в UI — только sticker-иконки.
2. **Не ломаем модель Category.** Type `Category` (`src/shared/types/index.ts`) остаётся как есть. **Активность** категории = факт её существования в `categories/{userId}/{expense|income}/`. **Библиотека** = `TAXONOMY` минус то, что уже у юзера.
3. **Бюджеты — через существующий `budgetSlice` + `budgetService`**, а НЕ через поле на `Category`. На UI бюджет показывается в карточке категории через селектор.
4. **Mobile-first.** Десктоп — позже (на ≥ 1024px wizard остаётся в центральной колонке 480px, хаб разворачивается в 2 колонки).
5. **Не заменяем сервисы.** `categoriesService` уже умеет add/update/delete/reset — пользуемся им как есть. Wizard в конце делает diff (что добавилось, что удалилось) и зовёт сервис.

---

## 1. Стек контекст

- **Next.js 15 + TS + Tailwind + shadcn + Redux Toolkit + Firebase + next-intl + Nunito** — см. `CLAUDE.md`.
- **TAXONOMY** — `src/features/categories/icons/icons.tsx` (12 родителей × ~7 саб + INCOME_TAXONOMY). У каждого `id`, `name`, `ru`, `color`, `icon`.
- **Иконки** — `<StickerIcon icon="cart" color="#E07A5F" size={28}/>` из `src/features/categories/components/CategoryIcon.tsx`.
- **Существующие сервисы** — `addCategoryToDb`, `updateCategoryInDb`, `deleteCategoryFromDb`, `resetCategoriesToDefaults`, `fetchCategories` из `src/features/categories/services/categoriesService.ts`.

---

## 2. Дизайн-токены

Уже подключены через `globals.css` + `tokens.ts` чата. **Для конструктора используем те же значения** — см. `cc-shared.jsx` в дизайн-референсе:

```ts
// src/features/categories/styles/tokens.ts
export const CC = {
  primary: '#E07A5F', primaryDeep: '#C9684E', primaryTint: '#FAEAE2',
  sage: '#81B29A', rose: '#C97B84', caramel: '#D4A574', yellow: '#F2CC8F',
  lavender: '#A48BC9', blueSoft: '#8AA9D6', olive: '#A8B89C',

  bg: '#FBF6EE', bgSoft: '#F4ECDE', card: '#FFFFFF', cardTint: '#FEFAF3',
  fg: '#3D2C1F', sub: '#8E7A66', subLight: '#B6A48E', hairline: '#EDE0CC',
} as const;
```

| Класс | Размер/вес | Использование |
|---|---|---|
| `text-display`  | 24/900 -0.6 | «Всё готово!» на шаге 4 |
| `text-h1`       | 17/900 -0.3 | Заголовок шапки |
| `text-h2`       | 15/900 -0.2 | Название категории в карточке |
| `text-body`     | 14/800 | Имя в ряду, текст кнопок |
| `text-sub`      | 11.5/700 (sub-color) | «5 подкатегорий · ₪1,800» |
| `text-caption`  | 10.5/900 UPPER tracking .07 | Метки секций «АКТИВНЫЕ · 5» |
| `text-amount`   | 18/900 -0.4 tabular | Бюджет в editor preview |

**Радиусы.** 999 (chip / pill / switch) → 12-14 (sub-tile / input) → 16-18 (row card) → 22 (hero card) → 28 (sheet top).

**Тени.**
```ts
card:    '0 1px 2px rgba(61,44,31,.05), 0 6px 18px rgba(61,44,31,.06)';
primary: '0 6px 14px #C9684E40';
```

---

## 3. Модель данных

### 3.1 Без изменений в `Category`

Тип `Category` (см. `src/shared/types/index.ts`) уже содержит всё нужное:
`id`, `userId`, `name`, `icon`, `color`, `parentId`, `isPrivate`, `order`, `type`.

**Активная категория** = существует в Firestore у юзера.
**Категория из библиотеки** = есть в `TAXONOMY`, но НЕ в user's коллекции.

### 3.2 Бюджет — отдельная коллекция

Уже существует `src/features/budget/services/budgetService.ts` + `budgetSlice`. Дополнить (если ещё нет):

```ts
// budgets/{userId}/{categoryId}
export interface CategoryBudget {
  userId: string;
  categoryId: string;
  amount: number;          // в основной валюте юзера
  currency: Currency;
  updatedAt: Timestamp;
}
```

**На UI** в любом ряду категории бюджет берётся селектором `selectBudgetFor(categoryId)`.

### 3.3 Селекторы

```ts
// src/features/categories/store/selectors.ts
export const selectActiveParents = (s: RootState, type: CategoryType) =>
  (type === 'expense' ? s.categories.expense : s.categories.income).filter((c) => !c.parentId);

export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const tax = type === 'expense' ? TAXONOMY : [INCOME_TAXONOMY];
  const existingIds = new Set((type === 'expense' ? s.categories.expense : s.categories.income).map((c) => c.id));
  return tax.filter((p) => !existingIds.has(p.id));
};

export const selectSubsOf = (s: RootState, parentId: string, type: CategoryType) =>
  (type === 'expense' ? s.categories.expense : s.categories.income).filter((c) => c.parentId === parentId);
```

---

## 4. Структура файлов

### Создать

```
src/features/categories/
  components/
    CategoriesHub.tsx              — главная: список + вход в wizard
    CategoryRow.tsx                — ряд категории (icon + name + sub-chips + ✎)
    CategoryEditorSheet.tsx        — sheet редактирования (имя/иконка/цвет/бюджет/privacy)
    IconPickerGrid.tsx             — grid из StickerIcon-ов с табами тем
    ColorPaletteRow.tsx            — горизонтальная палитра 12 цветов
    BudgetField.tsx                — input + чипы быстрых пресетов

    constructor/
      ConstructorWizard.tsx        — родитель state-машины (4 шага)
      StepPick.tsx                 — Шаг 1: grid 3-кол родительских плиток
      StepRefine.tsx               — Шаг 2: chip-cloud саб по каждому родителю
      StepBudget.tsx               — Шаг 3: hero-карточка тотала + per-row inputs
      StepDone.tsx                 — Шаг 4: success + сводка
      WizardHeader.tsx             — stepper с прогресс-баром
      WizardFooter.tsx             — Назад / Далее / Пропустить
  styles/
    tokens.ts                      — CC constants (см. §2)
  hooks/
    useConstructorState.ts         — локальный state машины wizard
```

### Тронуть

```
src/app/(app)/categories/page.tsx           — ПЕРЕДЕЛАТЬ в <CategoriesHub />
src/features/categories/services/categoriesService.ts
                                            — добавить bulkApplyConstructorDiff()
src/features/budget/services/budgetService.ts
                                            — убедиться есть setCategoryBudget(uid, catId, amount)
src/messages/{en,ru,he}.json                — добавить categories.* + constructor.* ключи
```

### Не трогать

- `src/features/categories/components/CategoryTree.tsx`, `CategoryForm.tsx`, `CategoryPicker.tsx` — оставить, могут пригодиться в других местах (Picker всё ещё нужен в ExpenseForm).
- Типы из `shared/types/index.ts`.
- `defaultCategories.ts`, `icons.tsx`.
- Firebase init.

---

## 5. Поведение — экраны

### 5.1 `/categories` — Хаб (`CategoriesHub`)

```
┌─ Header ──────────────────────────────────┐
│ ←  Категории                          ⋯   │
│    5 активных · ₪7,400/мес               │
├───────────────────────────────────────────┤
│ [Расходы (5)]  [Доходы (2)]               │   ← segmented control
├───────────────────────────────────────────┤
│ ┌─ Конструктор card ──────────────────┐   │
│ │ 🏠 Конструктор                    → │   │   ← gradient terracotta, единственный CTA
│ │    Пошагово настроить весь набор    │   │
│ └──────────────────────────────────────┘   │
│                                            │
│  АКТИВНЫЕ · 5             [Сортировка ▾]   │
│  ┌─ row ─────────────────────────────┐    │
│  │ 🛒 Продукты              ₪1,800 ✎│    │
│  │ 5 подкатегорий · ₪1,800           │    │
│  │ [Супермаркет][Алкоголь][Химия][+2]│    │
│  └───────────────────────────────────┘    │
│   …4 more rows                            │
│                                            │
│  [В библиотеке · 7      Показать ▾]        │   ← collapsed by default
│   …on expand: 7 inactive rows (+ btn)     │
│                                            │
│  [+ Создать категорию вручную]            │   ← dashed
└───────────────────────────────────────────┘
```

**Взаимодействие:**
- **Tap на ряд активной** → открывает `CategoryEditorSheet` с предзаполненными значениями.
- **Tap на «Конструктор»** → открывает `ConstructorWizard` (full-screen overlay, шаг 1).
- **Tap на ряд из библиотеки** → одним тапом активирует (добавляет в коллекцию + субы) и пересортирует в активные.
- **Tap на «+ Создать вручную»** → открывает `CategoryEditorSheet` с пустыми значениями + промптом «название».
- **Tap на ⋯** → меню `[Сбросить к дефолту] [Экспорт CSV]`.

**Tab `Доходы`** — точно так же, но из `INCOME_TAXONOMY` (1 родитель, 8 саб). Конструктор для доходов не нужен — там вход «+ Создать категорию» вручную.

### 5.2 Конструктор-wizard (`ConstructorWizard`)

Full-screen overlay поверх хаба. State держим **внутри wizard**, в Firestore коммитим только финальный diff на шаге 4.

#### Шаг 1 · «Категории»

Grid 3-кол из 12 плиток TAXONOMY + плитка «Своя».
- Tap → toggle. Selected = цветная рамка + цветная sticker-tile + ✓ в углу.
- Пре-чекнуты пять: `groceries, dining, home, transport, shopping` (basic minimum).
- Footer: только «Дальше · N» (Назад нет на 1-м шаге). Disabled если N=0.

#### Шаг 2 · «Уточни»

Для каждой выбранной на шаге 1 категории — секция:
- Заголовок: icon-tile + имя родителя + цветной chip `5/8`.
- Chip-cloud всех её саб (по TAXONOMY). Selected = заливка + ✓ внутри.
- В конце ряда — пунктирный chip `+ Своя` (открывает мини-prompt «Имя?» → сохраняет в `subs` локально wizard'a).
- По умолчанию все sub'ы выбраны.

#### Шаг 3 · «Бюджет»

Hero-карточка terracotta с тоталом `₪{Σ}/мес` на основе current state.

Под ней — список рядов, для каждой выбранной категории:
- icon-tile + имя
- input `₪___` (правое выравнивание, tabular-nums)
- ряд chip-пресетов `₪500 / ₪1k / ₪2k / ₪5k` (выбранный = подсвечен цветом категории)

Footer: `[Назад] [Пропустить] [Готово →]`. «Пропустить» = коммитит без бюджетов.

#### Шаг 4 · «Готово»

Success-экран:
- Большая piggy-иконка в радиальном круге + 2 sparkle-декорации.
- Заголовок «Всё готово!» (display) + подзаголовок («можно начинать»).
- 3 stat-tile (категорий / подкатегорий / в месяц).
- Список итоговых родителей с бюджетом справа.
- Кнопка `Начать пользоваться` — закрывает wizard, возвращает на хаб.

**При нажатии:**
1. Сравнить wizard state с текущей коллекцией → построить diff (`toAdd: Category[]`, `toRemove: string[]`, `toUpdate: Category[]`).
2. `bulkApplyConstructorDiff(userId, diff)` — батч-запись в Firestore.
3. Для каждой категории с бюджетом — `setCategoryBudget(userId, catId, amount)`.
4. Закрыть overlay → хаб обновится через onSnapshot.

### 5.3 Editor sheet (`CategoryEditorSheet`)

Bottom sheet (или full-screen на мобильном) с заголовком «Редактирование» / «Новая категория».

```
[Live preview карточка с текущим icon/color/name/budget]

ИМЯ
[input]

ИКОНКА                                       55
[Все | Еда | Дом | Транспорт | Развл | ...]   ← tabs
[grid 6-кол sticker-иконок]

ЦВЕТ
[● ● ● ● ● ● ● ● ● ● ● ●]                    ← horizontal scroll, 12 цветов

МЕСЯЧНЫЙ БЮДЖЕТ                     опционально
[₪ ___ /мес]
[₪500] [₪1k] [₪1.5k] [₪2k] [₪3k]

[🔒 Приватная           [toggle]]
   Скрыть от семьи

[Сохранить категорию]
```

**Поведение:**
- Live preview карточка вверху обновляется при каждом изменении (animated через CSS transition).
- При создании новой через «Своя» в wizard'е — sheet возвращает категорию в wizard state, без записи в Firestore.
- При редактировании из хаба — после Save диспатчит `updateCategoryInDb`.
- Кнопка «Удалить» в шапке (если edit-mode + категория НЕ в default-set) → confirm dialog «Удалить категорию вместе с N тратами?» → soft-delete (тратам стирается categoryId или переносится в `Прочее`).

---

## 6. Состояние wizard — пример

```ts
// src/features/categories/hooks/useConstructorState.ts
interface WizardParent {
  id: string;            // = TAXONOMY id ИЛИ custom uuid
  name: string;
  icon: string;
  color: string;
  enabled: boolean;      // выбрано на шаге 1
  budget: number | null; // установлено на шаге 3
  subs: WizardSub[];
  isCustom?: boolean;    // true для созданных через «Своя»
}

interface WizardSub {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;      // выбрано на шаге 2
  isCustom?: boolean;
}

export function useConstructorState(initial: WizardParent[]) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState(initial);
  return {
    step, setStep,
    state, setState,
    toggleParent: (id) => …,
    toggleSub:    (pid, sid) => …,
    setBudget:    (id, v) => …,
    addCustomParent: (data) => …,
    addCustomSub:    (pid, data) => …,
    canNext:      step === 0 ? state.filter(p => p.enabled).length > 0
                : step === 1 ? state.filter(p => p.enabled).length > 0
                : true,
  };
}
```

---

## 7. Поведение — крайние случаи

| Сценарий | Что делать |
|---|---|
| Юзер впервые открыл `/categories` | Если коллекция пустая — сразу запускаем wizard (skip-hub). После завершения — попадает на хаб. |
| Юзер удалил категорию, на которой есть траты | Confirm dialog: `[Перенести в Прочее] [Удалить вместе с тратами] [Отмена]`. |
| Юзер пытается выйти из wizard'а в середине | На шаге 1: просто close. На шагах 2-3: `[Сохранить как черновик] [Выйти без сохранения]`. На шаге 4: applied уже коммитнулось. |
| Юзер создаёт custom категорию в wizard'е | Открывается `CategoryEditorSheet` поверх wizard'а; на Save категория добавляется в state, sheet закрывается, юзер возвращается в wizard. |
| Library пустая (юзер уже всё активировал) | Тоггл «В библиотеке» не показываем. Только «+ Создать категорию вручную». |
| Категория из TAXONOMY была активирована, потом deactivated → юзер хочет снова | Из библиотеки одним тапом активирует. Old subs **не восстанавливаются** — создаются заново из TAXONOMY (т.е. если юзер удалил пару саб ранее, они вернутся). Если это нежелательно — добавляем флаг «помнить кастомизацию» позже. |
| Бюджет в чужой валюте | `CategoryBudget.currency` всегда = текущая валюта юзера. При смене валюты — пересчёта НЕТ, цифры остаются, единица меняется (с подсказкой в шапке). |
| Drag-reorder активных в хабе | На long-press всплывает grab-handle. Обновляем `order` через `updateCategoryInDb` (batch). |
| Свайп влево на ряду в хабе | Reveal: `[Скрыть в библиотеку]` (= удалить, но subs сохранить локально на 30 дней через Firestore-флаг `deletedAt` — soft-delete). |

---

## 8. Порядок шагов

1. **Tokens + типы.** `categories/styles/tokens.ts` (см. §2). `tsc --noEmit`.
2. **Селекторы.** `categories/store/selectors.ts` (см. §3.3). Проверить, что `budgetService.setCategoryBudget()` существует — если нет, добавить.
3. **Editor sheet.** `CategoryEditorSheet.tsx` + `IconPickerGrid.tsx` + `ColorPaletteRow.tsx` + `BudgetField.tsx`. Подключить к Redux через диспатч `updateCategoryInDb`. Самотестировать через storybook-like маршрут `/dev/category-editor`.
4. **Хаб (read-only).** `CategoriesHub.tsx` + `CategoryRow.tsx`. Подключить к store. Без действий пока — только просмотр.
5. **Хаб (взаимодействие).** Tap → open Editor. Свайп влево → soft-delete с подтверждением. Long-press → reorder.
6. **Wizard оболочка.** `ConstructorWizard.tsx` + `WizardHeader.tsx` + `WizardFooter.tsx` + `useConstructorState.ts`. State-машина, навигация, без визуала шагов (placeholder экраны).
7. **Шаги 1-2.** `StepPick.tsx` + `StepRefine.tsx`. Custom-категории через editor sheet.
8. **Шаг 3.** `StepBudget.tsx` + hero-карточка тотала. Quick-presets.
9. **Шаг 4.** `StepDone.tsx` + анимация (опционально — pop-in stat-плиток через `framer-motion`).
10. **Commit.** `bulkApplyConstructorDiff` в `categoriesService`. Batch-write через `writeBatch(db)`.
11. **`/categories/page.tsx` rewrite.** Подключить `CategoriesHub`. Wizard монтировать как portal-overlay.
12. **i18n.** Все строки через `useT()`.
13. **Тесты.**
    - Unit: `useConstructorState` — toggle/budget/diff (Vitest).
    - Unit: `bulkApplyConstructorDiff` builder.
    - RTL: открытие хаба → tap на конструктор → шаг 1 → шаг 4 → проверка коммита.
14. **Lint + build.** `npm run lint && npm run build`.

---

## 9. i18n-ключи (минимум)

```json
"categories": {
  "title":               "Категории",
  "hub":                 { "summary": "{n} активных · ₪{total}/мес",
                           "active":  "Активные",
                           "library": "В библиотеке",
                           "show":    "Показать", "hide": "Скрыть",
                           "sort":    "Сортировка",
                           "createManual": "Создать категорию вручную",
                           "tabExpense":   "Расходы", "tabIncome": "Доходы" },
  "row":                 { "subs": "{n, plural, one {# подкатегория} few {# подкатегории} other {# подкатегорий}}",
                           "more": "+{n}", "inLibrary": "в библиотеке" },
  "constructor": {
    "cardTitle":         "Конструктор",
    "cardSubtitle":      "Пошагово настроить весь набор",
    "step":              "Шаг {current} из {total}",
    "next":              "Дальше", "back": "Назад", "skip": "Пропустить",
    "pick": {
      "title":           "Категории",
      "h":               "Какие траты ты отслеживаешь?",
      "sub":             "Выбери всё, что относится к тебе. Можно изменить позже.",
      "ownTile":         "Своя",
      "nextWithCount":   "Дальше · {n}",
      "nextEmpty":       "Выбери хотя бы одну"
    },
    "refine": {
      "title":           "Уточни",
      "h":               "Уточни внутри каждой",
      "sub":             "Чем больше — тем точнее статистика. Лишнее можно убрать.",
      "ownChip":         "Своя",
      "nextLabel":       "Бюджеты"
    },
    "budget": {
      "title":           "Бюджет",
      "h":               "Сколько в месяц?",
      "sub":             "Можно оставить пустым — установишь позже из чата или статистики.",
      "totalLabel":      "Общий бюджет",
      "nextLabel":       "Готово"
    },
    "done": {
      "title":           "Готово",
      "headline":        "Всё готово!",
      "sub":             "Можно начинать вести бюджет. В любой момент можно поменять категории в настройках.",
      "statCats":        "категорий",
      "statSubs":        "подкатегорий",
      "statBudget":      "в месяц",
      "cta":             "Начать пользоваться"
    }
  },
  "editor": {
    "title":             "Редактирование",
    "titleNew":          "Новая категория",
    "name":              "Название",
    "icon":              "Иконка",
    "color":             "Цвет",
    "budget":            "Месячный бюджет",
    "budgetOptional":    "опционально",
    "private":           "Приватная",
    "privateHint":       "Скрыть от семьи",
    "save":              "Сохранить категорию",
    "delete":            "Удалить",
    "confirmDelete":     "Удалить категорию вместе с {n} тратами?",
    "deleteOptions":     { "moveToOther": "Перенести в Прочее", "deleteAll": "Удалить вместе" }
  }
}
```

---

## 10. Приёмка

- [ ] `/categories` показывает `CategoriesHub` (а не tree-view).
- [ ] Шапка хаба сводит количество активных + сумму бюджетов.
- [ ] Карточка «Конструктор» открывает wizard (full-screen overlay).
- [ ] Список активных рядов: каждая с icon-tile, именем, «N подкатегорий · ₪amount», превью первых 3 саб-чипов + «+N».
- [ ] Tap на ряд → editor sheet с предзаполненными значениями. Save обновляет Firestore через `updateCategoryInDb`.
- [ ] Тоггл «В библиотеке» показывает inactive ряды (greyed-out, с круглой `+` справа). Tap = одним кликом активирует.
- [ ] Wizard работает: шаг 1 → 2 → 3 → 4 → commit. Назад / Пропустить корректно.
- [ ] Шаг 1: 3-кол grid из 12 родителей + плитка «Своя». 5 пре-чекнуты.
- [ ] Шаг 2: для каждой выбранной — chip-cloud её саб. Counter `N/Total` цветной.
- [ ] Шаг 3: hero-сумма + per-row input + quick presets. «Пропустить» = коммит без бюджетов.
- [ ] Шаг 4: piggy-hero + 3 stat-плитки + список с цифрами. «Начать пользоваться» закрывает overlay.
- [ ] Editor sheet: tabs иконок работают (Все / Еда / Дом / Транспорт / Развл / Дети / Здоровье / Прочее), live preview обновляется, кнопка цвета подсвечивается.
- [ ] Создание custom категории в wizard'е работает через editor sheet (без записи в Firestore до шага 4).
- [ ] Soft-delete через свайп влево (или Удалить в editor): траты переносятся в «Прочее» или удаляются по выбору.
- [ ] Mobile (< 1024px) и desktop (≥ 1024px) одинаково работают.
- [ ] Dark mode корректно (всё через HSL-переменные).
- [ ] RTL (Hebrew): chevron-icons зеркалятся, sheet выезжает справа.
- [ ] Lint + build чистые, 5+ unit-тестов парсера diff'а зелёные.

---

## 11. Чего не делать

- ❌ Не добавлять поля `enabled` / `budget` в `Category` тип — активность через факт существования, бюджет через `budgetSlice`.
- ❌ Не выкидывать `CategoryTree.tsx` / `CategoryForm.tsx` / `CategoryPicker.tsx` — они нужны в ExpenseForm и других местах.
- ❌ Не делать drag-handle на каждом ряду — только на long-press (избегаем шума).
- ❌ Не пытаться сохранить subs локально между активацией/деактивацией родителя — родитель де-факт = создаётся заново из TAXONOMY при следующей активации.
- ❌ Не использовать эмодзи в UI вне sticker-иконок.
- ❌ Не делать tutorial / onboarding-overlay для wizard'а — он сам по себе пошаговый.

---

## 12. Промт для запуска

> Открой `.claude/skills/familybudget-design/category-constructor-handoff/Category Constructor — Claude Code Prompt.md` — план перестройки `/categories` на хаб + 4-шаговый wizard-конструктор + editor sheet. Перед каждым шагом покажи список файлов и diff — после моего OK пиши код. **Не трогай** Firebase config, тип `Category`, `categoriesService` API (только добавляй методы). Дизайн-референс — `Category Constructor.html` (9 артбордов: 2 хаба + 4 wizard + editor + 2 альтернативы для понимания контекста). Стартуем с **Шага 1** (tokens + типы).
