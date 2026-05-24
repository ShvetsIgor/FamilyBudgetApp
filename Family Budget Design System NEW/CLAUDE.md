# FamilyBudgetApp — Claude Context

## Stack
- **Framework:** Next.js 15 + App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives)
- **State:** Redux Toolkit (`src/store/store.ts`)
- **Backend:** Firebase (Auth + Firestore + Storage) — Spark free tier
- **i18n:** next-intl, locales: `en` (default), `ru`, `he` (RTL)
- **PWA:** next-pwa (disabled in dev)
- **Date utils:** date-fns

## Dev Workflow
```
npm run dev     → http://localhost:3000
npm run build
npm run lint
```

## Project Structure
```
src/
  app/
    layout.tsx              — root layout, Providers
    providers.tsx           — Redux + ThemeProvider + AuthProvider
    page.tsx                — redirect → /home
    (app)/                  — authenticated route group
      layout.tsx            — Header + BottomNav wrapper
      home/page.tsx         — Quick Add screen
      expenses/page.tsx
      statistics/page.tsx
      analytics/page.tsx
      account/page.tsx
  features/
    auth/
      components/AuthProvider.tsx   — Firebase onAuthStateChanged
      store/authSlice.ts
    ui/
      store/uiSlice.ts              — theme, language, currency, offline
    expenses/   (skeleton)
    categories/ (skeleton)
    income/     (skeleton)
    recurring/  (skeleton)
    savings/    (skeleton)
    stats/      (skeleton)
    family/     (skeleton)
    analytics/  (skeleton)
  shared/
    components/
      Header.tsx            — sticky, offline indicator, nav icons
      BottomNav.tsx         — 4 tabs: Add / Expenses / Stats / Analytics
      ThemeProvider.tsx     — applies dark class + RTL dir to <html>
    lib/
      firebase.ts           — lazy getFirebaseApp() factory
      i18n.ts
    types/index.ts          — all TypeScript interfaces
    utils/
      cn.ts                 — tailwind-merge helper
      currency.ts           — formatAmount, getCurrencySymbol
  store/store.ts            — Redux store + typed hooks
  messages/
    en.json / ru.json / he.json
```

## Firebase Setup
- Config goes in `.env.local` (copy from `.env.local.example`)
- Firebase initialized lazily in `src/shared/lib/firebase.ts` via `getFirebaseApp()`
- Firestore uses `persistentLocalCache()` for offline support
- Auth, Firestore, Storage all initialized client-side only (inside `useEffect`)

## Key Architecture Decisions
- **Feature-based folders** — each feature is self-contained (components/hooks/store/services)
- **No Firebase on server** — all Firebase calls inside `'use client'` components via `useEffect`
- **monthlyStats docs** — pre-aggregated per user per month to minimize Firestore reads
- **Optimistic UI** — Redux updated immediately, Firestore write async
- **Privacy tiers** — personal / family / secret (secret = owner-only read in Firestore rules)
- **Split expense** — optional inline editor, doesn't block fast path

## Firestore Collections
```
users/{userId}
families/{familyId}
invites/{inviteId}
categories/{userId}/expense/{categoryId}
categories/{userId}/income/{categoryId}
expenses/{userId}/{expenseId}
incomes/{userId}/{incomeId}
recurringPayments/{userId}/{recurringId}
savingsGoals/{userId}/{goalId}
monthlyStats/{userId}/{YYYY-MM}
```

## Phase 1 Status (2026-05-10)
- [x] Next.js + TypeScript + Tailwind setup
- [x] Redux Toolkit store
- [x] Firebase lazy initialization
- [x] Auth slice + AuthProvider
- [x] ThemeProvider (dark/light + RTL)
- [x] Header + BottomNav
- [x] All page stubs
- [x] TypeScript types (all interfaces)
- [x] i18n messages (en/ru/he)
- [x] PWA manifest
- [ ] Firebase config (.env.local) — waiting for user
- [ ] Auth screens (login/register)
- [ ] Categories
- [ ] Add Expense form + split logic
- [ ] Expenses list
- [ ] Income
- [ ] Statistics
- [ ] Family flow
- [ ] Recurring payments
- [ ] Savings goals

## Change Log
- **2026-05-10** — Phase 1 bootstrap complete. Next.js project initialized, all base files created, dev server running at :3000.
