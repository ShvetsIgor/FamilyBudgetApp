# Family Budget — Web Version Handoff

> Документ для Claude Code: что и как сделать, чтобы поднять веб-версию `FamilyBudgetApp` в новом тёплом стиле. Ссылается на дизайн-кит `familybudget-design` (этот проект).

---

## 0. Контекст

- **Стек уже на месте:** Next.js 15 App Router, TypeScript, Tailwind, shadcn/Radix, Redux Toolkit, Firebase, next-intl, recharts.
- **Mobile-first PWA уже работает.** Веб-версия = тот же `src/app/(app)/*`, но с **desktop-лэйаутом** на ≥ 1024px.
- **Дизайн-референс:** `.claude/skills/familybudget-design/` (этот kit). Главные файлы:
  - `colors_and_type.css` — токены (HSL-переменные, шрифт, радиусы)
  - `assets/logo-mark.svg`, `assets/logo-wordmark.svg`
  - `ui_kits/app/index.html` — мобильные экраны (источник лэйаута для < 1024 px)
  - `explorations/Web App Dashboard.html` — **референс десктопного дашборда**

---

## 1. Шаги по порядку

### Шаг 1 — Применить токены тёплой темы

1. Заменить содержимое `src/app/globals.css` HSL-блоком из `colors_and_type.css` (секция `:root` + `.dark`).
2. В `src/app/layout.tsx` заменить `Inter` → `Nunito` через `next/font/google`:
   ```ts
   import { Nunito } from 'next/font/google';
   const nunito = Nunito({ subsets: ['latin','cyrillic'], weight: ['400','600','700','800','900'], variable:'--font-sans' });
   ```
3. В `tailwind.config.ts` добавить радиусы: `lg: '1.375rem'`, `xl: '1.625rem'`, `'2xl':'2rem'`. `borderRadius.DEFAULT = '1rem'`.
4. В `src/features/categories/services/defaultCategories.ts` заменить цвета хексами из секции `--cat-*`.

### Шаг 2 — Подключить логотип

1. Скопировать `assets/logo-mark.svg` → `public/logo-mark.svg` и `src/app/icon.svg`.
2. Скопировать `assets/logo-wordmark.svg` → `public/logo-wordmark.svg`.
3. Растеризовать через `sharp` (CLI-скрипт): `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180). Положить в `public/`.
4. Обновить `public/manifest.json` (`icons[]`).

### Шаг 3 — Адаптивный shell

Создать `src/shared/components/AppShell.tsx` — обёртка, которая:

- **< 1024 px:** оставляет существующий `Header` + `BottomNav` (мобильный лэйаут как сейчас).
- **≥ 1024 px:** показывает `Sidebar` (260 px фикс слева) + `TopBar` сверху, скрывает `BottomNav`.

Использовать в `src/app/(app)/layout.tsx`.

### Шаг 4 — Sidebar

`src/shared/components/Sidebar.tsx` — точная копия лэйаута из `explorations/Web App Dashboard.html`:

- Бренд: `logo-mark.svg` 36×36 + wordmark текстом `family.budget`
- Секции: **Бюджет** (Обзор, Транзакции, Аналитика, Категории) · **Планирование** (Копилки, Регулярные, Цели) · **Семья** (Участники, Настройки)
- Активный пункт — терракотовая заливка `bg-primary text-primary-foreground` + shadow.
- Бейджи на пунктах — `bg-accent` (тёплый жёлтый).
- Карточка профиля внизу: аватар + имя + название семьи + меню.

### Шаг 5 — TopBar

`src/shared/components/TopBar.tsx`:

- Заголовок страницы (h1, 28px / 900, tracking −0.02em)
- Поиск (340 px max, иконка слева)
- Кнопки 🔔 / 🌙 (toggle тёмной темы из `uiSlice`)
- Primary CTA `＋ Новая трата` → open `AddExpense` модалкой

### Шаг 6 — Десктопный Dashboard

Создать `src/app/(app)/home/page.tsx` (или отдельный `dashboard/`) с лэйаутом из референса:

- **Hero balance** (col-span-2) — терракотовая карточка, балансы 56px / 900, два декоративных круга
- **Stat-карточка** «Средний день» — крупное число + spark-line через recharts
- **Trend chart** — 6 месяцев, recharts `BarChart`, последняя колонка primary, остальные tint
- **Upcoming** — 3 записи с pill-таймерами (через 5 / 19 / 24 дн)
- **Budgets** — список категорий с прогресс-барами
- **Recent transactions** — таблица: иконка / место / категория-pill / сумма / дата / меню. Hover-row подсветка `bg-muted/30`.

### Шаг 7 — Адаптация остальных страниц

- `/expenses` — на десктопе таблица вместо карточек, фильтры в hero-полосе.
- `/statistics` — donut слева, список категорий справа.
- `/analytics` — 3 stat-карточки сверху + тренд + day-of-week.
- `/account` — двухколонный лэйаут (нав-карточки слева, контент справа).
- Auth — центрированная карточка max-width 420 px на кремовом фоне.

---

## 2. Брейкпоинты

| px | устройство | лэйаут |
|---|---|---|
| < 640 | mobile | существующий, single-column, BottomNav |
| 640–1023 | tablet | как mobile, но контент max-width 560 px по центру |
| ≥ 1024 | desktop | sidebar 260 + main, BottomNav скрыт |
| ≥ 1440 | wide | main max-width 1280, центрировать |

---

## 3. Правила, которые нельзя нарушать

1. **Не трогать** Firebase, типы, Redux-логику. Только UI.
2. **Никаких новых цветов** — только из `colors_and_type.css`.
3. **Шрифт один** — Nunito. Веса 400/600/700/800/900.
4. **Tabular-nums** на всех суммах: `font-variant-numeric: tabular-nums`.
5. **Радиусы** только из шкалы (12/16/22/32 / pill).
6. **RTL** — Hebrew должен работать; sidebar становится справа через `dir="rtl"`.
7. **Dark mode** — тоггл уже есть в `uiSlice`. Все цвета через HSL-переменные, ничего не хардкодить.

---

## 4. Промт для старта (просто скопируй в Claude Code)

> Прочитай `.claude/skills/familybudget-design/HANDOFF.md` и выполни шаги 1-2. Перед началом покажи мне план на каждый файл, который собираешься менять. Не пиши код пока я не подтвержу.

Дальше — пошагово по разделам.

---

## 5. Что готово в дизайн-ките

- ✅ Токены, шрифт, палитра — `colors_and_type.css`
- ✅ Логотип — `assets/logo-*.svg`
- ✅ Мобильные экраны (11 штук) — `ui_kits/app/index.html`
- ✅ Десктопный дашборд — `explorations/Web App Dashboard.html`
- ⚠️ Десктопные экраны для остального (transactions table, settings split, auth) — Claude Code собирает по референсу

---

## 6. Приёмка

После шага 1-2 проверь визуально:
- Главный экран на телефоне выглядит как `ui_kits/app/index.html` (Home).
- Главный экран на десктопе ≥ 1024 px — как `explorations/Web App Dashboard.html`.
- Тёмная тема переключается без сломанных контрастов.
- Иконка PWA на homescreen — пухлая копилка на креме.
