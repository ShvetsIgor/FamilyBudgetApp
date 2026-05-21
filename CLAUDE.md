# FamilyBudgetApp — Claude Context

## Stack
- **Framework:** Next.js 15 + App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives) + custom design tokens (Nunito font, warm palette)
- **State:** Redux Toolkit (`src/store/store.ts`)
- **Backend:** Firebase (Auth + Firestore + Storage) — Spark free tier
- **i18n:** next-intl, locales: `en` (default), `ru`, `he` (RTL)
- **PWA:** next-pwa (disabled in dev), update banner when new version available
- **Date utils:** date-fns
- **Charts:** Statistics page uses pie + bar charts

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
    layout.tsx                    — root layout, Providers
    providers.tsx                 — Redux + ThemeProvider + AuthProvider
    page.tsx                      — redirect → /home
    auth/
      layout.tsx
      login/page.tsx              — email/password + Google sign-in
      register/page.tsx           — email/password + Google sign-up
    (app)/                        — authenticated route group
      layout.tsx                  — Header + BottomNav wrapper
      home/page.tsx               — Quick Add, upcoming bills, recent expenses
      expenses/
        page.tsx                  — grouped by date, search/filter
        new/page.tsx              — new expense form
        [id]/page.tsx             — expense detail
        [id]/edit/page.tsx        — edit expense
      categories/page.tsx         — tree view, CRUD, reset to defaults
      statistics/page.tsx         — pie + bar charts, monthly breakdown
      analytics/page.tsx          — trends, insights
      recurring/page.tsx          — recurring payments CRUD
      savings/page.tsx            — savings goals CRUD + contribute
      account/page.tsx            — profile, theme, language, currency, family, export CSV
  features/
    auth/
      components/
        AuthProvider.tsx          — Firebase onAuthStateChanged
        LoginForm.tsx
        RegisterForm.tsx
        GoogleButton.tsx
      services/authService.ts
      store/authSlice.ts
    categories/
      components/
        CategoryForm.tsx
        CategoryIcon.tsx
        CategoryPicker.tsx
        CategoryTree.tsx
      services/
        categoriesService.ts
        defaultCategories.ts      — seed data for default categories
      store/categoriesSlice.ts
    expenses/
      components/
        ExpenseCard.tsx
        ExpenseForm.tsx           — with split support
        SplitEditor.tsx           — inline split editor
      services/expensesService.ts
      store/expensesSlice.ts
      utils/splitAlgorithm.ts
    income/
      components/
        IncomeCard.tsx
        IncomeForm.tsx
      services/incomeService.ts
      store/incomeSlice.ts
    recurring/
      components/UpcomingBills.tsx
      hooks/useRecurringNotifications.ts
      services/recurringService.ts
      store/recurringSlice.ts
    savings/
      services/savingsService.ts
      store/savingsSlice.ts
    stats/
      services/statsService.ts
    budget/
      services/budgetService.ts
      store/budgetSlice.ts
    family/
      services/familyService.ts
      store/familySlice.ts
    onboarding/
      components/OnboardingFlow.tsx
    ui/
      store/uiSlice.ts            — theme, language, currency, offline
  shared/
    components/
      Header.tsx                  — sticky, offline indicator, wordmark logo, recurring icon
      BottomNav.tsx               — 4 tabs: Add / Expenses / Stats / Analytics
      ThemeProvider.tsx           — applies dark class + RTL dir to <html>
      LoadingScreen.tsx
      UpdateBanner.tsx            — PWA update prompt
    hooks/
      useNotifications.ts
      useT.ts
    lib/
      firebase.ts                 — lazy getFirebaseApp() factory
      i18n.ts
    types/index.ts                — all TypeScript interfaces
    utils/
      cn.ts                       — tailwind-merge helper
      colors.ts
      currency.ts                 — formatAmount, getCurrencySymbol
      exportCsv.ts                — CSV export for account page
  store/store.ts                  — Redux store + typed hooks
  messages/
    en.json / ru.json / he.json   — full i18n coverage
public/
  logo-mark.svg                   — pig logo mark
  wordmark.svg                    — text wordmark
  favicon.ico / favicon.svg
  icon-192.png / icon-512.png     — PWA icons
  manifest.json
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
- **Split expense** — optional inline SplitEditor, doesn't block fast path
- **Savings as expenses** — savings contributions create an expense record in the Savings category
- **Auto-seed categories** — Savings category auto-created if missing on first contribution

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

## Feature Status (2026-05-12)
- [x] Next.js + TypeScript + Tailwind setup
- [x] Redux Toolkit store
- [x] Firebase lazy initialization
- [x] Auth — email/password + Google sign-in/sign-up
- [x] ThemeProvider (dark/light + RTL for Hebrew)
- [x] Header + BottomNav
- [x] i18n — full coverage en/ru/he, all strings via t() hook
- [x] PWA manifest + icons + update banner
- [x] Design system — Nunito font, warm palette, design tokens, category colors
- [x] Logo — pig logo-mark SVG, wordmark SVG, favicon, PWA icons
- [x] Categories — tree view, CRUD, color/icon, default seed, reset to defaults
- [x] Add Expense form + split logic (SplitEditor)
- [x] Expenses list — grouped by date, search/filter
- [x] Expense detail + edit
- [x] Income — add/list, category picker
- [x] Statistics — pie chart + bar chart, monthly breakdown by category
- [x] Analytics — trends and insights page
- [x] Recurring payments — CRUD, upcoming bills on Home + Expenses
- [x] Savings goals — CRUD, contribute (creates expense), sync on delete
- [x] Account page — profile, theme, language, currency, family, CSV export
- [x] Home — quick-add buttons, upcoming bills, recent expenses, real data
- [x] Onboarding flow
- [x] Budget feature (service + slice)
- [x] Family feature (service + slice)
- [ ] Firebase config (.env.local) — waiting for user
- [ ] Firestore security rules
- [ ] Family invite flow (UI)
- [ ] Push notifications (backend)
- [ ] Deploy (Vercel)

## Change Log
- **2026-05-10** — Phase 1 bootstrap: Next.js, Firebase auth, layout system.
- **2026-05-10** — Steps 3–11: Categories, Expense form+split, Expenses list, Income, Statistics, Analytics, Recurring payments, Savings goals, Account page, Home with real data.
- **2026-05-11** — Steps 12–20: PWA update banner, full i18n, design system tokens, logo integration (SVG logo-mark + wordmark, favicon, PWA icons), category color fixes, auth screens polished.
- **2026-05-12** — Logo SVG fixes: pig scaled 1.14×, shekel/pig removed from coin/wordmark, wordmark text centered in viewBox.
- **2026-05-12** — Desktop shell: Sidebar (260px, section nav, profile card), TopBar (page title, theme toggle, CTA), AppShell (mobile/desktop responsive wrapper), lg:hidden on Header/BottomNav, i18n keys for sidebar/topbar/new nav items.
- **2026-05-12** — Desktop Home dashboard: 3 stat cards (balance/income/expenses), 2-col layout (transaction table + sidebar with upcoming bills and savings goals).
- **2026-05-12** — Desktop layouts for Expenses (2-col list+form panel), Statistics (pie+budgets left, bar chart right), Analytics (4 stat cards + 2-col charts), Account (2-col profile+family vs prefs+export).
- **2026-05-12** — Desktop layouts for Auth (split branded panel), Categories (2-col tree+form), Savings (2-col goals grid+detail panel), Recurring (2-col list+form panel).
- **2026-05-12** — Desktop redesign per HANDOFF.md: Sidebar (family.budget logo, new nav structure), TopBar (greeting + search bar), Home dashboard (hero balance card, avg-day sparkline, 6-month trend chart, upcoming bills, budget categories, transactions table).
- **2026-05-12** — Fix: Sidebar logout button showed raw key "account.logout" → corrected to account.signOut.
- **2026-05-15** — Шаг 3: SVG sticker icons from design system (55 icons, icons.tsx), TAXONOMY-based defaultCategories, CategoryIcon + StickerIcon SVG rendering with emoji fallback.
- **2026-05-15** — Шаг 4: FastExpenseEntry full-screen numpad component (/expenses/new), split rows, parentLeftover logic.
- **2026-05-15** — Шаг 8 (home): Mobile home redesign — hero balance card, quick-action grid, budget bars, upcoming bills, recent expenses; added missing i18n keys (home.greeting/expense/budgets/over).
- **2026-05-16** — FastIncomeEntry + FastSavingsEntry numpad overlays (/income/new, /savings/contribute); home simplified to greeting+balance+3 buttons; floating BottomNav (raised, rounded, oversized plus); month picker on expenses page; analytics icon fix (StickerIcon); export month input → select; Vitest suite added (50 tests: slices, utils, CSV, icon registry).
- **2026-05-17** — FastExpenseEntry: split saves as one expense with splits[], comment + MiniCalendar date picker in top bar icons; edit page uses FastExpenseEntry; FastIncomeEntry: same comment + date; MiniCalendar extracted to shared; savings page: add-goal button in empty state + dashed button above goals list.
- **2026-05-21** — Category architecture refactor (phases 1–6): CategoryFolder (UI-only), flat Category with folderId, @deprecated parentId, StoreSubcategoryUsage→StoreCategoryUsage (categoryId, no folderId/parentId), probableSubcategories→probableCategories, archiveCategoryInFirestore (soft-delete), KEYWORDS migrated to flat categoryId model, 131 Vitest tests green.
- **2026-05-21** — Domain layer cleanup: isRootCategory() helper (no folderId check), folder/parentId evicted from bot/domain context; topParentIds→topCategoryIds; morning/slash/weekly group by e.categoryId only.
- **2026-05-21** — UI runtime cleanup: useCategoryGroups hook (folder vs legacy picker abstraction); parentId removed from analytics/statistics/selectors/pickers/forms; isRootCategory used throughout; 131 tests green.
- **2026-05-21** — Final parentId purge: ExpenseCard display path uses folderId+fallback; ExpenseForm subcategory filter folder-aware; FastSavingsEntry uses isRootCategory; removed parentId:undefined from addCategory calls.
- **2026-05-21** — Parser dictionary split: itemDictionary.ts (620 lines) → dictionaries/food/home/transport/health/shopping/services; storeDictionary.ts → dictionaries/stores; dead KEYWORDS removed from dictionary.ts; old files kept as re-export stubs.
