# family.budget

Conversational family budget tracker built around fast natural-language expense entry, split purchases, and deterministic history-based learning.

## Product Principles

- **Chat-first**: the main flow starts in `/home`, not in forms or setup screens.
- **Split-first**: supermarket and mixed purchases should naturally continue into split UI.
- **Context is not category**: merchant/store context guides the flow, while real categories stay semantic.
- **Deterministic learning**: no AI dependency for the core expense brain; ranking comes from usage history, split memory, tag associations, and store profiles.
- **Categories are secondary**: the category editor exists for cleanup, renaming, archiving, and library activation, not as a mandatory onboarding step.

## Current Architecture

- **Primary expense flow**: chat input on `/home` -> parser -> bot clarify/save flow -> optional split route to `/expenses/new`.
- **Shared memory layer**: chat saves and manual saves both feed `suggestionMemory` plus store profiles, so merchant history is no longer isolated to the numpad path.
- **Atomic expense writes**: create, edit, and delete update the expense document and `monthlyStats` in a single batched Firestore write.
- **Session isolation**: Redux state resets when auth becomes `null`, preventing cross-user stale slices after logout/login switches.
- **Recurring expense model**: generated expenses keep `recurringId` and `isRecurring` aligned.
- **Recurring recovery**: deleting a recurring-generated expense rolls the linked template back to the deleted due date instead of leaving the recurring item stranded in the future.
- **Library-first expense reset**: resetting categories clears learned merchant/tag memory and leaves expense folders empty until the user explicitly adds a section or picks one through chat.
- **Guided creation**: folder/category editors show name-only library suggestions while the user types; selecting a suggestion fills the name and reuses preset icon/color metadata without activating hidden library entities.
- **Date consistency**: chat weekly summaries, recurring notifications, and chat context use local date keys instead of mixed UTC day boundaries.
- **Split list presentation**: split expenses in `/expenses` render and filter by merchant context (`storeGroup`, for example `Supermarket`) instead of leaking the first split category into the list header.
- **Split save guardrails**: chat-driven split entry now keeps the remainder inside the selected folder context and refuses to fall back into an unrelated global first category.
- **Localized savings labels**: savings contribution expenses render with the current UI label (`Накопления`, `Savings`) instead of a hard-coded English prefix.
- **Recurring income badge**: recurring income entries persist the `recurring` tag and show a recurring marker in the income list.
- **Recurring category validation**: recurring templates resolve to a real category before save, so new or paid recurring items cannot silently stop generating expenses because of an empty `categoryId`.
- **Recurring backfill**: a newly created recurring payment with a start date on or before today now creates its initial expense occurrence immediately; if that expense cannot be written, the template is rolled back instead of being saved in a broken state.
- **Localized store-group filters**: `/expenses` filter chips use the active UI language even when the label comes from preset `storeGroup` fallback metadata.
- **Explicit folder-mode category choice**: in chat clarify split flow, choosing a section no longer auto-picks a random first category from that section; the user must choose a real leftover category or fully cover the amount with split rows.
- **Safer folder creation handoff**: creating a new section from chat now routes into split mode without crashing on empty folders and immediately supports category creation inside that new section.
- **Recurring section-first UX**: recurring payment setup labels the first picker as a section picker, blocks save when the chosen section has no categories, and offers inline category creation.
- **History-ranked split picker**: split row clarification keeps category choice inside the row picker; previous split combos only boost section/category ordering and no longer add whole historical bundles in one click.
- **Explicit split remainder**: partial split saves require a user-selected category for the remaining amount; historical merchant/category memory never becomes the hidden remainder category.
- **Expense input validation**: expense writes reject invalid amount/date/category data and any split whose total exceeds the purchase amount; desktop quick-add uses real categories, not folder ids.
- **Store split context**: opening split from chat uses the known store group to materialize/pass the matching section context, so known tags like `Даббах` continue as supermarket split flows instead of category guesses.
- **Expanded icon colors**: category/folder icon color palette includes a broader 28-color set for more visual separation.
- **Mist/Paper theme model**: visual skin is now `theme: mist | paper`, while dark mode is stored separately as `isDarkMode`; `<html>` receives `data-theme` and the `dark` class independently.
- **Outline visual system**: global CSS tokens, helper classes, Inter/Manrope fonts, and category outline icons are wired from the Mist/Paper design package without changing expense/parser persistence.
- **UX hotfix baseline**: source-level UTF-8 mojibake introduced during redesign was removed; account/settings icons use valid Unicode/component rendering; category/folder library suggestions select on pointer-down for mobile Safari; chat suggestions no longer expose preset/library folders unless the user explicitly opens the library flow.
- **UX/state hotfixes 5-11**: category/folder suggestion dropdowns close after selection; recurring section creation opens category creation when the section is empty; category sections start collapsed; merchant-to-section memory is stored in local `suggestionMemory_v2`; split history labels prefer the section/folder over the first split category; unknown merchant display casing is preserved separately from normalized matching keys.

## Main Features

- Chat-based expense entry with clarify cards
- Split purchases with inline category creation
- Fast numpad/manual expense entry
- Income tracking
- Statistics and analytics
- Recurring payments
- Savings goals
- Family account model
- PWA support
- Mist/Paper appearance themes with independent dark mode
- English and Russian UI

## Current Limits

- Hebrew/RTL is intentionally paused and is not part of the active runtime contract right now.
- Split persistence is still stored as one expense with `splits[]`; there is no separate `splitGroup` entity yet.
- The chat parser still uses the legacy dictionary/store parser for merchant detection; the newer expense engine currently complements the flow through shared memory rather than replacing that parser outright.
- The category constructor and library are still present as advanced screens, even though they are now de-emphasized in primary navigation.
- Deleting a recurring-generated expense intentionally does **not** delete the recurring template itself; it only restores the template's due state so the schedule stays consistent.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure Firebase

Copy `.env.local.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Run locally

```bash
npm run dev
```

## Verification

```bash
npm run lint
npm run build
npm test
```

Current baseline after the 2026-05-28 alignment pass:

- `npm run lint` - green
- `npm run build` - green
- `npm test` - `489/489` green

Additional 2026-05-29 UX hotfix checks:

- source mojibake scanner over tracked `src`, `public`, `README.md`, `CLAUDE.md`, and `tailwind.config.ts` - no bad UTF-8 tokens found
- local mobile viewport smoke at `390x844` - `document.characterSet` is `UTF-8`, meta charset is `utf-8`, and rendered app text has no mojibake tokens
- regression suite after hotfixes 5-11 - `npm run lint`, `npm run build`, and `npm test` (`492/492`) green

## Reference

- High-context architecture and handoff notes live in `CLAUDE.md`.
