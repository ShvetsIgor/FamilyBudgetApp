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

## Conversational Input Architecture (stabilized 2026-05-23)

### Input pipeline layer map

| Layer | File(s) | Owns |
|-------|---------|------|
| **normalizer** | `engine/inputNormalizer.ts` | Text normalization (NFC, lowercase, alias map, amount utilities). Single source for all text transforms. |
| **classifier** | `engine/tokenClassifier.ts` | Token-level classification: `amount \| text \| noise`. Preserves original casing in `token.raw`. |
| **parser** | `engine/inputPipeline.ts` | 7-stage pipeline → `ParserContext` (amount, merchant, merchantKey, tags, itemCandidates, confidenceSignals, splitHints). |
| **compat shim** | `utils/quickAddParser.ts` | `parseQuickAdd()` wraps `parseInput()` — backward-compatible `{ amount, merchant }` interface. |
| **intent** | `engine/intentDetector.ts` | Keyword prefix classification for non-expense intents (income/transfer/recurring). |
| **policy** | `engine/scoringPolicy.ts` | All signal weights + thresholds. Single tuning point. |
| **ranking** | `engine/suggestionEngine.ts` | 5-stage deterministic pipeline: context → signals → score → reasons → rank |
| **context** | `engine/recentContextEngine.ts` | Pure context queries (merchants, categories, split combos) |
| **session** | `store/inputSessionSlice.ts` | Transient stage machine with branch tracking (`previousStage`) |
| **memory** | `store/suggestionMemorySlice.ts` | localStorage-persisted usage memory (merchants + recents + splitCombos + tagAssociations) |
| **orchestrator** | `hooks/useExpenseInputFlow.ts` | Single coordination point — components must not bypass this |
| **UI** | `components/QuickAddBar.tsx`, `ClarificationPanel.tsx` | Render + dispatch intents only |

### Input pipeline stages (inputPipeline.ts)

```
Raw text
  Stage 1: normalizeInput    — NFC + lowercase + collapse whitespace
  Stage 2: tokenizeInput     — split into raw tokens (original casing preserved)
  Stage 3: classifyTokens    — assign kind: amount | text | noise
  Stage 4: extractAmount     — last amount token; separate from rest
  Stage 5: detectMerchant    — memory-aware: known first token = merchant, rest = items
  Stage 6: extractItems      — remaining text tokens = itemCandidates
  Stage 7: buildContext      — assemble ParserContext + confidenceSignals + splitHints
→ ParserContext { raw, normalizedInput, amount, merchant, merchantKey, tags, itemCandidates, confidenceSignals, splitHints }
```

### Ranking pipeline stages (suggestionEngine.ts)

```
Stage 1: build RankingContext  (merchantKey, memory, now)
Stage 2: collectSignals        → SignalSet per item
Stage 3: calculateScore        → number (policy-driven, pure)
Stage 4: buildReasons          → SuggestionReason[] (explainable)
Stage 5: rankCandidates        → sort by score, tie-break by id, slice topN
```

### Scoring signals

| Signal | Weight | Fires when |
|--------|--------|-----------|
| `merchant_history` | 50 (saturates at 5 uses, decay 90d) | Category used at this merchant before |
| `tag_history` | 25 (saturates at 3, decay 90d) | Category in tagAssociations for this merchant tag |
| `habit` | +10 flat | merchant_history count ≥ 3 (frequencyThreshold) |
| `recent_usage` | 20 (30-day decay) | Category used recently globally |
| `name_match` | 10 flat | Merchant token ↔ category name substring match |
| `split_history` | 15 (saturates at 3 combos) | Category appears in known split combos for merchant |

### Stage transitions (inputSessionSlice.ts)

```
idle
  ↓ processInput()
parsing → clarification ─→ split      (requestSplit or large amount)
                        └→ confirm    (saveWithCategory from clarification)
       → confirm                      (confident suggestion, direct path)
       → editing                      (no memory signal)
confirm → saved → null (auto-clear 1200ms)
```

`previousStage` is recorded on every `advanceStage` and `markSaved` call.

### Architecture invariants

- **inputNormalizer is the single text normalization source** — no inline `.toLowerCase()` / `.trim()` in engine or pipeline code
- **Token casing: `raw` = display, `normalized` = key** — original case preserved through pipeline; normalization only for lookups
- **Alias map is explicit and deterministic** — no fuzzy matching; every variant must be listed in `MERCHANT_ALIAS_MAP`
- **suggestionEngine has zero UI dependencies** — pure functions, no imports from components/hooks
- **All ranking weights live in scoringPolicy.ts** — no magic numbers in engine
- **Components only render + dispatch intents** — no ranking logic in QuickAddBar or ClarificationPanel
- **useExpenseInputFlow is the single orchestration boundary** — components import only this hook
- **Habit signals are ranking helpers only** — never alter analytics, category IDs, or expense data
- **Session cleanup is always via clearSession()** — no stale branch state can accumulate
- **tagHistory fills the non-primary split category gap** — merchantHistory records only the primary; tagAssociations cover all split categories

## Categories Architecture (frozen 2026-05-23)

### Layer map

| Layer | File(s) | Owns |
|-------|---------|------|
| **preset** | `preset/categoryPresets.ts` | Blueprint data for onboarding only. Never runtime authority. |
| **runtime config** | `config/categoryLabels.ts` | Preset-derived alias map + `getPresetDisplayName`. Built once at module load. |
| **runtime config** | `config/libraryConfig.ts` | Library folder list for "add from library" flow. Consumed only by `librarySelectors.ts`. |
| **selectors** | `store/selectors.ts` | Canonical source for active-category state derivation. All components should use these. |
| **selectors** | `store/librarySelectors.ts` | `selectAvailableLibrary` — unactivated preset folders. |
| **view-model hook** | `hooks/useCategoryGroups.ts` | `CategoryGroup` type + `getCatsInGroup` dynamic accessor for form components. |
| **UI derivation util** | `utils/folderSections.ts` | `buildFolderSections` pure function. Direct use only in CategoryPicker (search-filtered) and CategorySheet (categoriesOverride). All other components use `selectFolderSections`. |
| **stats util** | `utils/statsAggregation.ts` | `aggregateTopCategories` for analytics pages. |
| **policy** | `policy/categoryPolicy.ts` | `isActiveCategory` — single gate for archive visibility. |
| **compat** | `compat/legacyCategoryMap.ts` | Legacy ID → new ID migration. Isolated, used only in reset flow. |
| **services** | `services/defaultCategories.ts` | Seed data: `DEFAULT_EXPENSE_CATEGORIES`, `DEFAULT_INCOME_CATEGORIES`, `DEFAULT_EXPENSE_FOLDER_SEEDS`, `DEFAULT_INCOME_FOLDER_SEEDS`. |

### Architecture invariants

- **Categories** — semantic expense classification targets only. `categoryId` is the only domain link in expenses.
- **Folders** — UI grouping only. Non-semantic. Never drive analytics or domain logic.
- **Presets** — onboarding/setup data only. Never read at runtime for domain behavior.
- **Selectors** — canonical derivation layer. Components read state through selectors, not slices directly.
- **Compat** — isolated legacy behavior. `legacyCategoryMap` used only in the reset flow.
- **`isActiveCategory`** — the single policy gate. All active-category filtering must go through it.

### Derivation paths

```
Redux store
  └─ selectors.ts → selectFolderSections (canonical)
       └─ folderSections.ts:buildFolderSections
            ↑ also used directly by:
              CategoryPicker (search-filtered list — selector cannot accommodate)
              CategorySheet  (categoriesOverride mode — non-Redux data)

useCategoryGroups hook → CategoryGroup view-model + getCatsInGroup(folderId)
  (form components that need dynamic per-folder lookup without extra subscriptions)
```

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
- **2026-05-21** — Category tree architecture removed: useCategoryGroups/CategoryPicker/CategoriesHub/CategorySheet all folder-only; handleActivateFromLibrary creates CategoryFolder+folderId; legacy/legacyCategoryAdapter.ts isolates parentId helpers; isRootCategory @deprecated.
- **2026-05-22** — Clean-break category refactor complete: deleted CategoryTree, legacy/, categoryHelpers; removed parentId/subcategoryId from types/services/tests; renamed all parent/sub variables to folder-based terminology (ungroupedOnly, selectedCategoryId, selectedGroupId, catsInGroup, groupName, remainder, etc.); 127 tests green.
- **2026-05-23** — Runtime hardening: split defaultCategories into folder seeds (DefaultFolderEntry) vs category seeds (DefaultCategoryEntry, no folder blueprints as pseudo-categories); seedDefaultCategories + resetCategoriesToDefaults now create CategoryFolder documents; merged libraryConfig.ts → categoryLabels.ts; renamed categoryViewModels.ts → folderSections.ts; 154 tests green.
- **2026-05-23** — Architecture freeze stabilization: deleted dead passthrough stubs (categoryAliasMap.ts, categoryConfig.ts); updated stale TAXONOMY comments → preset; 154 tests green.
- **2026-05-23** — Final hardening: split categoryLabels.ts → categoryLabels (alias/display) + libraryConfig (library/onboarding); librarySelectors imports from libraryConfig; added architecture invariant doc-headers to preset, selectors, folderSections, libraryConfig; 154 tests green.
- **2026-05-23** — Architecture freeze prep: useCategoryGroups — removed dead returns (ungroupedCats, allCats, folders), added view-model hook ownership doc; CATEGORY_ALIAS_MAP dynamic build from presets kept (static copy impractical); libraryConfig passthrough kept (formalized role); 154 tests green.
- **2026-05-23** — Architecture freeze finalized: explicit decision docs in categoryLabels (preset-derived labels intentional), folderSections (buildFolderSections direct-use formalized for CategoryPicker+CategorySheet exceptions); categories layer map + invariants + derivation diagram added to CLAUDE.md; 154 tests green.
- **2026-05-23** — Category constructor + organization phase: CategoryFolder.parentFolderId (UI-only nesting, no semantic inheritance); Category.tags (contextual search hints, not semantic); selectRootFolders + selectChildFolders selectors; tagUtils.ts (normalizeTag, tokenizeQuery, boostCategoriesByQuery — pure string matching for chat/parser boost); CategoryEditorSheet tag chip editor; FolderEditorSheet parent folder selector; CategoriesHub nested folder display (child folders indented under parent); 154 tests green.
- **2026-05-23** — Expense input Phase E: split combo memory (SplitComboEntry, recordSplitExpense), ClarificationPanel split combo cards, FastExpenseEntry draft.splits pre-population + recordSplitExpense dispatch, openSplitEditorWithCombo in flow hook; 234 tests green.
- **2026-05-23** — Conversational UX + Ranking Hardening (5 phases): formal ranking pipeline in suggestionEngine (5 named stages: collectSignals/calculateScore/buildReasons/rankCandidates), SignalSet exported for inspectability, habit signal (SCORING_POLICY.signals.habit, +10pts flat at ≥3 uses), isHabitSuggestion helper; proactive UX — "Как обычно" in confirm stage chips, habit badge in ClarificationPanel header + suggestion cards; session branch tracking — previousStage field in ExpenseInputSession, recorded on advanceStage/markSaved; orchestration boundary doc in useExpenseInputFlow; architecture section added to CLAUDE.md; 251 tests green.
- **2026-05-23** — Context Tag Memory Architecture: TagAssociation model (tag, categoryId, usageCount, lastUsedAt, source); recordTagAssociation reducer; tagHistory signal in ranking pipeline (25pts, saturate at 3, decay 90d); FastExpenseEntry dispatches recordTagAssociation for all split categories; normalizeTag/extractTags exported; 314 tests green.
- **2026-05-23** — Unified Input Understanding Pipeline: inputNormalizer.ts (NFC + lowercase + alias map + amount utils); tokenClassifier.ts (ClassifiedToken, noise stop-words, original casing in raw); inputPipeline.ts (7-stage pipeline → ParserContext with amount/merchant/merchantKey/tags/itemCandidates/confidenceSignals/splitHints); quickAddParser.ts refactored to thin shim; merchant display = original casing, merchantKey = normalized+alias-resolved; memory-aware merchant detection (single known token splits items); 391 tests green.
- **2026-05-23** — Semantic Fragment Extraction Runtime: semanticFragment.ts (SemanticFragment + ClarificationHint types, confidence tiers 0.30–1.0); semanticDictionary.ts (unified adapter over chat parser dictionaries, STORE_SINGLE/STORE_BIGRAM indexes, ITEM_BIGRAM_TABLE); fragmentExtractor.ts (greedy bigram+single-token pipeline, 4 ClarificationHint kinds); ParserContext extended with fragments[]+clarificationHints[]; parseInput() calls extractFragments; emptyContext() returns empty arrays; 435 tests green.
- **2026-05-23** — Semantic Relationship & Grouping Runtime: FragmentRelationship model (RelationshipType + interface, deterministic tiers 0.70–1.0); purchaseGroup.ts (PurchaseGroup — merchant/amount/item/modifier grouping, suggestedSplit, confidenceSignals, multi-group OCR-ready array shape); purchaseGrouper.ts (buildRelationships: 4 rules — shares_merchant 0.90, shares_amount 1.0, related_item 0.70, modifies 0.80 with nearest-item tie-break; buildPurchaseGroups: single g0 group, suggestedSplit via category union or hint); ParserContext extended with relationships[]+purchaseGroups[]; fixed 2 pre-existing flaky determinism tests (vi.useFakeTimers); 499 tests green.
- **2026-05-23** — Semantic Phrase Understanding Runtime: semanticPhrase.ts (SemanticPhrase model with 7 PhraseType variants, confidence tiers 0.30–1.0, tokenIndexes for multi-token spans); phraseExtractor.ts (12-step greedy phrase extraction: store trigram/bigram, payment bigram, item bigram, modifier bigram with noise-prefix handling "for/с", standalone modifiers, memory merchant, tag fallback; MODIFIER_PREFIXES + STANDALONE_MODIFIERS sets); semanticDictionary.ts extended with STORE_TRIGRAM index + lookupStoreTrigram + PAYMENT_PHRASE_TABLE (credit card, bank transfer, оплата картой, etc.) + lookupPaymentPhrase; fragmentExtractor.ts refactored to phrase-first: buildFragmentsFromPhrases maps phrases→fragments, extractFragmentsFromPhrases exported for direct use, extractFragments(tokens) backward-compatible shim; ParserContext extended with phrases[]; inputPipeline.ts calls extractPhrases then extractFragmentsFromPhrases (no double extraction); 73 new tests; 572 tests green.
- **2026-05-23** — Semantic Scope & Phrase Resolution Runtime: semanticScope.ts (SemanticScope model — rootPhraseId + modifierPhraseIds + relatedPhraseIds + ScopeType; ScopeHint — orphan_modifier + ambiguous_modifier_target); scopeResolver.ts (buildSemanticScopes — 3-step deterministic algorithm: collect roots, assign modifiers to nearest by index with lower-index tie-break + ambiguous hint, assign tags to nearest root as relatedPhraseIds); ParserContext extended with scopes[]+scopeHints[]; emptyContext() updated; 39 new tests; 611 tests green.
- **2026-05-23** — Semantic Registry & Category Constructor Integration: semanticRegistry.ts (entity types MerchantEntry/AliasEntry/PhraseEntry/ItemEntry/ModifierEntry/TagEntry, computePrecedence with centralized rules, RegistryConflict model with 5 conflict kinds); semanticRegistryBuilder.ts (aggregates store/item dictionaries + alias map + phrase tables + modifier sets into SemanticRegistry singleton with singleIndex/bigramIndex/trigramIndex/aliasIndex + automatic conflict detection); parserInspector.ts (explainability — InspectionReport with PhraseMatchRule for all 12 extraction steps, fragment derivation, clarification trigger reasons, scope attachment distances, outcome: confident|ambiguous|empty); exported MODIFIER_PREFIXES, STANDALONE_MODIFIERS, ITEM_BIGRAM_TABLE, PAYMENT_PHRASE_TABLE; 57 new tests; 668 tests green.
