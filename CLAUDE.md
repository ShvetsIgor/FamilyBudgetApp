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
- **2026-05-23** — Runtime Inspection & Semantic Debugging Toolkit: parserTrace.ts (ParserTrace model — stages[]+finalContext+clarificationHints+rankingSignals+semanticConflicts+totalTimingMs; ParserTraceStage with input/output snapshots+warnings+timingMs; RankingSignalTrace+RankingSignalEntry); traceRunner.ts (parseInputWithTrace() — 9 named stages with timing: normalize→tokenize→extractPhrases→extractFragments→buildScopes→buildRelationships→buildGroups→detectMerchant*→buildContext*; registry conflicts as SemanticConflictTrace[]; traceStageNames() helper); semanticGraphInspector.ts (buildSemanticGraph() — phrase/fragment/scope/group nodes + 6 edge kinds + stats header); rankingExplainer.ts (explainRankingSignals() maps ScoredSuggestion[]→RankingSignalTrace[] with per-signal weight/contribution/detail from SCORING_POLICY; summarizeRanking()); 65 new tests; 733 tests green.
- **2026-05-24** — Semantic Workflow & Runtime Validation System: semanticChangeset.ts (SemanticOperation — 7 types: add_phrase/add_alias/merge_aliases/archive_entry/change_precedence/attach_tag/modify_normalization; SemanticChangeSet; SemanticPreviewResult+PhraseDiff; SemanticValidationResult with 11 ValidationCodes; SemanticDiff); changesetValidator.ts (validateChangeset() — per-op validation with error/warning/info severity, sorted errors-first; isChangesetApplicable()); semanticSimulator.ts (applyChangeset() — applies ops to isolated registry COPY, never mutates production singleton, rebuilds indexes + re-detects conflicts, returns SimulationResult{simulatedRegistry, diff}; previewParserOutput() with phraseDiff + predicted clarification changes); regressionInspector.ts (runRegressionCheck() batch-asserts phraseTypes/amount/merchant/fragments/clarifications/scopeCount; snapshotRegressionBaseline() locks current behavior; compareToBaseline()); 51 new tests; 784 tests green.
- **2026-05-24** — Runtime Policy & Conversational Strategy System: runtimePolicy.ts (RuntimePolicy — 6 types: clarification/auto_resolution/merchant/split/ambiguity/retry; ConversationalStrategy with StrategyRule+EscalationRule+ClarificationBehavior; PolicyDecision+PolicyEvaluationResult types); ambiguityScorer.ts (AmbiguityKind×7 — conflicting_signals 90, unknown_merchant 80, orphan_amount 70, merchant_ambiguity 60, category_ambiguity 50, conflicting_modifiers 40, unresolved_split 25; scoreHintAmbiguity/scoreScopeHintAmbiguity/scoreGroupAmbiguity/scoreOrphanAmount/scoreSessionAmbiguity; computeOverallAmbiguityScore weighted-max; findDominantKind); policyEngine.ts (DEFAULT_POLICIES×6; evaluatePolicies — sorted by priority, one decision per hint/group, 6 handlers: clarification→ask, auto_resolution→auto_resolve, merchant→escalate, split→ask, ambiguity→defer/suppress, fallback→ask; filterDecisionsByAction, requiresUserInput, countDecisionsByAction); conversationalStrategy.ts (DEFAULT_STRATEGIES×3: minimal/standard/suppress; selectClarificationBehavior — suppress/ask_immediately/defer_low_priority/minimal; paceConversation — trims plan per behavior; suppressLowValueNoise; buildConversationalStrategy; matchingRules+matchingEscalations); policyDiagnostics.ts (PolicyDiagnosticEntry+PolicyDiagnosticReport; buildPolicyDiagnosticReport; explainWhyClarificationTriggered/explainWhyAutoResolved/explainWhyDeferred/explainWhichPolicyApplied); policyBridge.ts (editPolicy/togglePolicy/updatePolicyConfig; previewPolicyImpact; replaySessionWithPolicies; compareStrategies with StrategyComparison; inspectEscalationPath with EscalationTrace; mergePolicySets; summarizePolicies); 102 new tests; 1057 total green.
- **2026-05-24** — Resolution Runtime & Semantic Action System: semanticAction.ts (SemanticAction model — 9 action types, ActionSource user/runtime/constructor, typed payloads; ResolutionState with resolvedGroups/pendingGroups/unresolvedHints/autoResolvedHints/blockedResolutions/ambiguityScore); resolutionEngine.ts (buildInitialResolutionState, applySemanticAction — 9 handlers: accept_suggestion moves group to resolved, reject_suggestion blocks, resolve_clarification drops hint, split_purchase resolves group, merge_group, change_category unblocks, create_alias noop, ignore_merchant auto-resolves unknown_merchant hints, retry_parse clears state; deriveResolutionState replay; computeAmbiguityScore self-contained from state lists; isResolutionComplete, hasBlockedResolutions, pendingCount); clarificationBatcher.ts (canAutoResolveHint — multiple_categories with ≤1 candidate; autoResolveHints partition; buildClarificationPlan with nextBatch; hintImpactScore + sortByImpact; applyAutoResolvePolicy; isManualResolutionRequired); semanticEventTimeline.ts (SemanticEvent + SemanticEventTimeline models; 8 event kinds; buildSemanticEvent; buildTimelineFromSession — reconstructs ordered event log from session history + actions; filterEventsByKind, getLatestEventOfKind, countEventsByKind); resolutionDiagnostics.ts (15 DiagnosticReasonCode variants; explainUnresolvedHint, explainSplitSuggestion, explainBlockedResolution, explainParserRetry, explainActionTrigger; buildResolutionReport with per-hint/per-block/per-split diagnostics); constructorBridge.ts (createAliasFromSession → SemanticOperation add_alias; resolveConflictFromSession → archive_entry; approveParserCorrection → SemanticAction; buildSessionTimeline; extractUnknownMerchants; hasMerchantCorrections; summarizeSessionForConstructor); 110 new tests; 955 total green.
- **2026-05-24** — Conversational Runtime & Semantic Session System: semanticSession.ts (SemanticSession model — full conversational lifecycle: active→awaiting_clarification→resolved/cancelled; parserContexts[] history; corrections[]+undoneCorrections[] undo/redo stack; ClarificationState with ambiguityLevel; SessionReplayStep+SemanticSessionReplay types; 5 CorrectionType variants with typed payloads); clarificationOrchestrator.ts (priority order: conflicting_signals(0)>unknown_merchant(1)>ambiguous_item(2)>multiple_categories(3); computeAmbiguityLevel, getActiveQuestion, batchClarificationHints, buildClarificationState, resolveHint, isFullyResolved, needsClarification); sessionManager.ts (createSession, applyCorrection — merchant_correction triggers re-parse; clarification_answer triggers resolveHint; closed sessions silently ignore corrections; new correction clears redo stack; undoLastCorrection, redoLastUndo, resolveSession, cancelSession, replaySession, currentContext, isSessionOpen, resetSessionIds); 61 new tests; 845 tests green.
- **2026-05-24** — Runtime Projection & Conversational UX System (Phase M): runtimeProjection.ts (UX view model types — ProjectionStage×5: input/clarification/review/split/resolved; ClarificationCardViewModel+ClarificationGroup+ClarificationOption; SuggestionProjection; SplitItemProjection+SplitProjection; ResolutionProjection+ConfidenceLevel; RuntimeActionSuggestion+ActionSuggestionType×6; SemanticConflictViewModel; RuntimeProjection top-level snapshot); resolutionProgress.ts (computeProgressPercent — done/total×100; deriveConfidenceLevel — score<20→high/<50→medium/<80→low/else none; buildProgressSummary; buildResolutionProjection); clarificationPresenter.ts (buildClarificationCard with scoreHintAmbiguity+isRequired; buildClarificationCards — filters ask/escalate decisions; groupClarificationCards — by kind, sorted by priority, KIND_PRIORITY map; collapseGroup/expandGroup; shouldShowGroup; filterGroupsForBehavior — 5 behaviors: ask_immediately/batch_by_kind/minimal/defer_low_priority/suppress; countVisibleHints; getPrimaryCard); splitReviewOrchestrator.ts (buildSplitItemProjection — rawValue as label, first candidateCategory, modifier proximity; buildSplitProjection — canConfirm all items have category; hasMissingCategories; resolvedItemCount; buildSplitSummary); actionSuggester.ts (buildActionSuggestions — priority: conflicting_signals→resolve_merchant(high), unknown_merchant→resolve_merchant(high), blocked→retry_parse(high), split_ask→confirm_split(medium), all_auto_resolve→accept_suggestion(low), low_score→ignore_ambiguity(low), ready→accept_suggestion(low); suggestNextAction; filterSuggestionsByUrgency/Type; nextSuggestionId/resetSuggestionIds); projectionEngine.ts (deriveProjectionStage; mapToSuggestionProjections; buildRuntimeProjection — main 6-step builder; requiresUserInteraction; countTotalVisibleCards; getPrimaryProjectionCard; isSplitReviewComplete); uxBridge.ts (UxSessionSnapshot+openSessionProjection — primary UI entry point; AmbiguityInspectionResult+inspectGroupedAmbiguities; extractConflictViewModels; CorrectionApprovalResult+previewCorrectionApproval; ProjectedConversationReplay+replayProjectedConversation; UxImpactValidation+validateUxImpact; UxActionSummary+summarizeUxActions); 95 new tests; 1152 tests green.
- **2026-05-24** — Runtime Workflow & Conversational Navigation System (Phase N): runtimeWorkflow.ts (WorkflowStep×6: input/clarification/split_review/review/confirmation/resolved; NavigationActionType×9; RuntimeNavigationAction+WorkflowNavigationState; CompletionBlockerKind×6; WorkflowCompletionState with canComplete/canCompleteWithDeferrals/completionConfidence/blockers/safeToDefer/requiresHardConfirmation/canAutoResolve; DeferredItem with lifecycle; RuntimeWorkflow+WorkflowTransition); workflowOrchestrator.ts (deriveWorkflowStep — mirrors projectionEngine step derivation + adds split_review+confirmation; buildNavigationActions per-step with precondition guards; buildWorkflow — primary entry point; validateTransition; applyNavigationAction — defer/resolve-later handlers; deferItem/resolveDeferred/pendingDeferredItems); workflowCompletion.ts (findCompletionBlockers — conflicting_signals+unknown_merchant→isSafeToDefer:false, ambiguous_item+multiple_categories→isSafeToDefer:true, blocked_resolution→never safe; SAFE_DEFER_SCORE_THRESHOLD=50, AUTO_RESOLVE_SCORE_THRESHOLD=30; computeCompletionConfidence 0–100; buildCompletionState; hasHardBlockers/blockersOfKind/buildCompletionSummary); conversationalNavigator.ts (skipAmbiguity/resolveLater/forceSplitReview/confirmPartialResolution/escalateConflict/retryResolution — all return NavigationResult{success,action,updatedWorkflow,explanation}; listResolvableDeferred/canAdvanceFromStep/explainStuckState); workflowProjection.ts (WorkflowProgressProjection+ConversationalNavigationProjection+CompletionStateProjection+DeferredResolutionProjection; split_review inserted dynamically in progress steps; buildWorkflowProjections composite bundle); splitWorkflowOrchestrator.ts (buildGroupedSplitReview — per-group approval+deferral tracking; approvePartialSplit — non-approved items deferred; deferSplitClarification; applySplitCorrection with previousCategoryId; buildModifierReview; isGroupReviewComplete/pendingGroupReviews/buildGroupedSplitSummary); workflowBridge.ts (replayWorkflow — snapshot at each action; inspectWorkflowTransitions — chronological trace; validateNavigationStrategy — terminal/cyclic/skipped-clarification checks; previewDeferredResolution; simulateCompletionPaths×3: direct/with-deferrals/full-resolution; AI/OCR stubs: aiWorkflowHint+ocrWorkflowReview+adaptiveCompletion→null); 95 new tests; 1247 tests green.
- **2026-05-24** — Tag/Context/Suggestion Engine + Constructor Wizard improvements: Category type extended with aliases?/keywords?/usageCount?/lastUsedAt? (all optional, backward-compatible); categoryMetadata.ts (CategoryMetadata interface + mergeCategoryMetadata/recordCategoryUsage/addAlias/addKeyword pure utils); categoryNormalization.ts (NFC-safe normalizeToken/Alias/Tag/Keyword, tokenizeForMatching filters numbers+short tokens, deduplicateNormalized, normalizedEquals/Includes — Hebrew/Russian/Latin safe); tagMatching.ts (scoreCategoryMatch — alias exact 50 > name exact 40 > tag exact 35 > keyword exact 20 + partial variants; extractCandidateTokens; findMatchingCategoriesByTag with usage log-scale boost +15 + recency +5 within 30d; deterministic sort); categorySuggestions.ts (suggestCategoriesFromInput — tokens→matches→ranked SuggestedCategory[]; rankSuggestions with human-readable reasons ru; enrichCategoryTagsFromSplit — post-split merchant token enrichment, returns patches only for categories needing update); categoriesService.ts — updateCategoryMetadata() partial patch; parseExpenseInput.ts in chat/parser — thin wrapper over inputPipeline + categorySuggestions for chat UI; Constructor Wizard: StepPick — search bar with live filter + selection counter, StepBudget — per-folder percentage bars + overspend warning, StepDone — optional onQuickAdd second CTA; architecture audit confirmed no parentId/subcategory/hierarchy leakage; 68 new tests; 1315 total green.
- **2026-05-24** — MVP lockdown wave 2: deleted 26 more orphaned engine files (no production consumers after wave 1), 6 test files; 17 engine files remain (was 43), 775 tests green, build passes — engine dir now contains only files with real UI consumers.
- **2026-05-24** — Consolidation refactor: deleted 23 speculative engine files (18 from expenses/engine + 5 chat/engine), 2 test files, trimmed 7 test files; 43 engine files remain (was 66), 1180 tests green (was 1548), build passes — abstraction entropy reduced.
- **2026-05-24** — Wave 3 engine cleanup: deleted semantic pipeline (phraseExtractor, fragmentExtractor, scopeResolver, purchaseGrouper + 5 type files + semanticDictionary) and dead utils (quickAddParser, suggestionRanking); stripped ParserContext from 17→9 fields; 7 engine files remain (was 16), 427 tests green.
- **2026-05-24** — Product consolidation: deleted orphaned QuickAddBar flow (QuickAddBar, ClarificationPanel, QuickConfirmCard, useExpenseInputFlow, useInputSession, useIncomeConfirm, inputSessionSlice, draftSlice, recentContextEngine, chat conversation types); removed draft/inputSession from Redux store; fixed 6 test files with pre-existing type errors; 669 tests green.
- **2026-05-24** — Build fixes: resolved 7 TypeScript type errors across constructorBridge/splitReviewOrchestrator/workflowBridge/resolutionDiagnostics/parseExpenseInput; fixed prependExpense raw dispatch → action creator; updated stale test assertions (token→variant, description→message); 1548 tests green, production build passing.
- **2026-05-24** — Centralized Conversation State Architecture: conversationSession.ts (ConversationSession — единственный state container для chat expense flow; SessionStatus×6: idle/parsing/clarifying/confirming/completed/cancelled; PendingClarification+ClarificationKind×5, SelectedCategory, SplitDraft, SuggestedAction; addClarification/resolveClarification/selectCategory mutation helpers; isSessionOpen/hasUnresolvedClarifications/isReadyToConfirm query helpers); conversationEvents.ts (ConversationEventKind×15 append-only event log; typed payloads; buildConversationEvent factory; NOT event sourcing — debug/undo only); expenseDraft.ts (ExpenseDraft bridges parser→confirmed; DraftRevision append-only history; setDraftAmount/Category/Merchant/initSplit/updateSplitItem/removeSplitItem/setComment/confirmDraft/undoLastRevision; isDraftConfirmable/isDraftSplitBalanced query helpers); conversationTransitions.ts (explicit transition table, canTransition gatekeeper, applyTransition returns null for invalid; named transitions: startParsing/requestClarification/readyToConfirm/completeSession/cancelSession/reparseSession; terminal state protection); intentClassifier.ts (ConversationIntent×7 deterministic rules: CANCEL>CONFIRM>UNDO>CHANGE_AMOUNT>CHANGE_CATEGORY>MODIFY_SPLIT>ADD_EXPENSE priority; no NLP/ML; intentIs/isModificationIntent/isDestructiveIntent/isTerminalIntent helpers); sessionMemory.ts (two-tier isolation: SessionMemory transient vs SuggestionMemoryState global; tentativeMerchant/Categories/Tags never auto-persisted; buildGlobalMemoryPatch ONLY bridge to global; ContextualReferent for "еще X" implicit references); conversationInspector.ts (SessionInspectionReport; TransitionExplanation+ClarificationExplanation; inspectConversationSession/explainTransition/explainClarification/buildSessionTimeline/explainLastTransition; Architecture Audit Note: workflowBridge/policyBridge/constructorBridge operate on SemanticSession not ConversationSession — intentionally separate layers); quickAddBridge.ts (QuickAdd as UI projection of ConversationSession; sessionStatusToQuickAddStatus mapping; quickAddFromSession/applyQuickAddToSession/initialQuickAddForSession); 145 new tests; 1548 total green.
- **2026-05-24** — Dark mode support for chat: C_DARK token set, useChatTokens() hook, 29 chat components updated; 427 tests green, build passes.
- **2026-05-24** — Mobile UX cleanup: deleted dead BottomNav.tsx, MenuOverlay footer safe-area fix (max 32px/env), CLAUDE.md changelog entry.
- **2026-05-24** — Product Consolidation Phase: deleted QuickAddBar orphan chain (useExpenseInputFlow/ClarificationPanel/draftSlice/inputSessionSlice), stripped semantic pipeline stages (phraseExtractor/fragmentExtractor/scopeResolver/purchaseGrouper) from inputPipeline, trimmed ParserContext 17→9 fields, reduced bot delays 600ms→250ms/400ms→150ms, Composer iOS safe-area + onPlus routing, ChatScreen scroll fix.
- **2026-05-24** — Repository consolidation: moved 6 design system folders to design-archive/, moved 5 reference docs to docs/, deleted to-fix-month.jpg, removed 8 empty src/features/ dirs, updated .gitignore and tsconfig.json exclude list.
- **2026-05-24** — Expense Brain Stabilization Refactor (unified ExpenseContext pipeline): expenseContext.ts (TokenRole×4, ClassifiedInputToken with raw+normalized+role, ConfidenceProfile amount×0.3+merchant×0.3+category×0.4, ContextSignal with kind/source/weight/detail, CandidateCategory, ExpenseContext composing over ParserContext); confidenceEngine.ts (computeConfidenceProfile — amount: 0.95/0, merchant: 0.90/0.75/0.30/0, category: gap-based 0.20/0.50/score; buildContextSignals maps parser signals + top suggestion reasons with source+weight); merchantClassifier.ts (classifyInputTokens — merchant/item/amount/noise roles from parserContext; extractMerchantTokens/ItemTokens/NormalizedTokens helpers); splitMemoryEngine.ts (SplitPreset view model; findMatchingSplitCombos/rankSplitCombos count-DESC+recency-tiebreak/splitComboConfidence saturate-at-5/buildSplitPresets/hasSplitPresets/topSplitPreset — pure, no Redux); expenseContextBuilder.ts (buildExpenseContext single entry point — 6-stage pipeline: parseInput→classifyTokens→computeSuggestions→computeConfidenceProfile→buildContextSignals→assemble; EMPTY_MEMORY sentinel; memory optional; archived categories excluded); suggestionInspector.ts (SuggestionExplanation+ContextInspectionReport view models; explainSuggestion/inspectExpenseContext/explainAllSuggestions — 6 diagnostic flags: LARGE_AMOUNT/MULTIPLE_ITEMS/LOW_CATEGORY_CONFIDENCE/UNKNOWN_MERCHANT/NO_CANDIDATES/NO_AMOUNT); quickAddState.ts (QuickAddStatus×5 state machine; PendingExpense+QuickAddState; initialQuickAddState/markParsing/applyContextToQuickAdd/confirmSuggestion/confirmSplitPreset/resetQuickAdd pure transitions; isReadyToSave/hasSuggestions/isSplitPending query helpers); 88 new tests; 1403 total green.
