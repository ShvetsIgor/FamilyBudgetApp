# FamilyBudgetApp — Architecture Invariants

This document defines the core architectural invariants of the category system.
Violating these invariants will cause regressions. Read before touching category logic.

---

## Category Model

### Folder
- UI grouping entity only — has no financial meaning
- A folder groups categories visually in pickers and lists
- Folders do NOT appear in expenses, statistics, or analytics
- A category may belong to at most one folder (`category.folderId`)
- Folders may be empty; categories may have no folder (ungrouped)

### Category
- The primary semantic financial entity
- Every expense/income is linked by `categoryId` only — never by folderId
- Categories are flat — there is no parent/child relationship in the active model
- Categories have a stable ID that never changes after creation
- Archived categories are soft-deleted: they remain resolvable by ID for historical display

---

## Core Invariants

1. **Folder = UI grouping only**
   Folders never appear in domain logic, statistics, or financial calculations.

2. **Category = semantic financial entity**
   The categoryId on an expense is the single source of truth.

3. **Expenses link by categoryId only**
   No expense references a folderId, parentId, or subId at the domain layer.

4. **Category IDs are immutable**
   Once written to Firestore, a category ID never changes.

5. **Archived categories are never hard-deleted if referenced**
   Any category that has been used in an expense must be soft-deleted only (`archived: true`).
   The UI hides archived categories from pickers but still resolves them for display.

6. **Parser resolves categoryId only**
   `ParseResult.categoryId` is the only category output from the parser.
   No `parentId`, `subId`, or hierarchy in parse output.

7. **Runtime is flat — not hierarchical**
   No tree traversal, no recursive category logic, no parent/child grouping in runtime code.
   All grouping is folder-based and UI-only.

8. **parentId is migration-only**
   `Category.parentId` exists only for backward compatibility with old Firestore documents.
   It must never be used in runtime logic, pickers, analytics, or statistics.
   All parentId-aware code lives exclusively in `src/features/categories/legacy/`.

---

## Archived Category Policy

Defined in: `src/features/categories/policy/categoryPolicy.ts`

| Context | Behavior |
|---------|----------|
| Pickers / forms | Show only active (`!c.archived`) |
| Suggestions / search | Show only active |
| Expense/income display | Always resolve by ID — show name even if archived |
| Statistics / analytics | Include archived categories referenced by historical data |
| Parser | May resolve archived category by ID — caller decides display |

---

## Legacy Boundary

All parentId-aware code is isolated in:

```
src/features/categories/legacy/
  legacyCategoryAdapter.ts   — helpers for reading old parentId-based Firestore docs
  legacySelectors.ts         — deprecated Redux selectors (used only in migration tests)
```

**Forbidden in active runtime code:**
- `c.parentId` grouping or traversal
- Child category lookup by parentId
- Tree/hierarchy assumptions
- Recursive category logic

---

## Category Resolution

Defined in: `src/features/categories/utils/resolveCategory.ts`

- `resolveCategoryByAlias(alias, categoriesById)` — resolves taxonomy alias or direct ID
- `getCategoryById(id, categoriesById)` — direct ID lookup, always resolvable (even archived)

Resolution order:
1. Direct ID map lookup (O(1))
2. Taxonomy name match (handles legacy random Firestore IDs)
3. Sub-taxonomy name match

---

## File Locations

| Concern | Location |
|---------|----------|
| Category types | `src/shared/types/index.ts` |
| Active policy | `src/features/categories/policy/categoryPolicy.ts` |
| Resolution utils | `src/features/categories/utils/resolveCategory.ts` |
| Folder selectors | `src/features/categories/store/selectors.ts` |
| Grouping hook | `src/features/categories/hooks/useCategoryGroups.ts` |
| Legacy adapters | `src/features/categories/legacy/` |
| Default categories | `src/features/categories/services/defaultCategories.ts` |
| Parser output | `src/shared/types/message.ts` → `ParseResult` |
