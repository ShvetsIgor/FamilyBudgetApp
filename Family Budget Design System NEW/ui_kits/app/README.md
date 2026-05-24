# Family Budget — Mobile App UI Kit

Interactive click-through recreation of the Family Budget Next.js PWA. Components are visually faithful to the codebase under `src/`, but lighter-weight (no Redux, no Firebase, no i18n machinery — just React + CSS variables).

## Files

- `index.html` — the demo. Renders an iPhone-style frame with click-thru routes: Auth → Home → Expenses → Add → Statistics → Analytics.
- `components.jsx` — building blocks: `Header`, `BottomNav`, `MonthHero`, `QuickActions`, `ExpenseRow`, `ListCard`, `Group`, `CategoryChip`, `SegTabs`, `BudgetBar`, `SavingsGoal`, `EmptyState`, `AmountInput`, `TextInput`, `PrimaryButton`, `SecondaryButton`, plus an inline Lucide icon set.
- `screens.jsx` — full screens: `AuthScreen`, `HomeScreen`, `ExpensesScreen`, `AddExpenseScreen`, `StatsScreen`, `AnalyticsScreen`.

## How to use

Open `index.html` directly — it loads React + Babel from CDN, pulls tokens from `../../colors_and_type.css`, and renders everything inline. To reuse a component, copy its definition out of `components.jsx` and import the same CSS variables.

## What's faithful vs simplified

| Faithful | Simplified |
|---|---|
| Color tokens (HSL vars), category palette, type scale | Single hard-coded month of data |
| Sticky header with utility icons + family badge | No real offline/sync indicator |
| Bottom nav with center FAB (h-12 w-12, primary glow) | Only 4 visual tabs (Add / Expenses / Stats / Analytics) |
| Form patterns: amount-first, selectable cards (`bg-primary/10` + `border-primary`) | No real form validation |
| List grouping ("Today", "Yesterday", "Wed, Nov 8") | No real date logic |
| Budget bar over-limit warning, savings goal progress | Static numbers |
| Donut chart (`conic-gradient` substitute for Recharts) | Not Recharts; clickless |

## Caveats

- The phone bezel is a simple custom CSS frame, not the iOS frame starter component.
- No RTL preview yet — the codebase supports it via `dir`, but it's not toggled here.
- Categories panel, recurring detail, family invite flow, settings sub-pages are all out of scope for this kit.
