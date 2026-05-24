# FamilyBudget Chat Mode · Implementation Handoff

> Идея — заменить главный экран приложения чатом с локальным ботом. Запись траты = просто сообщение в чат. Бот парсит правилами (без LLM, без API-затрат), сохраняет `Expense` в Firestore, отвечает rich-карточкой. Все существующие фичи (категории, бюджеты, копилки, регулярные, семья) остаются под капотом — открываются из гамбургер-меню.
>
> Дизайн-референс: `.claude/skills/familybudget-design/Chat Concept.html` — 4 экрана (Утро / Clarify / Воскресный отчёт / Меню) + артборд «Design tokens» в конце.

---

## 0. Главные правила

1. **Никаких API-затрат.** Парсинг 100% локально (TS), Firebase Spark-tier, никаких внешних AI-сервисов.
2. **Сохраняем существующую модель данных.** Каждая запись = `Expense` в существующей коллекции `expenses/{userId}/{expenseId}`. Не трогаем `expensesService`, `categoriesSlice`, типы.
3. **Чат — это слой UI поверх Expense.** Добавляется новая коллекция `messages/{userId}/{messageId}`, в которой `kind: 'user' | 'bot'`, и у user-сообщений если успешно распарсилось — `expenseId: <fk>`. Удаление сообщения удаляет связанный Expense.
4. **Mobile-first.** Десктоп можно адаптировать позже — на ≥ 1024px чат остаётся в центральной колонке 480px, сайдбар существующий.
5. **Существующие маршруты остаются.** `/expenses`, `/statistics`, `/savings` и т.д. живут — открываются из меню. Главный `/home` перестраивается в чат.

---

## 1. Стек контекст

- **Стек уже есть.** Next.js 15 + TS + Tailwind + shadcn + Redux Toolkit + Firebase + next-intl + Nunito. См. `CLAUDE.md`.
- **Иконки** — `src/features/categories/icons/icons.tsx` (sticker-set, 55 SVG). Используем `<StickerIcon icon="cart" color="#E07A5F" size={28}/>`.
- **Категории** — `TAXONOMY` из `defaultCategories.ts` (12 родителей × ~7 подкатегорий + 8 источников дохода). У каждой `id`, `ru`, `color`, `icon`.

---

## 2. Дизайн-токены

Все цвета — HSL-переменные из существующего `globals.css` (warm-палитра). Добавляем константы для чата:

```ts
// src/features/chat/styles/tokens.ts
export const C = {
  primary:     '#E07A5F',
  primaryDeep: '#C9684E',
  primaryTint: '#FAEAE2',
  sage:        '#81B29A',
  rose:        '#C97B84',
  caramel:     '#D4A574',
  yellow:      '#F2CC8F',
  lavender:    '#A48BC9',
  blueSoft:    '#8AA9D6',
  olive:       '#A8B89C',
  apricot:     '#E9B384',

  bg:        '#FBF6EE',
  bgSoft:    '#F4ECDE',
  card:      '#FFFFFF',
  cardTint:  '#FEFAF3',   // bot bubble — тёплее чем pure white
  fg:        '#3D2C1F',
  sub:       '#8E7A66',
  hairline:  '#EDE0CC',
};
```

**Типографика.** Один шрифт — **Nunito** (400/700/800/900), уже подключён. На всех суммах `font-variant-numeric: tabular-nums`.

| Класс | Размер/вес | Использование |
|---|---|---|
| `text-display` | 32/900 letter-spacing -0.8 | Pinned balance, hero-цифры на карточках |
| `text-h1`      | 22/900 -0.4 | Названия секций, недельный итог |
| `text-h2`      | 17/800 -0.2 | Заголовки внутри карточек, имена в чате |
| `text-amount`  | 17/900 -0.3 | Сумма в saved-row |
| `text-body`    | 14.5/700 | Юзер- и бот-сообщения |
| `text-sub`     | 14/600 (sub-color) | Подзаголовки, контекст |
| `text-caption` | 11/800 UPPER tracking .09 | Метки `СРЕДА · 17 МАЯ` |
| `text-time`    | 10/700 tabular | Time-stamps |

**Радиусы.** Шкала 999 (chip) → 18 (bubble) → 22 (card) → 26 (hero).

**Тени.**
```ts
bubble: '0 1px 2px rgba(61,44,31,.05), 0 4px 14px rgba(61,44,31,.04)';
card:   '0 1px 2px rgba(61,44,31,.06), 0 8px 22px rgba(61,44,31,.07)';
user:   '0 4px 14px #C9684E30';
pinned: '0 14px 28px #C9684E38';
```

---

## 3. Модель данных

### Новая коллекция: `messages/{userId}/{messageId}`

```ts
// src/shared/types/message.ts
export interface ChatMessage {
  id: string;
  userId: string;          // PK — позже заменится на familyId для семейного чата
  senderId: string;        // = userId сейчас, чтобы будущая семья работала
  kind: 'user' | 'bot';

  text: string;            // raw для user, markup-ready для bot
  parsed?: ParseResult;    // только у user-сообщений после парсера
  expenseId?: string;      // если успешно сохранилось
  card?: BotCard;          // если bot отправил rich-карточку

  status: 'pending' | 'saved' | 'clarifying' | 'undone' | 'failed';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ParseResult {
  amount: number;
  categoryId: string | null;
  parentId: string | null;
  matchedKeyword?: string;
  confidence: 'high' | 'medium' | 'low' | 'failed';
}

export type BotCardKind = 'morning' | 'saved' | 'clarify' | 'weekly' | 'envelopes' | 'goal' | 'undone' | 'alert';
export interface BotCard {
  kind: BotCardKind;
  data: any;               // зависит от kind — sf-структуры см. ниже
}
```

### Firestore-правила (минимум)

```
match /messages/{userId}/{messageId} {
  allow read, write: if request.auth.uid == userId;
}
```

### Локальный словарь — Firestore не нужен

```ts
// src/features/chat/parser/dictionary.ts — статика в бандле
export const KEYWORDS: Record<string, { parentId: string; subId?: string }> = {
  // ── Groceries
  'хлеб': { parentId: 'groceries', subId: 'supermarket' },
  'молоко': { parentId: 'groceries', subId: 'supermarket' },
  'супер': { parentId: 'groceries', subId: 'supermarket' },
  'виктори': { parentId: 'groceries', subId: 'supermarket' },
  'rami levi': { parentId: 'groceries', subId: 'supermarket' },
  'шуферсал': { parentId: 'groceries', subId: 'supermarket' },
  'вино': { parentId: 'groceries', subId: 'alcohol' },
  'пиво': { parentId: 'groceries', subId: 'alcohol' },
  // ── Dining
  'кофе': { parentId: 'dining', subId: 'coffee' },
  'caffè': { parentId: 'dining', subId: 'coffee' },
  'aroma': { parentId: 'dining', subId: 'coffee' },
  'пицца': { parentId: 'dining', subId: 'fast_food' },
  'бургер': { parentId: 'dining', subId: 'fast_food' },
  'ресторан': { parentId: 'dining', subId: 'restaurants' },
  'доставка': { parentId: 'dining', subId: 'delivery' },
  'wolt': { parentId: 'dining', subId: 'delivery' },
  // ── Transport / Car
  'бензин': { parentId: 'car', subId: 'fuel' },
  'sonol': { parentId: 'car', subId: 'fuel' },
  'delek': { parentId: 'car', subId: 'fuel' },
  'paz': { parentId: 'car', subId: 'fuel' },
  'парковка': { parentId: 'car', subId: 'parking' },
  'такси': { parentId: 'transport', subId: 'taxi' },
  'gett': { parentId: 'transport', subId: 'taxi' },
  // ── Health
  'аптека': { parentId: 'health', subId: 'medicine' },
  'таблетки': { parentId: 'health', subId: 'medicine' },
  'врач': { parentId: 'health', subId: 'doctors' },
  'стомат': { parentId: 'health', subId: 'dentist' },
  // ── Digital
  'spotify': { parentId: 'digital', subId: 'd_music' },
  'netflix': { parentId: 'digital', subId: 'streaming' },
  'youtube': { parentId: 'digital', subId: 'streaming' },
  // ── Home
  'аренда': { parentId: 'home', subId: 'rent' },
  'электричество': { parentId: 'home', subId: 'electricity' },
  'вода': { parentId: 'home', subId: 'water' },
  'интернет': { parentId: 'home', subId: 'internet' },
  // … (целевой объём — 200–300 ключевых слов; добавлять по мере появления чеков)
};

export const EMOJI: Record<string, { parentId: string; subId?: string }> = {
  '🥖': { parentId: 'groceries', subId: 'supermarket' },
  '🥛': { parentId: 'groceries', subId: 'supermarket' },
  '🍷': { parentId: 'groceries', subId: 'alcohol' },
  '🍺': { parentId: 'groceries', subId: 'alcohol' },
  '☕': { parentId: 'dining', subId: 'coffee' },
  '🍕': { parentId: 'dining', subId: 'fast_food' },
  '🍔': { parentId: 'dining', subId: 'fast_food' },
  '⛽': { parentId: 'car', subId: 'fuel' },
  '🚕': { parentId: 'transport', subId: 'taxi' },
  '💊': { parentId: 'health', subId: 'medicine' },
  '🦷': { parentId: 'health', subId: 'dentist' },
  // …
};
```

**«Обучение».** Когда юзер clarify-ит непонятное сообщение — сохраняем в `users/{uid}/learnedKeywords/{keyword}` пару `{ parentId, subId }`. Парсер при следующих сообщениях проверяет learned-словарь **раньше** встроенного.

---

## 4. Парсер

```ts
// src/features/chat/parser/index.ts
export function parseMessage(
  text: string,
  ctx: { learned: Record<string, { parentId: string; subId?: string }> }
): ParseResult {
  // 1. Trim, lowercase, нормализация пробелов
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  // 2. Slash-команда → не парсим как трату
  if (t.startsWith('/')) return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };

  // 3. Найти первое число (целое или дробное)
  const numMatch = t.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };
  const amount = parseFloat(numMatch[1].replace(',', '.'));

  // 4. Удалить число из текста, остаётся "контекст"
  const rest = t.replace(numMatch[0], '').trim();
  if (!rest) {
    // Просто число → clarify-режим
    return { amount, categoryId: null, parentId: null, confidence: 'failed' };
  }

  // 5. Emoji-маппинг (highest priority)
  for (const [emo, hit] of Object.entries(EMOJI)) {
    if (rest.includes(emo)) {
      return { amount, parentId: hit.parentId, categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: emo, confidence: 'high' };
    }
  }

  // 6. Learned-словарь (приоритетнее встроенного)
  for (const [kw, hit] of Object.entries(ctx.learned)) {
    if (rest.includes(kw)) {
      return { amount, parentId: hit.parentId, categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw, confidence: 'high' };
    }
  }

  // 7. Built-in keywords
  for (const [kw, hit] of Object.entries(KEYWORDS)) {
    if (rest.includes(kw)) {
      return { amount, parentId: hit.parentId, categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw, confidence: 'medium' };
    }
  }

  // 8. Ничего не нашли → clarify
  return { amount, categoryId: null, parentId: null, confidence: 'failed' };
}
```

---

## 5. Бот — генерация ответа

```ts
// src/features/chat/bot/respond.ts
export async function respondToUserMessage(
  msg: ChatMessage,
  parsed: ParseResult,
  ctx: BotContext
): Promise<ChatMessage[]> {
  // ctx: { allowanceLeft, envelopes, todayBalance, … } — собирается селектором
  const replies: ChatMessage[] = [];

  if (parsed.confidence === 'failed' && parsed.amount > 0) {
    // Не понял категорию → clarify-карточка
    replies.push(makeBotMessage({ kind: 'clarify', data: { amount: parsed.amount } }));
    return replies;
  }
  if (parsed.confidence === 'failed') {
    // Совсем не понял (нет числа, нет ключа)
    replies.push(makeBotMessage({ text: 'Не понял 🤔 Попробуй так: «65 кофе» или «🍕 80»' }));
    return replies;
  }

  // 1. Сохранить Expense через существующий сервис
  const expense = await addExpense({
    userId: msg.userId,
    amount: parsed.amount,
    categoryId: parsed.categoryId!,
    date: msg.createdAt.toDate(),
    paymentMethod: 'card',     // дефолт; юзер может поменять в детали
    tags: [], privacy: 'regular',
    currency: ctx.currency,
  });

  // 2. Обновить user-msg с expenseId, статусом
  await updateMessage(msg.id, { expenseId: expense.id, status: 'saved' });

  // 3. Bot rich-карточка
  const env = ctx.envelopes.find((e) => e.parentId === parsed.parentId);
  replies.push(makeBotMessage({
    kind: 'saved',
    data: {
      icon: getIconForCat(parsed.categoryId!),
      color: getColorForCat(parsed.parentId!),
      title: getCatPath(parsed.categoryId!),
      hint: getParentName(parsed.parentId!),
      amount: parsed.amount,
      envelope: env ? { name: env.name, spent: env.spent + parsed.amount, limit: env.limit, icon: env.icon, color: env.color } : undefined,
      alert: env && (env.spent + parsed.amount) >= env.limit * 0.85
        ? `Уже на ₪${env.spent + parsed.amount} из ${env.limit} — впритык к лимиту`
        : undefined,
    },
  }));

  return replies;
}
```

**Утро (плановое).** Cloud-функцию не пишем — это free-tier ограничение. Вместо: на каждый «первый visit за день» клиент сам:
1. Проверяет `lastMorningGreetingAt` из `users/{uid}.flags`.
2. Если сегодняшней утренней карточки в `messages` ещё нет — пишет её клиент-сайдово.

**Воскресный отчёт.** Аналогично: «первый visit в воскресенье после 18:00» → рассчитываем weekly summary и пишем bot-сообщение с `card.kind='weekly'`.

---

## 6. Структура файлов

### Создать

```
src/features/chat/
  components/
    ChatScreen.tsx              — главный layout
    ChatHeader.tsx              — sticky header с бургером, аватаром бота, колоколом
    PinnedToday.tsx             — гранёный hero-card с балансом дня
    DateChip.tsx                — разделитель дней
    BotBubble.tsx               — текстовый bot-bubble (поддерживает tail/no-tail для группировки)
    BotCardBubble.tsx           — обёртка для rich-карточек
    BotCard/                    — конкретные карточки
      SavedCard.tsx
      ClarifyCard.tsx
      WeeklyCard.tsx
      MorningCard.tsx
      AlertCard.tsx
    UserBubble.tsx              — пузырь юзера с time + status (✓ saved / ✓✓ acked)
    QuickReplies.tsx            — chip-row под бот-сообщением
    Envelope.tsx                — мини-progress-bar конверта
    Typing.tsx                  — три точки
    Composer.tsx                — + (sub-actions) / поле / голос-или-send
    MenuOverlay.tsx             — гамбургер-меню (slide-in справа в RTL, слева иначе)
  parser/
    dictionary.ts               — KEYWORDS, EMOJI
    parse.ts                    — parseMessage()
    learning.ts                 — saveLearnedKeyword(uid, kw, hit)
  bot/
    respond.ts                  — respondToUserMessage()
    morning.ts                  — generateMorningGreeting()
    weekly.ts                   — generateWeeklySummary()
    templates.ts                — фразы бота (для i18n)
    context.ts                  — collectBotContext(state): BotContext
  services/
    messagesService.ts          — Firestore CRUD для messages коллекции
  hooks/
    useChatMessages.ts          — onSnapshot subscription
    useLearnedKeywords.ts
  store/
    chatSlice.ts                — { messages: ChatMessage[], composer: string, ... }
  styles/
    tokens.ts                   — C, T, SHADOW, RAD
  utils/
    formatAmount.ts             — уже есть в shared; обёртку добавить если нужно
```

### Тронуть

```
src/app/(app)/home/page.tsx           — ПЕРЕДЕЛАТЬ в чат-главную
src/store/store.ts                    — подключить chatSlice
src/shared/components/Header.tsx      — на mobile-чате убрать (заменяется ChatHeader)
src/shared/components/BottomNav.tsx   — оставить, но убрать с /home (чат сам себе главный)
src/messages/{en,ru,he}.json          — добавить chat.* ключи
src/features/expenses/services/expensesService.ts — НЕ ТРОГАТЬ, использовать как есть
```

### Не трогать

`expensesService`, `categoriesSlice`, `categoriesService`, `incomeService`, `savingsService`, типы из `shared/types`, Firebase init, i18n setup.

---

## 7. Behaviour — крайние случаи

| Сценарий | Что делать |
|---|---|
| Юзер пишет «150» (только число) | bot отвечает clarify-карточкой с 4 chip-категориями («Часто выбираешь») + кнопкой «Все категории» |
| Юзер тапает chip в clarify | создаётся новый user-msg `«150 продукты»`, парсер пересчитывает, и «продукты»→`groceries` сохраняется в learned-словаре навсегда |
| Юзер пишет с очепяткой («хлеп 12») | парсер не найдёт → clarify. После уточнения «хлеп» добавляется в learned |
| Дубль (то же самое за 30 сек) | bot спрашивает «Это тот же чек или ещё один?» с кнопками |
| Юзер хочет отменить | свайп влево по user-msg → «Удалить». Удаляется и сообщение, и связанный Expense. В чат пишется system-msg «Отменил трату ₪65 → Кафе» |
| Слэш-команды | `/баланс` → bot card kind='envelopes'; `/неделя` → weekly; `/помощь` → text с примерами |
| Картинка чека | composer-кнопка `+` → камера → пока просто сохранение фото в `expense.receiptUrl` (Storage), бот пишет «Чек сохранён, сумма?» — без OCR в v1 |
| Голосовое | composer-кнопка mic → запись → пока тоже без транскрипции (placeholder, кнопка-заглушка) |
| Утренняя карточка | при mount `ChatScreen`, если `lastMorningGreetingAt` < сегодня — клиент пишет MorningCard |
| Воскресный отчёт | при mount в воскресенье ≥ 18:00, если `lastWeeklyAt` < этой недели — клиент пишет WeeklyCard |

---

## 8. Порядок шагов

1. **Tokens + типы.** Создать `chat/styles/tokens.ts`, `shared/types/message.ts`. Запустить `tsc --noEmit`.
2. **Firestore service.** `messagesService` с `subscribeMessages`, `addMessage`, `updateMessage`, `deleteMessageAndExpense`.
3. **Парсер.** `dictionary.ts` (минимум 60 keywords + 15 emoji для старта) + `parse.ts` + unit-тесты на 10 примеров.
4. **Bot.** `respond.ts` для простейшего happy-path (saved + clarify + alert). Остальные kind'ы (morning, weekly) отложить на шаг 7.
5. **UI компоненты.** Скопировать визуально 1-в-1 из дизайн-реф'а (`Chat Concept.html` → артборды 01-04 + Design tokens). Использовать `<StickerIcon>` из существующего иконного пакета.
6. **Главный экран /home.** Сборка: ChatHeader + PinnedToday + scrollable messages list + Composer. `useChatMessages` хук подписан на Firestore.
7. **Бот-карточки расширенные.** MorningCard (auto-write на первый daily open), WeeklyCard (auto-write в воскресенье).
8. **Slash-команды.** `/баланс`, `/неделя`, `/помощь`. Меню pinned в composer как «?» кнопка с подсказкой.
9. **Меню overlay.** Линкует на существующие `/expenses`, `/statistics`, `/savings`, `/recurring`, `/account`, `/categories`.
10. **i18n.** Прогнать все строки через `useT()`. Не оставлять литералов в jsx.
11. **Тесты.** Vitest на парсер (10 кейсов). Playwright или RTL на bot-flow «65 кофе → saved-card».
12. **Lint + build.** `npm run lint && npm run build`.

---

## 9. i18n-ключи (минимум)

```json
"chat": {
  "header": { "online": "онлайн · считает локально" },
  "today": { "label": "На сегодня · {day}", "of": "из ₪{total}", "spent": "потрачено ₪{spent} · уже {pct}%" },
  "morning": { "greeting": "Доброе утро ✨", "yesterday": "Вчера потратил ₪{sum} — {cats}", "freeToday": "На сегодня свободно ₪{free}" },
  "saved": { "left": "осталось ₪{n} на день", "envelope": "{name} · {spent}/{limit}", "alert": "⚠️ Уже на ₪{spent} из {limit} — впритык" },
  "clarify": { "ask": "Не понял, ₪{n} куда? 🤔", "common": "Часто выбираешь", "all": "Все категории", "promise": "подскажешь — запомню это слово навсегда" },
  "weekly": { "closed": "Неделя закрыта 💫", "title": "Неделя {n} · {range}", "saved": "Сэкономил ₪{n} — переведём в {goal}?",
    "best": "Лучший день", "worst": "Тяжёлый день", "often": "Часто" },
  "composer": { "placeholder": "Запиши быстро…", "help": "/баланс /неделя /помощь" },
  "menu": { "stats": "Статистика", "envelopes": "Конверты", "savings": "Копилки", "recurring": "Регулярные", "family": "Семья", "settings": "Настройки", "online": "Семья онлайн · {n}" },
  "commands": { "balance": "/баланс", "week": "/неделя", "help": "/помощь" }
}
```

---

## 10. Приёмка

- [ ] На `/home` главный — чат с pinned today-card сверху + composer снизу
- [ ] Утром при первом открытии (или раз в день после полуночи) — bot пишет morning-card
- [ ] «хлеб 12» → ₪12, Продукты · Супермаркет, bot пишет saved-card. Запись видна в существующем `/expenses`
- [ ] «150» (без слова) → bot пишет clarify-card с 4-5 чипами. Тап на chip создаёт expense и пишет в learned
- [ ] «150 продукты» в следующий раз — парсится автоматически (learned)
- [ ] Конверт при достижении 85% лимита — saved-card дополнительно показывает alert
- [ ] Voice/Photo кнопки composer'а — visible, но открывают «скоро» modal
- [ ] Гамбургер слева → MenuOverlay со всеми разделами, badge'ами и аватарами семьи
- [ ] Свайп влево по user-msg → подтверждение удаления → удаляются и msg, и expense
- [ ] /баланс, /неделя, /помощь работают
- [ ] Mobile (< 1024px) и desktop (≥ 1024px) одинаково работают (чат по центру, шириной 480px на desktop)
- [ ] Dark mode корректно (всё через `--background`/`--card`/`--foreground`)
- [ ] RTL (Hebrew): меню справа, аватары справа, пузыри юзера слева
- [ ] Lint + build чистые
- [ ] 10 unit-тестов парсера зелёные

---

## 11. Чего не делать

- ❌ Не подключать никаких LLM/AI API — всё локально
- ❌ Не писать Cloud Functions (free-tier их нет)
- ❌ Не делать OCR чеков в v1 — кнопка-заглушка
- ❌ Не делать транскрипцию голоса в v1 — кнопка-заглушка
- ❌ Не дублировать `Expense` в `messages` (только `expenseId` FK)
- ❌ Не менять `expensesService` или схему `Expense`
- ❌ Не вводить новых цветов вне `colors_and_type.css` + 3 категорийных tint'а
- ❌ Не использовать эмодзи в UI вне случаев, прописанных дизайном (морнинг ✨, бот «не понял» 🤔, неделя 💫, alert ⚠️, семья 👨‍👩‍👦, кошёлёк 🐷)

---

## 12. Промт для запуска

> Открой `.claude/skills/familybudget-design/Chat Concept — Claude Code Prompt.md` — план переделки главного экрана на чат-интерфейс. Перед каждым шагом покажи список файлов и diff — после моего OK пиши код. Не трогай Firebase config, типы, Redux-сервисы. После каждого шага: `npm run lint`. Дизайн-референс — `Chat Concept.html` (4 экрана) + артборд «Design tokens». Стартуем с **Шага 1** (tokens + типы).
