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
- **Guided creation**: folder/category editors now suggest matching library entities before creating new ones, so preset sections like `Супермаркет` can be reused instead of duplicated.
- **Date consistency**: chat weekly summaries, recurring notifications, and chat context use local date keys instead of mixed UTC day boundaries.
- **Split list presentation**: split expenses in `/expenses` render and filter by merchant context (`storeGroup`, for example `Supermarket`) instead of leaking the first split category into the list header.
- **Localized savings labels**: savings contribution expenses render with the current UI label (`Накопления`, `Savings`) instead of a hard-coded English prefix.
- **Recurring income badge**: recurring income entries persist the `recurring` tag and show a recurring marker in the income list.

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

Current baseline after the 2026-05-27 alignment pass:

- `npm run lint` - green
- `npm run build` - green
- `npm test` - `487/487` green

## Reference

- High-context architecture and handoff notes live in `CLAUDE.md`.
