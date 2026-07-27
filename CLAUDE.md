# FamilyBudgetApp - Claude Context

## Product Intent

`family.budget` should not feel like a category-admin app.

Primary UX:

- user writes an expense in chat
- app parses amount plus merchant/context
- app asks only when confidence is low
- supermarket and mixed purchases should naturally continue into split flow
- category management is secondary and should stay out of the main path

Core principle:

- **context is not category**
  `Dabbah`, `Shufersal`, `McDonald's` are merchant/context signals.
  Real categories stay semantic: groceries, bakery, home, fuel, coffee, and so on.

## Stack

- **Framework:** Next.js 15 + App Router
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS + shadcn/ui + custom tokens
- **State:** Redux Toolkit
- **Backend:** Firebase Auth + Firestore + Storage
- **Charts:** Recharts
- **PWA:** `next-pwa`
- **Date utils:** `date-fns`
- **Tests:** Vitest

## Active Runtime Contract

- Active locales: `en`, `ru`
- Hebrew / RTL is intentionally paused and is not part of the active runtime guarantee
- Visual theme is `mist | press`; dark mode is a separate boolean and must not be inferred from `theme`
- `<html>` owns `data-theme="mist|press"` and the `dark` class independently through `ThemeProvider`
- `/home` is the main expense-entry path
- `/categories` is an advanced cleanup/library screen, not a primary navigation flow
- `/expenses` should present split purchases by merchant context when that context exists, while analytics still stay category-based
- Category reset is allowed to leave expense folders empty; expense-side library entities should only appear after explicit activation or explicit chat choice

## Dev Workflow

```bash
npm run dev
npm run lint
npm run build
npm test
```

Current verified baseline after the 2026-05-28 alignment pass:

- `npm run lint` - green
- `npm run build` - green
- `npm test` - `489/489` green

## Project Structure

```text
src/
  app/
    (app)/
      home/page.tsx               primary chat/orchestration runtime
      expenses/page.tsx           expense list, search, context/category filters
      expenses/new/page.tsx       split/manual entry runtime
      categories/page.tsx         advanced cleanup/library
      recurring/page.tsx          recurring templates + mark-as-paid flow
  features/
    chat/
      bot/                        bot context, save/clarify flow, morning/weekly cards
      parser/                     legacy dictionary/store parser used by chat
      store/                      chat UI state + store profiles
    expenses/
      engine/                     deterministic ranking/memory/split engine
      services/expensesService.ts batched expense + monthlyStats writes
      store/suggestionMemorySlice.ts
      utils/expensePresentation.ts split-aware list presentation helpers
    categories/
      services/defaultCategories.ts
      components/CategoriesHub.tsx
  shared/
    utils/dateKey.ts              shared local YYYY-MM-DD helpers
```

## Architecture That Matters

### 1. Two parsing layers exist on purpose

- Chat still uses `features/chat/parser/parse.ts` for dictionary/store parsing.
- The newer deterministic expense engine lives in `features/expenses/engine/*`.
- Current strategy is **alignment, not hard replacement**:
  chat and manual flows share saved history via `suggestionMemory`, even though the front parser is still the legacy chat parser.

### 2. Shared deterministic memory

`features/expenses/store/suggestionMemorySlice.ts` is the common memory layer for:

- merchant history
- recent category usage
- split combos
- tag associations
- merchant context stats

As of 2026-05-27, chat saves now feed this memory too, not only `FastExpenseEntry`.

### 3. Store profiles still exist

`storeProfiles` is a separate chat-facing memory keyed by `storeId`.

Use it for:

- known store clarify chips
- per-store probable category ordering in the chat UI

Do not confuse it with `suggestionMemory`:

- `storeProfiles` is chat-facing merchant memory by canonical store id
- `suggestionMemory` is the shared deterministic ranking memory across flows

### 4. Expense writes must stay batched

`features/expenses/services/expensesService.ts` batches:

- expense create plus `monthlyStats`
- expense edit plus old/new `monthlyStats` deltas
- expense delete plus `monthlyStats`

If you change the expense domain model, preserve this invariant.

### 5. Auth boundary

`src/store/store.ts` resets the Redux tree when auth becomes `null`.

Reason:

- without a full reset, slice `status === 'idle'` guards can leave stale user A data visible for user B

Do not remove this unless you replace it with a full session-boundary solution.

### 6. Local date keys

Use `shared/utils/dateKey.ts` for local `YYYY-MM-DD` keys.

This is the contract for:

- chat context daily calculations
- weekly summary ranges
- recurring notification dedupe
- store profile last-used markers

Avoid mixing local day keys with `toISOString().slice(0, 10)` in product logic.

### 7. Expense list presentation is intentionally split-aware

`features/expenses/utils/expensePresentation.ts` is the shared presentation layer for `/expenses`.

Rules:

- regular expenses are listed and filtered by semantic category
- split expenses with a known `storeGroup` are listed and filtered by merchant context instead
- this is a presentation rule only; `expense.categoryId` remains the analytics/statistics key

Do not move this concern into `expensesService` or mutate stored category ids just to satisfy list UI.

### 8. Mist/Press visual layer is presentation-only

- `features/ui/store/uiSlice.ts` owns `theme: mist | press` and `isDarkMode`.
- `shared/components/ThemeProvider.tsx` applies `data-theme` plus `.dark`.
- `app/globals.css` owns the Mist/Press token bridge and `fb-*` helper classes.
- Category icons use the outline icon registry API (`I`, `IconKey`, `IconProps`) and must not change stored category schema.
- Do not route theme work through parser, expense write services, category policy, split persistence, or Firestore schema.

## Recent Alignment Pass (2026-05-27)

Implemented:

- chat category-sheet flow preserves `storeId/storeName/storeGroup/isTagLearning`
- chat saves update `suggestionMemory`, not only manual/numpad saves
- chat auto-saves refresh `storeProfiles` when store metadata exists
- expense create/edit/delete writes are batched with monthly stats
- recurring-generated expenses keep `isRecurring` aligned with `recurringId`
- Redux store resets on logout/auth-null
- local-day helper introduced and applied to weekly/recurring/store-profile paths
- `Categories` removed from primary desktop sidebar navigation
- split expenses in `/expenses` now show and filter by merchant context instead of the first split category
- chat split saves keep fallback category selection inside the chosen folder context instead of falling through to an unrelated global first category
- test baseline updated and back to green
- category reset now clears remote `storeProfiles` and learned keywords, not only local Redux memory
- expense reset switches the expense side into library-first mode, so preset expense folders do not silently re-seed on the next auth load
- chat clarify fallback can offer library folders even when no expense folders are active, and selecting one materializes that folder before continuing to split UI
- folder/category editors now show name-only preset library suggestions while typing; selecting a suggestion fills the label and preset metadata without activating hidden entities
- recurring form can create or reuse sections and categories inline, and recurring-generated expense deletion restores the linked template due date instead of leaving it advanced
- recurring templates now resolve a real category before save, so mark-paid and first-run generation do not silently stop on empty `categoryId`
- newly created recurring templates backfill their initial occurrence when the start date is today or earlier; if that occurrence cannot be written, the template is rolled back instead of persisting half-broken
- `/expenses` context filter chips pass the active locale through preset `storeGroup` fallback labels instead of defaulting those chips to English
- savings contribution comments are localized at render/save time, and recurring incomes persist a `recurring` tag for list presentation
- chat folder-clarify flow no longer auto-selects the first category inside the chosen folder; leftover category choice is explicit, while fully covered split rows can still save without a fake fallback
- empty folders created from chat no longer send `FastExpenseEntry` into a broken state; the flow opens with folder context intact and supports immediate inline category creation
- recurring payment setup is section-first in the UI: empty sections block saving and offer inline category creation instead of silently falling back to a random category
- split row clarification no longer exposes whole historical split combos as one-click inserts; split memory only raises previously used sections/categories higher in the normal picker
- partial split saves must not use merchant history as an implicit remainder category; if remainder > 0, the user must choose a real category for that leftover amount
- expense persistence validates amount/date/category and rejects split totals above the purchase amount; UI validation must not be the only guard
- desktop quick-add must save real category ids only, never folder ids
- split opened from chat should carry the known store-group section context when possible, materializing the library folder if needed
- category and folder icon color choices now use an expanded 28-color palette

## Mist/Paper Redesign Pass (2026-05-28)

Implemented:

- theme model split into `theme: mist | paper` plus `isDarkMode`
- `ThemeProvider` sets `data-theme` and `.dark` independently while preserving locale direction handling
- global CSS tokens replaced with Mist/Paper design variables and Tailwind HSL compatibility variables
- Inter/Manrope fonts wired through `next/font/google` and CSS `--font-sans` / `--font-display`
- category sticker icon registry replaced by outline icons while preserving the `I`, `IconKey`, `IconProps` API
- account page now exposes a dedicated appearance block for Mist/Paper and separate dark mode
- core chat/category token files now read CSS variables instead of old warm constants
- parser, split, recurring, savings, Firestore write, and category/folder domain logic were intentionally left out of the redesign scope

## UX Hotfix Pass (2026-05-29)

Implemented:

- restored corrupted UTF-8 source literals from the redesign pass in account/settings, category hub, quick-add, top bar, and related comments
- removed remaining source-level mojibake tokens from tracked app/documentation files; PowerShell may still print valid UTF-8 as mojibake, so use Node/UTF-8 reads for verification
- account/settings menu icons now use valid Unicode emoji or existing visual components, not corrupted string literals
- folder/category name library suggestions select on `pointerdown` with `preventDefault`, so mobile Safari blur cannot close the dropdown before the tap is handled
- chat clarify suggestions use active user-created/activated expense folders only; library/preset folders stay hidden until the explicit library/add-from-library flow
- expense category seeding no longer auto-materializes every preset folder/category as active user data; income defaults are unchanged
- category/folder suggestion overlays use explicit `suggestionsOpen` state and close/blur after pointer selection, avoiding stuck dropdowns on desktop and mobile Safari
- recurring payment section creation immediately opens category creation when the selected section has no categories, preventing dead-end saves
- recurring due labels use calendar-day differences, so "today" is shown only for the actual local calendar day
- category constructor sections initialize collapsed; newly created/activated sections are the only ones opened automatically
- merchant-to-section learning is stored in `suggestionMemory_v2.merchantContextStats` via `recordMerchantContext` and used to rank future chat folder suggestions
- split presentation falls back to the expense category folder label when no `storeGroup` exists, so split receipts show the section instead of the first split category
- unknown store parsing preserves the user's display casing (`storeName`) while keeping `storeId`/matching normalized
- the cryptic split `÷N` action was removed from the primary split UI

Runtime contract:

- Ordinary chat, quick suggestions, and split pickers must use active user categories/folders only.
- Preset/library names are search suggestions or explicit library choices, not active entities until the user selects/activates them.
- Do not auto-clean user-entered corrupted strings from Firestore/localStorage without a targeted migration decision; source literals and app-owned seed/cache text are safe to fix.
- Store/tag learning keeps display and matching separate: UI uses `storeName`, while history lookup uses normalized merchant/tag keys.
- Split receipt display should use section/folder context as the primary label; split line categories are secondary breakdown data.

## Paper → Press Theme Migration (2026-05-29)

Implemented:

- replaced the `paper` theme variant with the editorial **Press** direction from the v2 design handoff: warm paper background `#F7F4EE`, hot-red accent `#E8442A`, beige hairlines, 15px radii, retuned `--cat-*` tints in `globals.css`
- `Theme` type is now `'mist' | 'press'`; `uiSlice`, `AuthProvider`, and `RegisterForm` migrate previously-saved `'paper'` values (localStorage + Firestore profile) to `'press'` on first read
- `account/page.tsx` theme picker, `en.json`, and `ru.json` use `themePress` / `themePressDesc` keys with the new copy; swatch updated to `#E8442A`
- `Manrope` swapped for `Instrument_Sans` via `next/font/google`, exposed as `--font-instrument-sans`
- `features/categories/icons/icons.tsx` overwritten with the v2 outline set (same `I` / `IconKey` / `IconProps` API)
- baseline after migration: lint clean, build clean, `npm test` `492/492` green

Runtime contract update:

- visual theme is now `mist | press` (was `mist | paper`); the `'paper'` key only survives as a one-way migration shim in `uiSlice.hydrateThemePreferences` and the auth profile readers
- `.fb-*` helper classes are now consistent across themes (both lean on hairline + soft shadow); paper-era `:root[data-theme="paper"]` overrides for `.fb-pin`, `.fb-btn-primary`, etc. are gone
- 2026-05-29 doc sync: Active Runtime Contract and Architecture §8 updated to reference `mist | press` instead of `mist | paper`

## Known Gaps

- **Firebase stays on the free Spark plan** — no Cloud Functions, no FCM server pushes, no server-side triggers. All notifications are pull-based on the client (bell digest on launch); any future feature must work without a backend.
- Family budget is read-only sharing of expenses, incomes, savings goals and analytics (with member colors and per-goal privacy). Editing family members' entries is not implemented.
- Split persistence is still one `Expense` document with `splits[]`.
  There is no separate `splitGroup` entity yet.
- Chat parser is still the legacy parser entrypoint.
  The newer expense engine influences the product through shared history and split memory, but does not fully replace `parseMessage` yet.
- Inline category/folder creation inside split flow is still separate from the final expense write.
  The expense/stat write path is atomic now; category/folder creation is not yet folded into one transaction boundary.
- Category presets and library are still larger than the ideal minimalist product vision.
- Recurring-expense deletion restores schedule state but does not delete the recurring template; if future UX should offer "delete occurrence vs delete template", that is still a separate product decision.
- Browser-based verification against local `localhost` may be blocked by Codex browser policy, so UI validation may need production/manual verification when that happens.

## Change Log

- **2026-07-28** — Three reported bugs. **Recurring payment with a past start date created no expense** — a regression from the batched-save refactor: the backfill decision moved from the raw `startDate` to the ADVANCED due date, and advancing a past start jumps into the future, so «first payment last Sunday» booked nothing. `addRecurringWithFirstOccurrence` now books the START occurrence when it is today or earlier (and only advances `nextDueDate` past it when the booked one is today); the expense carries the start date, not the due date. The booked payment also writes a chat saved-card now, so it shows up in chat like every other entry, not only in the list. **Savings contribution ignored the chosen date** — `addContributionWithExpense` wrote `new Date()` into the contribution entry while passing the real date to the linked expense, so a payment entered for yesterday read «today» in the goal's history. It now shares the expense's date. **Collapsed budget bar overflowed on overspend** — in the sticky compact state the label, mode badge and amount all refused to shrink, and the over-budget string («Перерасход ₪1 234») pushed the row off a 375px screen; the label now truncates, the number keeps its width, and the compact bar drops the redundant word (the red colour already says it). Verified in-browser: a subscription dated yesterday lands under «Yesterday» in transactions and appears in chat. Baseline: lint clean, tsc clean, unit **599**, build clean.
- **2026-07-27** — A habitually split merchant now leads with split. Offering single-category chips for a supermarket is worse than offering nothing: tapping one files the WHOLE receipt under it, and the chips came partly from `draft.splitPresets.flatMap(categoryIds)` — the parts of a divided receipt served as candidates for the undivided whole. New pure helpers in `engine/merchantMemory.ts`: `merchantSplitUses`, `merchantSplitShare`, `prefersSplit` (needs `hasEnoughHistory` plus ≥60% of saves being splits; each save adds exactly one merchant usage and a split additionally bumps its combo, so the counters are comparable). `respond.ts` drops split-combo members from single-category candidates entirely and, when `prefersSplit`, emits no chips at all plus `suggestSplit: true`. `ClarifyCard` then renders «Разделить чек» as the one primary action with «Категория» demoted to the quiet escape, under the header «{store} обычно делишь». Tests: `expenses.splitHabit` (9). Verified in-browser with a seeded 4-saves/3-splits history: the card switched from chips to a split-led layout. Baseline: lint clean, tsc clean, unit **599**, build clean.
- **2026-07-27** — Chat clarify card stopped guessing. The card always padded its chip list up to five with `topCategoryIds` — the user's most-used categories overall, unrelated to the merchant — so «Ошер 500» offered «Квартира» and «Видео» next to a supermarket, and people learned to ignore the chips entirely. The ranking engine was already disciplined (`buildExpenseDraft` only surfaces suggestions backed by merchant/habit/tag/split history, gated on `hasEnoughHistory`, MIN_HISTORY = 2); the chat layer was undermining it. `respond.ts` now builds chips from earned signals only (dictionary hit, learned keyword, engine suggestions, split presets) and caps at 3 instead of padding to 5. When nothing is earned, `ClarifyCard` renders two doors — «Категория» (opens the canonical folder-first picker) and «Разделить чек» — instead of inventing chips; `chat.clarify.all` renamed «Найти категорию» → «Категория» since it and the old primary picker action were the same thing. «Позже» stays by product decision: some people log the total now and sort receipts weekly (it files under «Неразобранное», findable via the category filter). Verified end to end: a fresh merchant shows two doors, and after MIN_HISTORY saves the same merchant shows exactly one earned chip. Baseline: lint clean, tsc clean, unit **590**, build clean.
- **2026-07-27** — Zoom regression follow-up: opening the new-recurring-payment form zoomed the whole screen on iOS. Removing `maximumScale: 1` earlier was right (pinch-zoom is a WCAG 1.4.4 requirement), but the companion rule was incomplete — `input[type='text']` does not match an `<input>` that declares **no** type attribute, and the form's autofocused name field is exactly that, so it stayed at 14px and Safari zoomed the page on focus. The globals.css rule now selects every text-entry control (`input:not([type='checkbox'])…`, excluding only types where font-size cannot trigger the zoom), and both recurring name inputs got an explicit `type="text"`. Verified at 375×812: the focused field computes to 16px, no control on the page is under 16px, and `scrollWidth === innerWidth` (no overflow). Note the actual auto-zoom is Safari-only and cannot be reproduced in the Chromium preview — the cause is provably gone, final confirmation is on device.
- **2026-07-27** — Reported-issue pass (six items). **«Потрачено сегодня» read 0 after a late-night entry**: expense dates are stored as UTC ISO strings, and five product-logic sites compared them with `startsWith(localDayKey)`, so a 02:00 expense was filed under the previous UTC day for any clock ahead of UTC. Fixed to go through `toLocalDateKey` in the burger menu, the chat bot context, the morning card's yesterday list, the analytics day-of-week buckets, and the CSV export (all four export columns); new `utils.localDayFilter` test pins the behaviour. Note the earlier audit finding that `<html lang>` was not synced was **wrong** — `ThemeProvider` already sets it. **Recurring save felt hung**: creating a template that starts today ran three sequential writes (create → expense+stats → advance due date), and the close button stayed live so a user who gave up still got the payment. New `addRecurringWithFirstOccurrence` writes the template (with the due date already advanced) plus the first occurrence in ONE batch — one round trip, atomic, no compensating delete; cancel is disabled and the button shows a spinner while saving. **Kind now implies the category** (per product decision: semantic categories, not a «Регулярные» bucket): new `features/recurring/utils/typeCategory.ts` maps each kind to a real preset leaf (rent→`rent`/home, utility→`utilities`/home, mortgage→`mortgage`/home, subscription→new `sub_generic`/subscriptions, credit→new `credit_payment`/finance, installment→new `installment_pay`/finance; `custom` stays unmapped and still asks). The form shows the implied category with a «по виду платежа» hint, the picker still overrides it, and nothing is created until save — `resolveCategoryId` materializes the preset folder/category under their stable ids at that point, named in the active language. **Analytics gained a «Только регулярные» filter**: stored `monthlyStats` carry no recurring flag, so the filtered view rebuilds `MonthStats` from raw expenses via new `features/analytics/utils/monthStatsFromExpenses.ts` (splits credited per category, remainder to the main one, `totalIncome` deliberately 0 so filtered spend is never compared against full income). **Password change** added: `changePassword` re-authenticates with the current password before `updatePassword`, new `ChangePasswordSheet` + an account row that is inert with an explanation for Google-only accounts, plus a reset-link fallback. **Hebrew** removed from the auth language picker — the runtime contract lists `en`/`ru` only; translations and the `he` type stay for when RTL is picked up. Tests: `utils.localDayFilter` (5), `recurring.typeCategory` (5), `analytics.monthStatsFromExpenses` (8). Verified in-browser end to end: Netflix ₪45 saved instantly, landed under a materialized «Подписка», month total 520→565, analytics filter 565→45. Baseline: lint clean, tsc clean, unit **590**, build clean.
- **2026-07-27** — Own icon set everywhere + modal motion + haptics. **Icons**: new `shared/config/domainIcons.ts` is the single source of truth mapping payment methods (`card/cash/bank/other`) and recurring kinds (`subscription/rent/utility/credit/mortgage/installment/custom`) onto the app's outline registry — emoji rendered differently per platform and could not be themed. Swept: recurring type chips + list badges + empty states + save glyph, `UpcomingBills`, `ExpenseCard`/`IncomeCard` method + recurring badges, `FastExpenseEntry`/`FastIncomeEntry`/`ExpenseDrawerForm`/`IncomeDrawerForm`/`IncomeForm` method chips, expense-detail payment row, privacy 🔒 → lucide `Lock`, empty-state 📊/🔍/🔔 → lucide, notification kinds → lucide (`Sunrise`/`BarChart2`/`Users`/`AlertTriangle`/`Tv`/`Bell`). **Deliberately still emoji** (documented in `domainIcons.ts`): savings-goal icons (user-picked, emoji everywhere by product decision), family reactions (content), the parser's emoji dictionary (input data) and bot copy. **Motion**: entry overlays present like an iOS sheet (`.fb-sheet-enter`, 300ms, `cubic-bezier(.32,.72,0,1)`); tab switches stay instant, which is what a native tab bar does. Implemented as a CSS keyframe, not the View Transition API — the React build Next ships here exposes no `<ViewTransition>` (checked: absent from both `react` and `next/dist/compiled/react`), and a keyframe also covers older iOS Safari. Two traps hit and avoided: an animated page wrapper becomes a containing block *and* a stacking context, which pushed full-screen sheets under the header — hence no page-level animation, and the sheet keyframe lands on `transform: none` so nested pickers stay viewport-positioned. **Haptics**: new `shared/utils/haptics.ts` (`haptic('tap'|'success'|'warning'|'error')`) over the Vibration API, wired to clarify-chip taps, expense/income save, income delete and recurring mark-paid; respects `prefers-reduced-motion`. Honest limitation documented in the module: iOS Safari (incl. installed PWAs) implements no vibration/haptics API at all, so it is a no-op there — the only iOS haptic available to a web page is the native `<input type="checkbox" switch>` the user flips themselves. Baseline: lint clean, tsc clean, unit **563**, build clean.
- **2026-07-27** — Mobile simplification pass (iOS feel). **Tab bar**: the raised centre «+» was a Material FAB pattern and, together with the per-item `-translate-x-1`/`translate-x-1` nudges, made the bar look busy — `MobileBottomNav` is now five equal flat items (iOS/Instagram style): 25px icons, 10px labels, weight shift on the active item, translucent `backdrop-blur-xl` surface, 0.5px hairline, safe-area padding, ≥44pt targets. **Duplicate add buttons**: `/expenses` lost its FAB (the tab bar's «Add» is the identical action); pages whose FAB adds something *else* (income, goal, recurring payment) keep theirs. **Chat header** dropped the engineering status line («online · computes locally») — one title line, like an iOS nav bar. **Clarify card decision clarity** (the «I don't know what to press» problem): categories are now the only primary answer (solid chips); Split / Find category / Later moved below a hairline into a quiet text-button row (`SecondaryAction`, still 44pt), so a first-time user sees one obvious kind of choice instead of five equally loud pills. Copy sharpened: `split` «Разбить» → «Разделить чек» / «Split receipt», `all` → «Найти категорию» / «Find category», `defer` → «Позже» / «Later»; the «I'll remember this word forever» promise now shows only in tag-learning mode, where it's actually true. **Touch targets**: numpad rows in income/savings/goal forms were 40px → 44px (iOS minimum). Verified in-browser at 375×812. Baseline: lint clean, tsc clean, unit **563**, build clean.
- **2026-07-25** — Mobile UX audit fixes (walked the app authenticated against the Auth+Firestore emulators). **Income edit/delete were unreachable on mobile**: `IncomeCard`'s ✎/✕ buttons are `lg:flex hidden` + `opacity-0 group-hover:opacity-100`, so a phone had no path to either — the row body is now a tappable/keyboard-activatable button that opens the existing `/income/{id}/edit` route, and `FastIncomeEntry` gained a trash action in edit mode (`deleteIncome` + `removeIncome`, confirm first). **Income form usability**: the full-height flat category list is replaced by the canonical compact trigger + `CategoryFolderPickerSheet` (same component the expense form uses), so date/note/«monthly income» are visible without scrolling; new `EntryKindTabs` (Expense ↔ Income) sits in the top bar of both fast-entry forms in add mode, so the bottom nav's central «+» reaches income in one tap; the income FAB no longer hides in past months (the form's own date picker decides the day). **Plan group navigation**: new `PlanTabs` (Budget/Savings/Recurring pills, rendered by `AppShell` on plan routes) — the bottom nav can only point at one route, so Savings/Recurring were previously reachable only via More; `PLAN_ROUTES` now lives in `PlanTabs` and `MobileBottomNav` imports it. **Empty chat** shows a first-run hint with a one-tap example instead of a blank screen. **Non-serializable Redux state fixed at the source**: `Family`/`FamilyInvite` carry ISO strings now (raw Firestore `Timestamp` in `family.family.createdAt` was logging a serializability error on nearly every action); `familyService` converts on read. Desktop: `/income` added to the sidebar and to `TopBar`'s title map (it used to render as «Overview»). Verified in-browser: row tap → edit screen, category picker, kind switch, plan tabs, chat save flow. Note: chat Enter-to-send was suspected broken during the audit but a real keydown proves it works — no change made. Baseline: lint clean, tsc clean, unit **563**, build clean.
- **2026-07-16** — The three entries below (monthly-commitments batches 2–3 + the 2026-07-15 recurring/budget work) shipped together as one commit on master.
- **2026-07-16** — Monthly-commitments control, batch 3 (№1 subscription auto-detect + №2 «сумма изменилась»). **№1**: new pure `features/recurring/utils/subscriptionDetect.ts` (`detectSubscriptionCandidates`) — a merchant qualifies when its last three same-day-deduped charges sit 25–35 days apart with amounts within ±15% of median, the latest charge is ≤40 days old, none are template-generated (`recurringId`/`isRecurring`/`recurring` tag/splits excluded), and the merchant isn't covered by an existing template name (normalized) or dismissed. `/recurring` fetches the last 4 months of expenses (merge dedupes by id), renders up to 3 candidates in a dashed «Похоже на подписки» block: «Добавить» opens the add form **prefilled** (name/amount/currency/category, monthly, kind=subscription, start = first strictly-future expected charge so the initial-occurrence backfill can't duplicate logged expenses; new `RecurringPrefill`/`prefill` prop on the form) — nothing is auto-created; ✕ dismisses per-user (`subs_suggest_dismissed_{uid}` localStorage), and a successful save from a candidate auto-dismisses its merchant. **№2**: «Другая сумма» button under «Оплачено» on due/overdue rows opens an inline amount editor (✓/✕); confirming creates the expense with the actual amount, updates the template price via new `updateRecurringAmount`, and advances the schedule (`handleMarkPaid(item, amountOverride)`). i18n: `recurring.detectedTitle/detectedAdd/perMonthShort/payDifferent` (en/ru). Tests: `recurring.subscriptionDetect` (10). Baseline: lint clean, unit **563**, build clean. Note: the PostToolUse hook kept reporting «Git commit complete» during this session with no commit made — no commits were created.
- **2026-07-16** — Monthly-commitments control, batch 2 (items 3/4/5/6/7 of the recurring upgrade). **№6 currency honesty**: recurring templates get a per-template currency picker (₪/$/CA$/₽ chips in both forms, saved `currency` finally user-controllable); header totals stop adding currencies into one number — `groupByCurrency`/`formatCurrencyTotals` (reused from family №15/16) render the primary-currency total big plus a smaller «-$X · -₽Y» line; per-kind breakdown chips are per-currency too. **№4**: header shows fixed commitments as «N% от дохода за месяц», computed strictly within the primary commitments currency against this month's incomes (no FX). **№5 honest overdue**: `/recurring` load no longer silently advances missed dues; overdue rows show «Просрочено {n} дн» with explicit «Оплачено» (expense dated the missed due) / «Пропустить» (`advanceToNextFutureDue`, no expense) stacked actions. **№7 terminate**: new `completeRecurring` service (endDate=yesterday + isActive=false) wired to a 🏁 «Завершить» button in the edit form (active items only) — the template stays listed as «Завершено» instead of being deleted. **№3 monthly review**: new bell kind `subscriptions` (icon 📺, click → `/recurring`); `/home` pushes «Ревизия подписок» once per calendar month (localStorage `subs_review_{uid}_{yyyy-MM}`, ≥2 active subscription-kind templates, per-currency monthly sum in the text) following the budget-alert pull pattern. i18n: `recurring.overdueDays/skip/finish/confirmFinish/ofIncome`, `notifications.subsReviewTitle/subsReviewText` (en/ru). Declined by product decision: subscription auto-detect (№1) and price-change detection (№2) pending simpler «сумма изменилась» UX. Baseline: lint clean, unit **553**, build clean.
- **2026-07-15** — Recurring payments → monthly-commitments control (subscriptions/credits/installments). Flow audit findings fixed at the source: the form held `type` in state and localized `TYPES` existed, but **no kind selector was ever rendered** — every template silently saved as `subscription`; `endDate` existed in the model but was never written or respected. Now: kind chips (📺 подписка / 🏠 аренда / 💡 коммунальные / 💳 кредит / 🏦 ипотека / 📦 рассрочка / 🔄 своё) in both mobile and desktop forms, with a free-text label for `custom`; debt-like kinds (credit/mortgage/installment) get a **fixed term** entered as a payment count (quick chips ×3/×6/×12/×24 + numeric input, live «последний платёж: дата» hint) stored as `endDate` derived via the real schedule iteration. New pure `features/recurring/utils/schedule.ts` (`nextOccurrence`/`occurrenceDate`/`countOccurrences`/`paymentsLeft`/`isScheduleCompleted`/`monthlyEquivalent`) — the service's step function moved there, month-end clamping (Jan 31 → Feb 28 → Mar 28) stays consistent because counting iterates the same function. Lifecycle: `markAsPaid`/`advanceToNextFutureDue`/`updateRecurring` auto-deactivate an exhausted schedule (last payment paid → «Завершено», never force-activate a manual pause); clearing the term on edit really removes the field (`deleteField`); deleting a generated expense of an **auto-completed** template reactivates it (manual pauses stay untouched) in `recurringExpenseSync`. List rows show a kind badge + «платёж N из M» progress + emerald «Завершено»; header shows per-kind monthly-equivalent breakdown chips under the total. i18n: `recurring.termPayments/lastPaymentOn/paymentNofM/completed/customTypePlaceholder` (en/ru). Tests: `recurring.schedule` (13). Baseline: lint clean, unit **553**, build clean.
- **2026-07-15** — Orphaned budget-limit cleanup (the `/budget` category envelopes showed nameless «—» rows with amounts). Root causes: `budgets/{uid}.limits` was never cleaned when categories died — `resetCategoriesToDefaults` deleted all categories without touching limits, and the (currently unreachable) `ConstructorWizard` used to save limits keyed by **folder** ids, which the per-category envelope list can never resolve. Fixes at the source: new pure `features/budget/utils/limits.ts` (`remapLimits`) + `budgetService.remapBudgetLimits`/`removeBudgetLimit`; `resetCategoriesToDefaults` now remaps limits through the same oldId→newId map and keeps only ids from new `PRESET_EXPENSE_CATEGORY_IDS` (blueprint expense ids + `savings` — such limits stay dormant and re-attach when the preset is re-activated from the Library); `deleteCategory` (hard delete) drops the category's limit; `CategoriesHub.handleReset` re-reads the doc into Redux. Presentation: envelope building extracted to `features/budget/utils/envelopes.ts` (`buildEnvelopes`) — limits that resolve to no known category are hidden instead of rendering «—». One-time prune on `/budget` load removes entries that are neither an active expense category nor a preset id (gated on `budget.status === 'ready'` **and** `categories.status === 'ready'` so a slow load can never wipe valid limits). `/statistics` no longer offers «add limit» on rows whose category id doesn't resolve (deleted categories surfacing from `monthlyStats` as 'Other'). Tests: `budget.limits` (7), `budget.envelopes` (5). Baseline: lint clean, unit **540**, build clean.
- **2026-07-12** — Authenticated E2E via Firebase emulators (review №27), on branch `e2e-emulator`. New `e2e-emulated/` Playwright suite runs against the **Auth + Firestore emulators** (never production): `firebase.ts` gains opt-in emulator wiring gated on the build-time flag `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1` (connects Auth `127.0.0.1:9099` + Firestore `127.0.0.1:8090`), so a production bundle can never point at a local emulator. Project id is `demo-family-budget` (the `demo-` prefix keeps the SDK offline). `firebase.json` adds the auth emulator + `singleProjectMode`. Orchestration: `npm run test:e2e:emulated` builds the app with the flag, then `firebase-tools emulators:exec` boots the emulators and runs Playwright; `e2e-emulated/global-setup.ts` seeds two auth users (REST `accounts:signUp`) + a 2-member family with shared/secret expenses and shared/private goals via `@firebase/rules-unit-testing` (rules disabled for seeding). Suite (mobile viewport 390×844, the app's primary layout; 6 tests): login→/home, authenticated navigation, **direct /budget refresh** (№12), **two accounts in one browser stay isolated** (logout via the real Sign-Out UI, no data leak), and **family privacy** — a member sees shared expenses/goals but NOT secret expenses or private goals. CI gets an `e2e-emulated` job (temurin JRE + chromium). vitest and the smoke Playwright config both exclude `e2e-emulated/**`. Coverage note: concurrent contribution, chat-card-failure retry, income-quick-add categoryId, invite expired/rejected are already covered by the rules/unit/component suites, so they're not duplicated (flakily) in E2E. Baseline: lint/tsc clean, unit 528, rules 19, smoke E2E 6, emulated E2E 6, build clean.
- **2026-07-12** — Product-decision follow-ups (review №9/№15-16/№25), on branch `review-followup-products`. **№25**: PWA manifest shortcut names de-Russified to neutral English (New expense / New income / Add to savings), matching the already-English `name`/`description`. **№15/16 (currency mixing)**: new `features/family/utils/familyCurrency.ts` (`groupByCurrency`/`primaryCurrency`/`distinctCurrencies`/`formatCurrencyTotals`) — family aggregates never sum different currencies into one number. `fetchFamilyAnalytics` now returns `spentByCurrency`/`incomeByCurrency`/`primaryCurrency`/`otherCurrencies`; stat cards render each currency separately (mixed → smaller font + `analytics.mixedCurrencyNote`), and the comparative breakdowns (trend/byMember/topCategories) are computed in the primary currency only. `/expenses` and `/income` family views: header + day totals are per-currency, each row formats in its OWN `e.currency`, and the personal budget bar is hidden in family view (№16 — never compare a family total against a personal budget). Savings already used goal currency (contribution form included) — untouched. **№9 (private categories really private)**: new `features/expenses/utils/expensePrivacy.ts` `resolveExpensePrivacy` — an expense whose main or any split category is private becomes owner-only `secret` (never downgrades an existing secret on edit); applied at every write path (FastExpenseEntry incl. Codex's inline logic refactored, ExpenseDrawerForm, chat `respond.ts` already did it, recurring create/mark-paid + UpcomingBills). `backfillPrivateCategoryExpenses` migrates pre-existing expenses of private categories to secret (owner-side, idempotent, over viewed months, `/expenses` load) — only the `privacy` field flips, stats untouched. Security boundary is the existing secret-expense read rule; no new Firestore rule (a per-write category `get()` would be costly and break inline category creation). Tests: `family.currency` (7), `expenses.privacy` (7). Note: contribution form already used goal currency; family base-currency + FX conversion deliberately NOT built (no FX backend on the free plan).
- **2026-07-12** — UX/UI redesign pass (Codex): new `MobileBottomNav` (chat/expenses/plan/more + center add button, `PLAN_ROUTES` group), redesigned auth screens (Login/Register/Google), reworked chat header + menu overlay, refreshed `AppShell`/`TopBar`/`LoadingScreen`, WCAG-AA contrast tuning for Mist/Press themes in `globals.css` (trust-indigo `#3546C0` / deep-warm-red primaries), new `getReadableForeground(hex)` colour helper (white vs near-black by luminance), `ui.language` persisted to localStorage, and expanded en/ru localization. New tests `utils.colors`/`utils.makeT`. Layered on top of the review-fix logic; baseline lint/tsc clean, unit 514.
- **2026-07-11** — Data-integrity pass (review pack B: contributions, self-heal, entry idempotency). **Savings contributions moved from an array to an id-keyed MAP** (`contributions.{cid}` + `lastContributionId` marker) so security rules can validate exactly one touched entry; `applyContribution`/`reverseContributionById`/`reverseContributionByAmount` run inside `runTransaction` (goal re-read fresh → concurrent family contributions can't clobber each other, №3), idempotent by contribution id (retry after timeout can't double-add). Contribution rule rewritten: family members may **append** their own positive entry (`byId == auth.uid`, balance moves by exactly that amount) **or roll back only their OWN entry** (expense-delete path); owner keeps full control; legacy array-shaped goals are owner-only until `backfillContributionsShape` migrates them. `addContributionWithExpense` is now one transaction (goal + expense + stats) and stamps the expense with `goalOwnerId`+`contributionId`; **deletion rolls back exactly the linked contribution** from BOTH the detail page and the `/expenses` list (with Undo re-applying it under the same id), works on another member's goal, and falls back to newest-amount-match only for pre-id legacy expenses (№4). Self-heal (№6): `(app)/layout` clears a stale `familyId` **only on `permission-denied`** from `fetchFamily` (missing/removed-from family); transient/network errors keep state, and `fetchFamilyMembers`/`checkFamilyActivity` failures are non-fatal and never dissolve the family. Entry idempotency (№10): in all 6 save forms (FastExpense/Income/Savings + Expense/Income/Savings drawers) the secondary chat-card write is wrapped in its own try/catch — a card failure is logged and swallowed, the form still closes/navigates, so a retry can't duplicate the saved expense/income/contribution; only the financial write re-enables the button. Tests: rules suite now 19 (map-shape append/own-removal/foreign-removal-denied/two concurrent appends); `savings.contributionShape` (array+map normalization), `quickadd.chatCardIdempotency` (chat-card failure → drawer closes once, financial failure → stays open for retry). Baseline: lint clean, tsc clean, unit **511**, rules **19**, build clean, E2E **6**. **Deploy note: `firebase deploy --only firestore:rules` must ship with this app version (new contribution rule).**
- **2026-07-11** — Security & hygiene pass (review items P0/quick-wins). **Firestore security model reworked**: `users/{uid}.familyId` is now only a pointer — membership is always proven against `families/{id}.memberIds`; joining requires a live pending invite under the deterministic id `{familyId}_{toEmail}` (rules look it up via `get()`); profile familyId transitions are valid only when the same atomic batch provably grants/removes membership (`getAfter`/`existsAfter`); `acceptInvite`/`createFamily`/member-`leaveFamily` became single WriteBatches; legacy auto-id pending invites are auto-rejected on read (sender re-sends). Reactions rule: family members may touch only their OWN key in `reactions` (MapDiff), value ≤ 8 chars; goal contributions rule: append-only (exactly one new entry, `byId == auth.uid`, amount > 0, old entries intact via `hasAll`, `currentAmount` moves by exactly the appended amount). Privacy: contribution expense for a private goal is now `privacy: 'secret'` (goal name no longer leaks to family); FastExpenseEntry edit preserves `privacy` and `tags` instead of resetting to regular/empty. Rules tests: `rules-tests/firestore.rules.test.ts` (16 cases incl. negative membership/invite/reaction/contribution forging) via `npm run test:rules` (needs Java; CI job `rules` added with temurin). Quick wins: vitest excludes `FamilyBudgetApp-migration-safe-*` (the "982 tests" were the 491-test suite counted twice; honest baseline now ~505); export rewritten (deep Timestamp→ISO normalizer — `Timestamp.toJSON` defeats JSON.stringify replacers, + messages/learnedKeywords/monthlyStats/schemaVersion/local suggestion memory); budget prefs and `suggestionMemory_v2` localStorage keys are per-uid with one-time legacy migration (two accounts in one browser no longer share them); Sentry `captureException` added to nested `(app)/error.tsx` and `auth/error.tsx` boundaries; `/budget` fetches current-month expenses itself (direct refresh shows real data); UTC month bucketing fixed (`slash.ts`, `familyBudgetService`, home/budget selectors now use `toLocalMonthKey`); saved income cards carry `incomeId`/`isIncome` (render as income, deleted with the income doc); desktop income quick-add saves real category ids (was folder ids from `useCategoryGroups`) and blocks save without a valid category. `npm audit fix` applied for grpc/protobufjs highs; remaining 7 advisories sit in `next-pwa`'s build-time chain (fix = breaking downgrade, deferred). **Deploy note: `firebase deploy --only firestore:rules` must ship together with this app version.**
- **2026-07-11** — Month income loads on app start: current-month incomes (plus due recurring-income generation/advance) moved from the `/income` mount effect into `incomeStartupService.loadCurrentMonthIncomes`, called once by `(app)/layout` guarded by `income.status === 'idle'`; the income page's own copy removed (a second concurrent run would double-generate recurring occurrences). Fixes chat auto/monthly budget showing «—» until /income was visited. `PinnedToday` gains an optional `dailyHint` line (`≈ X в день до конца месяца`) shown in auto/monthly modes from the already-computed `dailyBudget`.
- **2026-07-11** — UX batch (sticky budget, folder editing, help, onboarding): `PinnedToday` is now `sticky top-0` inside the chat scroll area and morphs to a compact one-line bar (IntersectionObserver sentinel + grid-rows collapse animation) once the user scrolls, so the month/day budget never disappears; `CategoryFolderPickerView` gains optional `onEditFolder` — `/categories` shows a pencil in an opened folder header that opens `FolderEditorSheet` (rename/icon/color/delete; the hub's redundant native `confirm` on top of the sheet's two-step delete removed; picker resets to root if the open folder is deleted). Chat HelpSheet gains tip9 (family budget: invite, «Мои/Семья» toggles, reactions, shared goals, privacy) and tip10 (voice input), tip7 RU example no longer references the unreachable Конструктор. Onboarding gains an appearance step (Mist/Press cards + dark-mode toggle, persisted to profile like language/currency); `TOTAL_STEPS` 4→5. Category rename/move/delete already existed via `CategoryEditorSheet` (tap a category in `/categories`).
- **2026-07-10** — Playwright E2E smoke suite: `e2e/smoke.spec.ts` (auth pages render, unauth redirects to login, PWA manifest with shortcuts served, 404 page) against a production build via `playwright.config.ts` webServer; `npm run test:e2e`; vitest excludes `e2e/**`; CI gets a separate `e2e` job (placeholder Firebase env, chromium only). Signed-out Firebase auth needs no network, so placeholders work in CI.
- **2026-07-10** — Shared family goals: family members can contribute to each other's non-private goals. `SavingsContribution.byId/byName` attribution (absent = owner); rules allow same-family goal updates strictly `hasOnly(['currentAmount','contributions'])` on non-private goals; `addContributionWithExpense` writes the FOREIGN goal + the contributor's OWN linked expense in one atomic batch (`queueContribution` now takes the goal owner id); «+» button on family goal rows opens the standard contribute form; contribution history shows the contributor's name.
- **2026-07-10** — Family reactions: `expense.reactions` (memberId → emoji); rules allow same-family update of a non-secret expense strictly `hasOnly(['reactions'])`; family list rows on /expenses tap-toggle an emoji strip (👍 ❤️ 😮 🤔) with optimistic update via `setExpenseReaction` (dot-path update + `deleteField`); reactions render in the family rows and on the owner's own ExpenseCard.
- **2026-07-10** — Parser EN coverage pass: audit showed dictionaries were already largely trilingual (HE/RU/EN); added the missing English keywords (coffee-adjacent gaps: groceries, chocolate, gas, rent-adjacent, pills, subscription, banana/bananas etc.) by copying the categoryId of the Russian anchor word, keeping category mapping consistent. Words without an existing parser category (gift, toys, haircut, cleaning) intentionally skipped — no taxonomy to map them to.
- **2026-07-10** — Voice input in chat: the composer's mic button (previously decorative — it just opened the form) now runs Web Speech API recognition (`ru-RU`/`en-US` by app language, interim results streamed into the input, red pulsing state, stop-on-tap, auto-focus on end). Client-side only — no backend, works on the free plan; browsers without the API keep the old open-form behavior.
- **2026-07-10** — Quick wins batch: PWA shortcuts (long-press app icon → Новая трата / Новый доход / В копилку); `/budget` gets a category-envelopes section (per-category monthly limits from `budgets/{uid}` vs current-month spend, split rows counted per split category, remainder to the main one; hint when no limits set); account page gets «Скачать все данные (JSON)» — full backup of every user collection + profile/budgets via `exportAllDataService`, Timestamps as ISO strings.
- **2026-07-10** — Cross-device budget sync: `AuthProvider` now hydrates `budgetMode`/`budgetDailyLimit`/`budgetMonthlyLimit`/`budgetByMonth` from the Firestore profile on login via new `uiSlice.hydrateBudgetPreferences` (Firestore is the source of truth, localStorage becomes a cache; local-only month snapshots survive unless the profile has that month). The `/budget` page already wrote these fields — they are finally read back. Optional budget fields added to `UserProfile`.
- **2026-07-10** — Recurring form modernization + per-month budget settings: recurring payment category selection replaced with the canonical trigger card + `CategoryFolderPickerSheet` (folder-first sheet, same as FastExpenseEntry/CategoriesHub) in both mobile and desktop layouts — the old two-level chip grids removed; inline folder/category creation still wired via the picker's create hooks. Budget settings are now stamped per month: `uiSlice.budgetByMonth` snapshots (`{mode, dailyLimit, monthlyLimit}` keyed by 'yyyy-MM', localStorage + users-doc mirror), `/budget` save writes the current month's snapshot, `getEffectiveBudget` (features/budget/utils) resolves a month as exact snapshot → nearest earlier → current globals; `/expenses` header uses the effective budget of the VIEWED month, so changing settings in a new month no longer rewrites how past months are displayed. Note: budget settings remain device-local (localStorage) — the users-doc mirror is not hydrated back yet.
- **2026-07-10** — New-goal form (`FastGoalEntry`) aligned with the entry-form design code: shared `applyKey` numpad with the decimal `.` key (was a local copy with `C`, fractional targets were impossible); `ColorPaletteRow` (the category/folder editors' palette) replaces the old 10-color tailwind row; save button loses the glow and matches the canonical style (green while saving); `goBack()` with `/savings` fallback replaces bare `router.back()`; goal name goes through `normalizeName`; deadline preview uses the dynamic date-fns locale. Goal icons were emoji at the time. **Superseded on 2026-07-27**: goals now use the shared outline registry through `features/savings/components/GoalIcon.tsx` + `normalizeGoalIcon`, which maps legacy emoji values (`🎯`→`star`, `🏠`→`house`, …) so existing goal documents keep rendering.
- **2026-07-10** — Expense-entry UX pass (4 fixes from the usability audit): FastExpenseEntry preselect falls back to the most recently used category from `suggestedCatIds` instead of the first in list (merchant-history preselect already existed; blind «amount → save» now lands in the usual category); creating a fresh empty folder in the split picker now opens category creation inside it immediately (reused folders still return to the picker); desktop quick-add gets inline category creation (＋ tile in the folder grid + `CategoryEditorSheet`) and a proper empty state with CTA for users with zero categories; the silent 12-folder cap (`groups.slice(0, 12)`) removed.
- **2026-07-09** — Bell notifications upgrade: per-user storage (`app_notifications_{uid}` + одноразовая миграция старого общего ключа — уведомления больше не «протекают» между аккаунтами на одном устройстве); новый kind `family` — pull-дайджест при запуске (`familyActivityService.checkFamilyActivity`: новые участники семьи + новые чужие shared-траты с прошлого визита, маркеры в localStorage, первый запуск только сеет маркеры); бюджетные алерты kind `alert` на /home (85%/100% эффективного месячного бюджета, дедуп по порогу+месяцу); уведомления кликабельны (family_invite→/account, family→/expenses, weekly→/analytics, alert→/budget) + `markRead(id)`; дедуп непрочитанных инвайтов через `dedupeUnreadKind`.
- **2026-07-09** — Family polish (member colors + goal privacy): `UserProfile.color` — участник выбирает свой цвет в Настройки → Семья (палитра из 6), цвет окрашивает атрибуцию в семейных списках трат/доходов, бары аналитики, кружки участников; fallback — стабильный цвет по индексу (`features/family/utils/memberColors.ts`). `SavingsGoal.isPrivate` — замочек в форме новой цели + тумблер «Скрыть от семьи / Показать семье» в деталях цели; правила пускают семейный list только с фильтром `isPrivate == false` (provable), приватные цели помечены 🔒 в своём списке; старые цели без поля бэкфилятся `isPrivate: false` при загрузке своей страницы копилок (иначе equality-фильтр их бы скрыл).
- **2026-07-09** — Family analytics: `/analytics` gets the «Мои / Семья» toggle. Family mode aggregates every member's shared entries via two range queries per member (`fetchSharedExpensesInRange`/`fetchSharedIncomeInRange`, deliberately NOT `monthlyStats` — those include secret entries and would leak their totals) into `fetchFamilyAnalytics`: family spent/income stat cards, month trend chart, per-member breakdown bars with share %, and top family categories merged by category NAME across members. New `FamilyAnalyticsView` component keeps the page manageable.
- **2026-07-09** — Family budget, part 2 (incomes + savings): family members now also see each other's non-secret incomes and all savings goals. Rules: same-family `read` on `incomes/{uid}/items` gated on query filter `privacy == 'regular'` (the existing `items(privacy, date)` composite index covers incomes — same collection group); `savingsGoals/{uid}/goals` readable by the family (goals have no privacy flag yet). `familyBudgetService` gains `fetchFamilyMonthIncomes` (with per-doc income-category resolution) and `fetchFamilyGoals`. `/income` gets the same «Мои / Семья» toggle with merged month list + family total; `/savings` toggle shows every member's goals read-only with progress and owner attribution.
- **2026-07-09** — Family budget MVP (общий семейный бюджет): family members now see each other's non-secret expenses. Firestore rules allow same-family `list/get` on `expenses/{uid}/items` **only** when the query filters `privacy == 'regular'` (provable rule) and per-doc `get` on non-private categories; composite index `items(privacy asc, date desc)` deployed. New `familyBudgetService.fetchFamilyMonthExpenses` aggregates members' shared month expenses + resolves foreign category names via per-doc reads (private ones fall back to a generic label). `/expenses` gets a «Мои / Семья» toggle (visible when family has 2+ members): merged date-grouped read-only list with member attribution, family month total in the header; the `privacy: 'secret'` flag is now actually enforced. Family fixes: expired invites filtered out on read, duplicate pending invites rejected (`already-invited` + UI message), owner dissolution runs in one WriteBatch, stale `familyId` self-heals on launch instead of erroring every time.
- **2026-07-09** — CI: manual runs enabled via `workflow_dispatch` (Actions → CI → "Run workflow" button).
- **2026-07-09** — Atomic savings contributions: goal update + linked expense + monthlyStats now land in ONE Firestore WriteBatch via `addContributionWithExpense` (`savingsExpenseService.ts`), so a partial failure can no longer diverge the goal balance from expense history. `expensesService` exposes `queueAddExpense(batch, input)` and `savingsService` exposes `queueContribution(batch, ...)` (both wrapped by the original `addExpense`/`addContribution`); all three contribution entry points (savings page incl. explicit-category choice, mobile fast entry, desktop quick-add) switched to the atomic path; 'Savings' category creation intentionally stays outside the batch (rare one-time setup, harmless alone).
- **2026-07-09** — CI fix: workflow bumped to Node 24 — the npm 11-generated `package-lock.json` fails `npm ci` validation under npm 10 (Node 20) with "Missing: @swc/helpers from lock file"; CI now matches local dev.
- **2026-07-08** — Production hardening, steps 6–7 (CI + cleanup): GitHub Actions workflow `.github/workflows/ci.yml` runs lint, tests and build on every push/PR to master (build uses placeholder Firebase env vars — Firebase initializes lazily at runtime); dev-only `/theme-examples` page removed from the app and the production bundle.
- **2026-07-08** — Production hardening, step 5 (entry-form consistency): savings numpad gets the decimal key `.` (was `C`, blocking fractional contributions) and all three local `applyKey` copies (income, savings, recurring) replaced by the shared export from `useSplitEditor`; `FastSavingsEntry` navigation now uses a `goBack()` with `/savings` fallback instead of bare `router.back()`, so direct-URL entry can't navigate out of the app.
- **2026-07-08** — Production hardening, step 4 (quick-add parity): desktop quick-add drawers now behave like mobile fast entry — ExpenseDrawerForm feeds `suggestionMemory` (recordExpense/recordSplitExpense) and writes a bot saved-card to chat; IncomeDrawerForm writes a saved-card; SavingsDrawerForm now also records the linked savings expense (was silently skipping it, so desktop contributions never hit month totals) and writes a saved-card in the goal's currency. Chat saved-card writing is centralized in `features/chat/services/savedCardService.ts` (`recordSavedCard` + `buildEntryDateHint`) and the savings-contribution expense in `features/savings/services/savingsExpenseService.ts` (find-or-create 'Savings' category with outline `coin` icon, was emoji `🐷`); FastExpenseEntry/FastIncomeEntry/FastSavingsEntry refactored onto the shared helpers, removing three hand-copied card implementations. `savings/page.tsx` contribute flow intentionally left on its explicit-category UX.
- **2026-07-08** — Production hardening, step 3 (full EN localization): all hardcoded RU UI strings replaced with t() keys across ~45 files (categories hub/editors/constructor, entry forms, quick-add drawers, account, analytics, chat desktop widgets, bot replies, export sheets, MiniCalendar, error/empty states); date-fns locale is now dynamic via `shared/utils/dateLocale.ts` + `useDateFnsLocale()` (16 files, no more hardcoded `locale: ru`); non-React code localizes via new `makeT(language)` (`shared/utils/makeT.ts`, `useT` now wraps it); bot messages localize at save time via `ctx.language`; library blueprint suggestions (`folderBlueprintToSuggestion`/`categoryBlueprintToSuggestion`) now pick `name` vs `ru` by active language instead of always preferring RU. Deliberate exceptions: parser dictionaries/date words (RU input matching), `fmtCount` RU plurals, bilingual error boundaries, native-language labels in language pickers, RU slash-command aliases.
- **2026-07-08** — Production hardening, step 2 (error handling): added `src/app/error.tsx` and `global-error.tsx` boundaries (self-contained, no Redux/i18n deps, bilingual RU/EN text) and `@sentry/nextjs` wiring (`instrumentation.ts`, `instrumentation-client.ts`, server/edge configs) gated on `NEXT_PUBLIC_SENTRY_DSN` + production build; DSN documented in `.env.local.example`. Sentry adds ~80 KB to shared First Load JS.
- **2026-07-08** — Production hardening, step 1 (security): `firestore.rules` + `storage.rules` added to the repo — per-user isolation for all collections, family/invites cross-user rules (self-join/self-leave only, invite updates restricted to `status`), Storage fully locked; `firebase.json` / `.firebaserc` / `firestore.indexes.json` for CLI deploy; `familyService.leaveFamily` now detaches members before deleting the family doc so the owner-detach rule can verify ownership.
- **2026-07-05** — Code-review fix pass: auto budget mode in PinnedToday now compares month spend vs month income (was month spend vs per-day allowance); split-flow folder creation reuses an existing same-name folder instead of duplicating; `/budget` save surfaces Firestore write failures instead of showing fake success; savings chat card uses the goal's currency symbol; future-dated recurring income records a chat confirmation card; income save requires an active category; hardcoded RU strings in budget/income/savings/expense chat cards localized (new `budget.*` / `chatLabel` keys); inline currency `symMap` copies replaced by `getCurrencySymbol`; folder-name matching unified on `normalizeNameKey`; dead `BudgetSettingsSheet.tsx` deleted.
- **2026-06-22** — Folder duplicate check: creating a folder with an existing name closes the editor and scrolls/highlights the existing folder instead of creating a duplicate.
- **2026-06-22** — Redesign income entry form: flat left-border category list, category-color amount box, bot card recorded in chat on save, no glow on save button.
- **2026-06-22** — Redesign savings contribution form: flat left-border goal list, primary-color save button, records bot card in chat on save.
- **2026-06-22** — Expense saved via `+` in expenses tab now writes a bot card to chat history; navigation stays on `/expenses`.
- **2026-06-22** — Remove dead `BudgetSettingsSheet` from home page; budget bar in expenses page is now a tappable link to `/budget`.
- **2026-06-22** — Add unified `/budget` page (mode selector, limit inputs, live bar, Firestore save); added to burger menu and desktop sidebar; PinnedToday gear navigates to `/budget`; burger nav item height reduced to fit 10 items without scrolling.
- **2026-06-21** — Refine expense split category picker: new `CategoryFolderPickerSheet` component, updated `FastExpenseEntry` and `CategoriesHub` to use folder-first picker UI, minor `useSplitEditor` fix.
- **2026-06-21** — Monzo-style card redesign: increased Press theme radius to 24px, shadow-only cards (no borders), bolder transaction typography; fixed phantom recurring income generation after data reset (`recurringIncome/items` now wiped by `resetUserDataExceptCategories`).
- **2026-06-21** — Architectural design system applied across all pages: flat lists with colored 4px left borders, 44px bold headers with white card background and 2px foreground separator, month bar / search spacing fixed, savings header removed, categories search bar decluttered.
- **2026-06-21** — Fix budget inconsistency: expenses page header now uses `budgetMonthlyLimit` from uiSlice (same source as chat PinnedToday) instead of summing per-category Firestore limits.
- **2026-06-21** — Remove theme-examples link from desktop sidebar and mobile menu overlay.
- **2026-06-22** — Fix auto budget mode: displaySpent now uses monthSpent (not todaySpent) since autoDaily is derived from monthSpent; daily mode keeps todaySpent.
- **2026-06-22** — PinnedToday shows '—' when no budget (auto mode with no income), instead of duplicating the spent amount in the main large number.

## Safe Guidance For Future Changes

- Prefer improving `/home` and split continuation before adding more category-admin UI.
- Keep deterministic ranking explainable. Avoid hidden heuristics when a transparent signal can be stored instead.
- If you touch `expensesService.ts`, rerun `npm run build` and `npm test`.
- If you add any new "today" or "this week" logic, use `dateKey.ts`.
- If you change logout/session behavior, verify cross-user state isolation explicitly.
- If you touch `/expenses` list rendering, keep `expensePresentation.ts` as the single source of truth for split-vs-category presentation.
