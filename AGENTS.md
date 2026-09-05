# FamilyBudgetApp — agent context

> **`CLAUDE.md` is the source of truth.** It carries the product intent, the
> runtime contract, the architecture notes that matter and a dated change log.
> Read it first. This file is the short orientation: what the stack actually is
> today, where things live, and the invariants that are easy to break.
>
> The previous version of this file described Next.js 15, `next-pwa`,
> `next-intl`, a `paper` theme and a Hebrew runtime locale. None of that has
> been true since August 2026; it was regenerated on 2026-09-04.

## Stack (verified against `package.json`)

- **Framework:** Next.js 16 + App Router. Dev runs on Turbopack; `npm run build`
  passes `--webpack` on purpose, because the PWA plugin injects a webpack config.
- **Language:** TypeScript 6, strict. (TypeScript 7 does not work here —
  `typescript-eslint` rejects it; see the CLAUDE.md entry for 2026-08-22.)
- **Styling:** Tailwind CSS v4 (theme lives in `@theme` inside `globals.css`,
  there is no `tailwind.config.ts`) + custom tokens. Fonts: Inter, and
  Instrument Sans for the Press theme only.
- **State:** Redux Toolkit — `src/store/store.ts`.
- **Backend:** Firebase Auth + Firestore, **Spark free tier**. No Cloud
  Functions, no server push, no server-side triggers: every feature has to work
  from the client. Firebase Storage is *not* used.
- **i18n:** hand-rolled — `src/shared/utils/makeT.ts` + `src/shared/hooks/useT.ts`
  over `src/messages/{en,ru}.json`. There is no i18n library. `he.json` exists on
  disk but is not bundled and cannot be selected (`Language` is `'en' | 'ru'`).
- **PWA:** Serwist (`@serwist/next`). The worker is TypeScript at
  `src/app/sw.ts`, compiled to `public/sw.js` at build time.
- **Charts:** recharts, lazily loaded (`next/dynamic`) on `/analytics` and
  `/statistics` only — see `AnalyticsCharts.tsx` / `StatisticsCharts.tsx`.
- **Tests:** Vitest. Playwright for E2E (`e2e/`, and `e2e-emulated/` which needs
  Java for the Firebase emulators).

## Dev workflow

```bash
npm run dev
npm run lint          # plain `eslint .` — `next lint` was removed in Next 16
npm run build         # next build --webpack
npm test              # vitest run
```

`tsc --noEmit` is incremental and a stale `.tsbuildinfo` can hide real errors —
use `npx tsc --noEmit --incremental false` when a check has to be trusted.

## Where things live

```text
src/
  app/
    (app)/
      home/          primary chat runtime — the main expense-entry path
      expenses/      list, search, context/category filters; new/ = split entry
      categories/    advanced cleanup/library screen, NOT primary navigation
      recurring/     templates, mark-as-paid, [id] detail screen
      analytics/     trends + day-of-week + family view (charts are lazy)
      statistics/    per-category breakdown + budgets (charts are lazy)
      budget/ savings/ income/ account/
  features/
    chat/            bot, legacy parser (dictionaries + dates), chat UI state
    expenses/        engine (deterministic ranking), services, presentation
    categories/      presets/library, pickers, editors, CategoriesHub
    recurring/ savings/ income/ budget/ family/ notifications/ quickadd/
  shared/            utils, hooks, components, types
```

## Invariants that are easy to break

1. **Context is not category.** `Shufersal`, `Dabbah` are merchant context;
   categories stay semantic (groceries, bakery, fuel…).
2. **Expense writes are batched** with their `monthlyStats` delta
   (`expensesService.ts`), and income writes now are too. `/statistics` and
   `/analytics` READ those aggregates, so a write that skips its delta is a
   number the user sees and cannot explain.
3. **Local date keys.** Use `shared/utils/dateKey.ts` for every "today" /
   "this month" decision. Expense dates are stored as UTC ISO strings, so
   slicing them shifts entries across day and month boundaries.
4. **Currencies are never summed.** There is no FX source. Totals are grouped
   per currency — `shared/utils/currencyTotals.ts`.
5. **`/expenses` presentation is split-aware.** `expensePresentation.ts` is the
   single source of truth for split-vs-category display; `expense.categoryId`
   stays the analytics key.
6. **Auth boundary.** `src/store/store.ts` resets the Redux tree when auth
   becomes `null`, keeping only device preferences (theme, dark mode, language).
7. **Active entities only.** Chat suggestions and pickers use the user's own
   active categories/folders. Preset library names are search suggestions until
   explicitly activated.
8. **Theme is presentation-only.** `theme: mist | press` plus a separate
   `isDarkMode` boolean; never route theme work through the parser, write
   services or Firestore schema.

`docs/ARCHITECTURE.md` holds the category/folder invariants in more detail and
is still accurate.

## Firestore collections

```text
users/{uid}
families/{familyId}
invites/{inviteId}
categories/{uid}/{expense|income}/{categoryId}
categoryFolders/{uid}/{expense|income}/{folderId}
expenses/{uid}/items/{expenseId}
incomes/{uid}/items/{incomeId}
recurringPayments/{uid}/items/{id}
recurringIncome/{uid}/items/{id}
savingsGoals/{uid}/goals/{goalId}
messages/{uid}/items/{messageId}
monthlyStats/{uid}/months/{YYYY-MM}
storeProfiles/{uid}/profiles/{storeId}   ← legacy, only ever deleted now
```

Rules live in `firestore.rules` and are part of the app's behaviour, not just
its security: family reads depend on provable query filters, and
`categories/{uid}` allows `get` to family members but `list` only to the owner.
Ship `firebase deploy --only firestore:rules` with any change to them.

## Known constraints

- No backend: notifications are pull-based on launch, and anything requiring a
  server has to wait for the Blaze plan (see `docs/MOBILE-ROADMAP.md`).
- The chat still uses the legacy parser (`features/chat/parser/`) for
  dictionaries, merchants and date phrases; the deterministic engine
  (`features/expenses/engine/`) contributes ranking. Alignment, not replacement.
- Split purchases are one `Expense` document with `splits[]`; there is no
  separate split entity.
- The Firestore emulator needs Java, which is not installed on the primary dev
  machine, so authenticated E2E and rules tests cannot run there.
