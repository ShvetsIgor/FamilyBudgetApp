# FamilyBudget Desktop Chat (V1 · Classic Messenger) · Implementation Handoff

> Десктоп-версия чат-first FamilyBudget. Мобильный чат уже внедрён (`src/features/chat/**`) — теперь надо поверх существующего десктоп-шелла (`AppShell` + `Sidebar` + `TopBar`) поставить **V1 Classic Messenger**: трёхколонник `Sidebar + Chat + RightPanel`, ширина чата ~720px, правая панель ~340px со стэком виджетов.
>
> Дизайн-референс: `.claude/skills/familybudget-design/Desktop Chat Concept.html` — 5 артбордов (3 layout-варианта + section overlay + bills focus), 4 состояния V1 (clarify / weekly recap / empty / Cmd+K search), и 4 варианта правой панели (A/B/C приоритеты + D collapsed).

---

## 0. Главные правила

1. **Не плодим вторую реальность.** Используем уже существующие чат-компоненты из `src/features/chat/**` — `ChatScreen`, `BotBubble`, `UserBubble`, `SavedCard`, `ClarifyCard`, `Composer`, парсер, dictionary. Десктоп — это **новый layout-обёртка**, не новый чат.
2. **Маршрутизация.** На `lg:` (≥1024px) `/home` рендерит десктопный чат-шелл; на мобайле остаётся существующий `ChatScreen` под `AppShell`. Все остальные разделы (`/expenses`, `/statistics`, `/savings`, `/recurring`, `/categories`, `/account`) живут как **sheet-overlay поверх чата**, открываются из левого сайдбара. Адресная строка меняется (`/savings`), но рендерится sheet — не отдельная страница (Next App Router parallel routes / intercepted routes).
3. **Активная вкладка сайдбара = «Чат».** Все запросы на «Транзакции/Аналитика/Категории» открывают sheet, оставляя чат на заднем плане в `position: relative` контейнере.
4. **Никаких новых хранилищ данных.** RightPanel читает уже существующие селекторы (`expensesSlice`, `recurringSlice`, `savingsSlice`, `categoriesSlice`).
5. **Mobile-first остаётся mobile-first.** Десктоп — это `hidden lg:flex` поверх. Не ломаем мобильную ветку.

---

## 1. Где разместить

```
src/
  shared/components/
    AppShell.tsx                 — уже есть. Меняем десктоп-ветку (см. §3).
    Sidebar.tsx                  — уже есть. Корректируем активный пункт (см. §4).
  features/
    chat/
      desktop/
        DesktopChatLayout.tsx    ← НОВОЕ — 3-col обёртка
        DesktopChatHeader.tsx    ← НОВОЕ
        RightPanel.tsx           ← НОВОЕ — стэк виджетов
        widgets/
          RPToday.tsx
          RPEnvelopes.tsx
          RPGoals.tsx
          RPBills.tsx
          RPRecent.tsx
        SectionSheet.tsx         ← НОВОЕ — обёртка для overlay-разделов
        CommandPalette.tsx       ← НОВОЕ — Cmd+K поиск
        usePinnedToday.ts        ← НОВОЕ — селектор для today balance
        usePanelPriority.ts      ← НОВОЕ — какие виджеты и в каком порядке
```

---

## 2. Тонкая адаптация AppShell

```tsx
// src/shared/components/AppShell.tsx
'use client';

import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { UpdateBanner } from './UpdateBanner';
import { AddDrawer } from '@/features/quickadd/components/AddDrawer';
import { DesktopChatLayout } from '@/features/chat/desktop/DesktopChatLayout';
import { usePathname } from 'next/navigation';

const SHEET_ROUTES = ['/expenses', '/statistics', '/analytics', '/categories', '/savings', '/recurring', '/account'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === '/home';
  const sheetSection = SHEET_ROUTES.find((r) => pathname === r || pathname.startsWith(r + '/'));

  return (
    <>
      {/* Mobile (≤lg) — без изменений */}
      <div className="flex min-h-screen flex-col lg:hidden">
        <UpdateBanner />
        <Header />
        <main className="flex-1 pb-28">{children}</main>
        <BottomNav />
      </div>

      {/* Desktop (≥lg) */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <Sidebar />
        <div className="relative flex flex-1 overflow-hidden">
          {/* Layer 1 — постоянный чат-холст */}
          <DesktopChatLayout />

          {/* Layer 2 — sheet поверх чата для не-чат маршрутов */}
          {sheetSection && (
            <div className="absolute inset-0 z-20 p-6">
              <div className="h-full rounded-3xl bg-card shadow-2xl border border-border overflow-hidden">
                {children}
              </div>
            </div>
          )}
        </div>
        <AddDrawer />
      </div>
    </>
  );
}
```

**Важно:** мы перестаём рендерить `{children}` как первичный контент на десктопе для `/home`. Чат-маршрут на десктопе показывает `<DesktopChatLayout/>`, а `{children}` остаётся либо пустым (на `/home`), либо рендерится поверх как sheet. `TopBar` убираем — его заголовок/CTA уезжают в `DesktopChatHeader`.

---

## 3. DesktopChatLayout

```tsx
// src/features/chat/desktop/DesktopChatLayout.tsx
'use client';

import { ChatThread } from '@/features/chat/components/ChatThread';      // переиспользовать существующий
import { Composer } from '@/features/chat/components/Composer';
import { DesktopChatHeader } from './DesktopChatHeader';
import { RightPanel } from './RightPanel';
import { useAppSelector } from '@/store/store';

export function DesktopChatLayout() {
  const rightPanelOpen = useAppSelector((s) => s.ui.desktopRightPanelOpen ?? true);

  return (
    <div className="flex flex-1 bg-background min-w-0">
      {/* Center — chat column */}
      <div className="flex flex-1 flex-col min-w-0">
        <DesktopChatHeader />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-6">
            <ChatThread />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[720px] px-6 pb-6 pt-2">
          <Composer variant="desktop" />
        </div>
      </div>

      {/* Right panel */}
      {rightPanelOpen && (
        <aside className="w-[340px] flex-shrink-0 border-l border-border bg-muted/30 overflow-y-auto p-4 flex flex-col gap-3.5">
          <RightPanel />
        </aside>
      )}
    </div>
  );
}
```

Composer уже существует — добавь ему prop `variant?: 'mobile' | 'desktop'`. На desktop:
- скруглённая прямоугольная капсула вместо «таблетки»
- бордер 1.5px, focus-state — `ring-4 ring-primary/20`
- enter-hint справа: `↵` в маленьком pill
- send-кнопка справа квадратная 46×46 с радиусом 14

---

## 4. Sidebar — активный пункт + поведение

В `Sidebar.tsx` уже есть `NAV_SECTIONS`. Меняем семантику:

```tsx
const NAV_SECTIONS = [
  {
    labelKey: 'sidebar.budget',
    items: [
      // ⬇ был /home + LayoutDashboard — теперь "Чат"
      { href: '/home',      icon: MessageCircle, labelKey: 'nav.chat' },
      { href: '/expenses',  icon: List,          labelKey: 'nav.transactions' },
      { href: '/statistics',icon: BarChart2,     labelKey: 'nav.statistics' },
      { href: '/categories',icon: Tag,           labelKey: 'nav.categories' },
    ],
  },
  {
    labelKey: 'sidebar.planning',
    items: [
      { href: '/savings',   icon: PiggyBank,     labelKey: 'nav.savings' },
      { href: '/recurring', icon: Repeat2,       labelKey: 'nav.recurring' },
    ],
  },
  {
    labelKey: 'sidebar.family',
    items: [
      { href: '/account',   icon: Settings,      labelKey: 'nav.settings' },
    ],
  },
];
```

i18n-ключи добавить:
```json
// src/messages/ru.json
"nav.chat": "Чат",
"sidebar.budget": "бюджет",
"sidebar.planning": "планирование",
"sidebar.family": "система"
```

Активный пункт подсвечивается с `bg-primary text-primary-foreground` (уже так). На клике по любому не-чат пункту — обычный `Link href=...`, AppShell сам монтирует sheet.

---

## 5. RightPanel — виджеты и приоритеты

```tsx
// src/features/chat/desktop/RightPanel.tsx
'use client';

import { RPToday } from './widgets/RPToday';
import { RPEnvelopes } from './widgets/RPEnvelopes';
import { RPGoals } from './widgets/RPGoals';
import { RPBills } from './widgets/RPBills';
import { RPRecent } from './widgets/RPRecent';
import { usePanelPriority } from './usePanelPriority';

const REGISTRY = {
  today:     RPToday,
  envelopes: RPEnvelopes,
  goals:     RPGoals,
  bills:     RPBills,
  recent:    RPRecent,
};

export function RightPanel() {
  const order = usePanelPriority(); // returns ['today','envelopes','bills','goals',…]
  return (
    <>
      {order.map((key) => {
        const W = REGISTRY[key];
        return W ? <W key={key} /> : null;
      })}
    </>
  );
}
```

`usePanelPriority()` — простой селектор Redux/Firestore, читает user-preference. Дефолты по контексту (см. артборды A/B/C):

| Профиль                | Порядок                                       |
|------------------------|-----------------------------------------------|
| **A — Budget-first** (def) | `today → envelopes → goals → bills`       |
| **B — Activity-first**   | `today → recent → bills → envelopes`         |
| **C — Goals-first**      | `today → goals → bills`                      |

Хранится в `users/{uid}.preferences.rightPanelOrder: string[]`. Drag-reorder появится в Phase 2.

### Widget — общий контракт

Все виджеты идут в одной обёртке `<RPCard title action accent>`:
- `title` — ALLCAPS, 10/800, tracking .06em, цвет `muted-foreground`
- `accent` — 2px цветной бордер снизу `title`-строки
- `action` — link-кнопка `"всё →"` справа в шапке
- внутри `<div>` с разделителями `border-t border-border` между строками

Размеры/отступы — см. `desktop-chat-shell.jsx` в дизайн-референсе, функция `RPCard`.

### Хук `usePinnedToday`

```ts
// src/features/chat/desktop/usePinnedToday.ts
export function usePinnedToday() {
  const expenses = useAppSelector(selectTodayExpenses);
  const dayBudget = useAppSelector(selectDailyBudget);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  return {
    spent,
    total: dayBudget,
    left:  dayBudget - spent,
    pct:   Math.min(100, (spent / dayBudget) * 100),
    weekday: new Date().toLocaleDateString('ru', { weekday: 'short' }),
  };
}
```

`selectDailyBudget` — `(monthBudget - upcomingBillsThisMonth) / daysLeftInMonth`. Если бюджет не задан — виджет показывает только spent + кнопку «Задать бюджет на месяц».

---

## 6. Заголовок чата

```tsx
// src/features/chat/desktop/DesktopChatHeader.tsx
export function DesktopChatHeader() {
  const t = useT();
  const familyMembers = useAppSelector(selectFamilyMembers);

  return (
    <div className="h-16 px-6 flex items-center gap-3.5 border-b border-border bg-background flex-shrink-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
           style={{ background: 'radial-gradient(circle at 30% 30%, #FAEAE2, #E07A5F33)' }}>
        <StickerIcon icon="piggy" color="#E07A5F" size={30}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-foreground leading-tight">
          {familyMembers.length > 1 ? t('chat.familyTitle') : t('chat.title')}
        </p>
        <p className="text-[11.5px] font-bold text-success">
          ● {t('chat.onlineLocal', { count: familyMembers.length })}
        </p>
      </div>
      {/* Search, notifications, more */}
      <button onClick={openCommandPalette} className="w-9 h-9 rounded-lg hover:bg-muted text-muted-foreground …">
        <Search className="h-4.5 w-4.5"/>
      </button>
      …
    </div>
  );
}
```

i18n:
```json
"chat.title":        "Личный чат",
"chat.familyTitle":  "Семейный чат",
"chat.onlineLocal":  "{count} участника · бот считает локально"
```

---

## 7. Состояния (см. артборды V1 · Key states)

### 7.1 Empty — first time
`ChatThread` уже умеет рендерить empty-state. На десктопе: центрированный hero-tile (560×авто) с приветствием, примерной bubble «хлеб 12 → ₪12 → Продукты», и 5 quick-chips (`хлеб 12`, `65 кофе`, `sonol 200`, `аптека 45`, `такси 60`). RightPanel в этом состоянии заменяет привычный набор на:
- `RPCard "ПЕРВЫЕ ШАГИ"` — чек-лист (зарегистрировался ✓ / задай бюджет / пригласи семью / первая запись)
- `RPCard "ШПАРГАЛКА · КАК ПИСАТЬ"` — 5 example → output строк

Реализация: `ChatThread` определяет `messages.length === 0`, RightPanel смотрит на тот же селектор и подменяет `usePanelPriority()` на `['firstSteps','cheatSheet']`.

### 7.2 Clarify
Уже реализовано в мобиле через `ClarifyCard.tsx`. На десктопе:
- сетка чипов **3 колонки** вместо мобильных 5 в ряд (см. `StateClarify` в референсе)
- каждый чип — 34×34 sticker-icon + название + подсказка-хинт
- ниже: кнопка «Все 12 категорий» (поиск) + «＋ новая категория» + правая надпись «подскажешь — запомню это слово навсегда»

В RightPanel — заменяет первую карточку на `RPCard "БОТ УЧИТСЯ"` с динамическим счётчиком известных слов и облаком последних 10 запомненных. Дёргается через `selectLearnedKeywordsCount` + `selectLastLearnedWords(10)`.

### 7.3 Weekly recap
Срабатывает в воскресенье 21:00 — `recurring/hooks/useWeeklyRecap.ts` уже должен такое уметь. Bot-карточка `kind: 'weekly'` рендерится максимально широкой (560px вместо 480px). Структура:
- **Hero** — градиент `primary → rose`, тулзовая «Сэкономил ₪360 — переведём в Отпуск?» pill
- **Envelopes** — компактный список с `<Envelope/>` (тот же, что уже есть)
- **Stats strip** — 4 метрики: лучший день / тяжёлый день / чаще всего / семья
- **QuickReplies**: `[Отложить ₪360 (primary)] [Поделиться 👨‍👩‍👦] [Полный отчёт →]`
- Следом дополнительный bot-bubble: «План на следующую неделю прежний? Или поправим конверт Кафе — перебран на ₪5» + три chip-ответа

RightPanel в этот вечер переключается на `['goals','bills']` — today не релевантен, неделя закрыта.

### 7.4 Cmd+K search
Новый компонент `CommandPalette.tsx`. Открывается:
- по ⌘K / Ctrl+K
- по клику на иконку search в `DesktopChatHeader`

Структура:
- Top input — большой 17px текст, autofocus, ESC справа
- Filter chips — `Все · 12 / Траты · 8 / Конверты · 1 / Команды · 3 / этот месяц`
- Results — секционированный список: `транзакции / конверты и переходы`, выделение совпадений жёлтым (`bg-warning/60`)
- Active row — `bg-primary/10` + 3px primary-полоса слева
- Footer — `⌘K вызов · ↑↓ выбор · ↵ открыть · ESC закрыть` + «искать локально · без сети»

Поиск идёт по уже индексированным данным в Redux:
- `expensesSlice.entities` (по `note`, `categoryId`)
- `categoriesSlice` (для конвертов и переходов)
- статический список «команд» (`/баланс`, `/неделя`, `/конверты`)

Никаких внешних вызовов.

---

## 8. SectionSheet — раздел поверх чата

`SectionSheet.tsx` — обёртка, в которую заворачивается любая существующая страница (`/savings`, `/expenses`, etc) когда она рендерится поверх чата:

```tsx
<SectionSheet
  title="Конверты на неделю"
  subtitle="Неделя 20 · 13–19 мая · потратили 83% плана"
  iconSlot={<EnvelopeIcon/>}
  primaryAction={{ label: 'Новый конверт', icon: 'plus', onClick: … }}
  onBack={() => router.push('/home')}
>
  {/* существующий контент страницы — Tree, Grid, etc */}
</SectionSheet>
```

Sheet:
- занимает всё свободное пространство между Sidebar и (опционально) RightPanel
- `inset-6` отступ, `rounded-3xl`, `shadow-2xl`, белый/`card` фон
- header — sticky, h-auto, padding 16×22, иконка-плашка 44×44, заголовок 20/900 + subtitle 12/700
- слева кнопка `← вернуться в чат` (`router.push('/home')`)
- справа `primaryAction`

Чат под sheet **dimmed** — это естественно через `opacity-50 saturate-50` на DesktopChatLayout, но проще — оставить чат как есть, и пусть sheet перекрывает. Дим — опциональная стилистика.

---

## 9. Collapsed RightPanel (вариант D)

Когда `window.innerWidth < 1280` или юзер сам свернул панель (`ui.desktopRightPanelOpen = false`) — рендерим узкий 96px icon-rail вместо 340px панели:

```tsx
{rightPanelOpen ? <RightPanel/> : <CollapsedRail/>}
```

`CollapsedRail`:
- 64×64 today-tile вверху (gradient + сумма + бэдж %)
- 5 кнопок 56×56 (конверты с бейджем 5 / копилки с «+» / счета с «!» / неделя 83% / операций 12)
- стрелка `‹` снизу — раскрыть обратно

Тулзовая логика — `<aside style={{ width: open ? 340 : 96 }}>` с CSS-transition 200ms.

---

## 10. Композитор — небольшие отличия от мобайл

```tsx
<Composer variant="desktop">
```

Различия:
- max-width = 720px (центрируется в чат-колонке)
- border-radius = 14 (вместо pill 22)
- кнопка «+» (вложения / категория) — квадратная 42×42 слева, не круглая
- хинт `↵` в маленьком pill справа от input
- send-кнопка — 46×46, скруглённая 14
- `Enter` отправляет, `Shift+Enter` — перенос строки (на мобиле Enter = перенос)
- `↑` в пустом инпуте — редактировать последнее своё сообщение

Парсер вызывается **на onChange с debounce 300ms** для inline-preview: если уже понятно «65 кофе → Кафе», показываем под композером тонкую подсказку:
```
₪65 → Кафе · Кофе · ↵ записать
```
(опционально — Phase 2)

---

## 11. Тёмная тема (Phase 2)

В дизайн-референсе тёмная тема — это «warm-dim»:
- page bg `#231811`
- sidebar bg `#1A110A`
- right-panel bg `#231811`
- bubbles остаются светлыми (как iMessage on dark)

В коде это уже частично возможно: `ThemeProvider` применяет `class="dark"` на `<html>`. Существующие CSS-переменные в `globals.css` определены для `[data-theme="dark"]` — допили warm-brown палитру:

```css
[data-theme="dark"] {
  --background: 26 38% 7%;       /* #231811 */
  --background-sidebar: 26 50% 5%;
  --background-rightpanel: 26 38% 7%;
  --card: 0 0% 100%;              /* bubbles stay white */
  --border: 26 30% 18%;
  --foreground: 36 60% 95%;
  /* primary/sage остаются как есть */
}
```

---

## 12. Тесты

- `__tests__/chat.desktopLayout.test.tsx` — рендер `<DesktopChatLayout/>` при `lg:` matchMedia, проверка наличия 3 колонок
- `__tests__/chat.panelPriority.test.ts` — `usePanelPriority` возвращает правильный массив для каждого профиля A/B/C и для empty-state
- `__tests__/chat.commandPalette.test.tsx` — открытие по ⌘K, выделение совпадений, активная строка по ↑↓, открытие по ↵
- `__tests__/chat.sectionSheet.test.tsx` — sheet рендерится поверх чата на `/expenses`, `← вернуться в чат` возвращает на `/home`

---

## 13. Чеклист реализации

- [ ] Создать `src/features/chat/desktop/` с структурой из §1
- [ ] Адаптировать `AppShell.tsx` (§2) — sheet-роутинг
- [ ] Реализовать `DesktopChatLayout` (§3) — 3-col + composer центрирован
- [ ] Поправить `Sidebar.tsx` (§4) — пункт «Чат», i18n
- [ ] 5 widget-компонентов в `widgets/` + `RPCard` обёртка (§5)
- [ ] `usePinnedToday`, `usePanelPriority`
- [ ] `DesktopChatHeader` (§6)
- [ ] `Composer variant="desktop"` (§10)
- [ ] Empty-state в `ChatThread` + переключение RightPanel (§7.1)
- [ ] Clarify-grid 3×N (§7.2) + `RPCard "БОТ УЧИТСЯ"`
- [ ] Weekly hero-card 560px (§7.3) + переключение RightPanel в воскресенье
- [ ] `CommandPalette` ⌘K (§7.4)
- [ ] `SectionSheet` (§8) + интеграция с существующими страницами
- [ ] Collapsed rail (§9) + toggle в `uiSlice`
- [ ] Tests (§12)

---

## 14. Что НЕ делаем в этой итерации

- Drag-reorder виджетов в правой панели (Phase 2)
- Inline-вычисления в композере (`500/4` → preview) — Phase 2
- Pin-карточки на доску — это V3 концепта, мы делаем V1
- Mini-charts внутри bot-bubble (V2) — оставлено в концепте как идея, в V1 рендерим обычные `SavedRow + Envelope`
- Multi-chat (`@аня`, отдельные потоки) — позже
