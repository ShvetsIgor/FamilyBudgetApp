# FamilyBudgetApp — Claude Context

## Product Intent

`family.budget` is not meant to feel like a category-admin app.

Primary UX:

- user writes an expense in chat
- app parses amount + merchant/context
- app asks only when confidence is low
- supermarket / mixed purchases should naturally continue into split flow
- category management is secondary and should stay out of the main path

Core principle:

- **context is not category**
  `Dabbah` / `Shufersal` / `McDonald's` are merchant or context signals
  real categories remain semantic: groceries, bakery, home, fuel, coffee, etc.

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
- Hebrew / RTL is intentionally paused right now and is **not** part of the active runtime guarantee
- `/home` is the main expense-entry path
- `/categories` is an advanced cleanup/library screen, not a primary navigation flow

## Dev Workflow

```bash
npm run dev
npm run lint
npm run build
npm test
```

Current verified baseline after the 2026-05-27 alignment pass:

- `npm run lint` — green
- `npm run build` — green
- `npm test` — `483/483` green

## Project Structure

```text
src/
  app/
    (app)/
      home/page.tsx               primary chat/orchestration runtime
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
  chat and manual flows now share the same saved history via `suggestionMemory`, even though the front parser is still the legacy chat parser.

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

`features/expenses/services/expensesService.ts` now batches:

- expense create + `monthlyStats`
- expense edit + old/new `monthlyStats` deltas
- expense delete + `monthlyStats`

If you change the expense domain model, preserve this invariant.

### 5. Auth boundary

`src/store/store.ts` resets the Redux tree when auth becomes `null`.

Reason:

- without a full reset, slice `status === 'idle'` guards can leave stale user A data visible for user B

Do not remove this unless you replace it with a full session-boundary solution.

### 6. Local date keys

Use `shared/utils/dateKey.ts` for local `YYYY-MM-DD` keys.

This is now the contract for:

- chat context daily calculations
- weekly summary ranges
- recurring notification dedupe
- store profile last-used markers

Avoid mixing local day keys with `toISOString().slice(0, 10)` in product logic.

## Recent Alignment Pass (2026-05-27)

Implemented:

- chat category-sheet flow now preserves `storeId/storeName/storeGroup/isTagLearning`
- chat saves update `suggestionMemory`, not only manual/numpad saves
- chat auto-saves also refresh `storeProfiles` when store metadata exists
- expense create/edit/delete writes are batched with monthly stats
- recurring-generated expenses keep `isRecurring` aligned with `recurringId`
- Redux store resets on logout/auth-null
- local-day helper introduced and applied to weekly/recurring/store-profile paths
- `Categories` removed from primary desktop sidebar navigation
- test baseline updated and back to green

## Known Gaps

- Split persistence is still one `Expense` document with `splits[]`
  there is no separate `splitGroup` entity yet.
- Chat parser is still the legacy parser entrypoint.
  The newer expense engine influences the product through shared history and split memory, but does not fully replace `parseMessage` yet.
- Inline category/folder creation inside split flow is still separate from the final expense write.
  The expense/stat write path is atomic now; category/folder creation is not yet folded into one transaction boundary.
- Category presets and library are still larger than the ideal minimalist product vision.

## Safe Guidance For Future Changes

- Prefer improving `/home` and split continuation before adding more category-admin UI.
- Keep deterministic ranking explainable. Avoid hidden heuristics when a transparent signal can be stored instead.
- If you touch `expensesService.ts`, rerun `npm run build` and `npm test`.
- If you add any new “today” or “this week” logic, use `dateKey.ts`.
- If you change logout/session behavior, verify cross-user state isolation explicitly.
