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

- **2026-07-10** — Voice input in chat: the composer's mic button (previously decorative — it just opened the form) now runs Web Speech API recognition (`ru-RU`/`en-US` by app language, interim results streamed into the input, red pulsing state, stop-on-tap, auto-focus on end). Client-side only — no backend, works on the free plan; browsers without the API keep the old open-form behavior.
- **2026-07-10** — Quick wins batch: PWA shortcuts (long-press app icon → Новая трата / Новый доход / В копилку); `/budget` gets a category-envelopes section (per-category monthly limits from `budgets/{uid}` vs current-month spend, split rows counted per split category, remainder to the main one; hint when no limits set); account page gets «Скачать все данные (JSON)» — full backup of every user collection + profile/budgets via `exportAllDataService`, Timestamps as ISO strings.
- **2026-07-10** — Cross-device budget sync: `AuthProvider` now hydrates `budgetMode`/`budgetDailyLimit`/`budgetMonthlyLimit`/`budgetByMonth` from the Firestore profile on login via new `uiSlice.hydrateBudgetPreferences` (Firestore is the source of truth, localStorage becomes a cache; local-only month snapshots survive unless the profile has that month). The `/budget` page already wrote these fields — they are finally read back. Optional budget fields added to `UserProfile`.
- **2026-07-10** — Recurring form modernization + per-month budget settings: recurring payment category selection replaced with the canonical trigger card + `CategoryFolderPickerSheet` (folder-first sheet, same as FastExpenseEntry/CategoriesHub) in both mobile and desktop layouts — the old two-level chip grids removed; inline folder/category creation still wired via the picker's create hooks. Budget settings are now stamped per month: `uiSlice.budgetByMonth` snapshots (`{mode, dailyLimit, monthlyLimit}` keyed by 'yyyy-MM', localStorage + users-doc mirror), `/budget` save writes the current month's snapshot, `getEffectiveBudget` (features/budget/utils) resolves a month as exact snapshot → nearest earlier → current globals; `/expenses` header uses the effective budget of the VIEWED month, so changing settings in a new month no longer rewrites how past months are displayed. Note: budget settings remain device-local (localStorage) — the users-doc mirror is not hydrated back yet.
- **2026-07-10** — New-goal form (`FastGoalEntry`) aligned with the entry-form design code: shared `applyKey` numpad with the decimal `.` key (was a local copy with `C`, fractional targets were impossible); `ColorPaletteRow` (the category/folder editors' palette) replaces the old 10-color tailwind row; save button loses the glow and matches the canonical style (green while saving); `goBack()` with `/savings` fallback replaces bare `router.back()`; goal name goes through `normalizeName`; deadline preview uses the dynamic date-fns locale. Goal icons intentionally stay emoji — goals render emoji everywhere (list, quick-add, family view) and are not part of the category outline-icon contract.
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
