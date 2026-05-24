# Family Budget — Design System

A focused, mobile-first design system for **Family Budget**, a Progressive Web App that helps couples and families log expenses, share a budget, set savings goals, and watch monthly trends. The product is a personal finance app, not a fintech dashboard — the visual language stays calm, friendly, and shows numbers clearly above everything else.

## What is Family Budget?

- **One sentence:** track family money in seconds.
- **Surfaces:** a single mobile web app (PWA, installable). No marketing site, no admin surface yet.
- **Audience:** couples / parents managing a shared monthly budget.
- **Languages:** English (default), Russian, Hebrew (RTL).
- **Currencies:** ILS (₪, default), USD ($), CAD (CA$), RUB (₽).
- **Account modes:** personal or family (owner + invited members; shared expenses and stats; per-entry **secret** flag hides items from the family view).

### Core screens
1. **Home / Quick Add** — month balance hero, three quick-action FABs (income / expense / savings), recent expenses, upcoming recurring bills.
2. **Expenses** — list grouped by day, searchable, filterable by category, with an Income tab.
3. **Add Expense** — single-form, amount-first, with category picker, optional split, payment method, privacy.
4. **Statistics** — donut + bar charts via Recharts, per-category breakdown with budget bars.
5. **Analytics** — averages, 6-month trend, top categories, day-of-week chart.
6. **Account** — profile, family management, theme, currency, language, notifications, CSV export.
7. **Auth** — email/password + Google sign-in.

## Source material

Everything in this system was lifted directly from one place:

- **GitHub:** `ShvetsIgor/FamilyBudgetApp` (private, branch `master`).
  - Stack: Next.js 15 + TypeScript + Tailwind + shadcn/Radix + Redux Toolkit + Firebase + next-intl + recharts.
  - Tokens: `src/app/globals.css` (HSL CSS variables, light + dark).
  - Components: `src/features/**` (auth, expenses, categories, savings, recurring) and `src/shared/components/**` (Header, BottomNav).
  - Copy: `src/messages/en.json` (also ru/he).
  - Category palette: `src/features/categories/services/defaultCategories.ts`.

Imported source under `src/…` is kept inside this project for reference. Do **not** treat it as production code — it is design context only.

> No Figma file was provided. No marketing site exists.

## Index — what is where

```
README.md                  ← you are here
SKILL.md                   ← Agent-Skill manifest (Claude Code compatible)
colors_and_type.css        ← CSS variables: colors, type scale, spacing, radii, shadows

assets/                    ← logos, app icons, manifest
fonts/                     ← (Inter loaded from Google Fonts; no local files yet — see Caveats)
preview/                   ← Design System tab cards (700×~150 each)
ui_kits/
  app/
    README.md
    index.html             ← interactive click-thru of the mobile app
    *.jsx                  ← React components (Header, BottomNav, ExpenseCard, …)
src/                       ← imported codebase (read-only reference)
```

---

## VISUAL FOUNDATIONS

**Posture.** Mobile-first, single column. The whole product lives in a narrow phone viewport (~390 px). Every screen has a sticky `Header` (offline indicator + 3 utility icons) and a fixed `BottomNav` (4 tabs, the center one a circular primary FAB). Content scrolls between them with `padding-bottom: env(safe-area-inset-bottom)`.

**Color vibe — Warm & Friendly.** Reads as a calm home object, not a fintech app. Background is cream `#FBF6EE`, text is deep brown `#3D2C1F`. The hero, FAB and primary actions use **terracotta `#E07A5F`**; income/budgets-on-track use **sage `#81B29A`**; savings + caution use **warm yellow `#F2CC8F`**. No greys other than warm `#8E7A66` for secondary text. Light mode is the default; dark mode keeps the terracotta accent on a `#241B14` warm-brown ground.

- Tints are `color + '22'` (~13 % alpha) for category backgrounds.
- Borders are warm: `hsl(35 28% 86%)`.
- Shadows are brown-tinted, not pure black: `rgba(61,44,31, .04–.12)`.

**Typography.** A single family, **Nunito** (400/600/700/800/900), loaded from Google Fonts. Rounded humanist sans — chosen to match the soft shapes. Tabular-nums everywhere amounts appear. Hero amount is **44 px / 900** with `-0.025em` tracking. Inputs are 16 px to prevent iOS zoom-on-focus.

**Backgrounds.** Cream base. The single decorative move is the **month balance hero** — a terracotta `rounded-[32px]` card with two soft white-alpha circles in the corners and a peach drop-shadow `rgba(224,122,95,.25)`. Cards are flat white on cream + `rounded-[22px]` + 1 px warm border + brown-tinted shadow. No gradients on backgrounds, no photos, no noise.

**Corner radii.** Pillow-y and generous:

| Element | Var | px |
|---|---|---|
| Chips, badges | `--radius-sm` | 12 |
| Inputs, primary buttons | `--radius-md` | 16 |
| Cards, list containers | `--radius-lg` | 22 |
| Hero balance, sheet tops | `--radius-xl` | 32 |
| FAB, pills, nav | `--radius-pill` | 9999 |
| Avatars | `rounded-full` | 9999 |

**Shadows.** Used very sparingly. The only ambient shadow is on the home hero card (`shadow-lg shadow-primary/20`) and on the FAB (`shadow-xl shadow-primary/30`). Regular cards rely on the 1 px border instead.

**Animation.** Almost none. What exists is restrained:
- `active:scale-[0.98]` on primary submit buttons and `active:scale-95` on the FAB-style quick-add buttons — a press shrink.
- `transition-colors` on every interactive surface (hover and tab swap).
- `animate-spin` on a 2 px-bordered circle for loading.
- No fades, no bounces, no parallax. RTL flips `dir` and that is it.

**Hover & press.**
- **Hover:** lists use `hover:bg-muted/50` (a 50 % alpha tint). Links use `hover:underline`. Icon buttons use `hover:bg-muted` plus `text-foreground` color change.
- **Press:** primary buttons and FABs use `active:scale-[0.98]` / `active:scale-95`. Selected-state tab buttons get `bg-card shadow-sm` against a muted track.

**Selected & focus.**
- Inputs: `focus:border-primary focus:ring-2 focus:ring-primary/20`.
- Selectable cards (payment method, privacy, savings goal): `border-primary bg-primary/10 text-primary`.
- Bottom-nav tab: `text-primary` on icon + label.

**Transparency & blur.** One use: the sticky `Header` is `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`. Nothing else uses blur.

**Imagery.** None in the product itself. The app icon (`assets/icon-512.png`) is currently a solid flat blue square — a placeholder. There are no illustrations, mascots, or photos.

**Iconography.** Two parallel systems — see ICONOGRAPHY below.

**Charts.** Recharts. `PieChart` with `innerRadius=50, outerRadius=80` for the category donut; `BarChart` for monthly trend (rounded top corners, `barGap=4`). Tooltips inherit `--border` and `border-radius: 12`.

**Layout rules.**
- Horizontal page padding is consistent **px-4** (16 px); cards inside the page get **px-4 py-3** internally.
- Vertical rhythm uses `gap-4` (16 px) between sections, `gap-2` (8 px) inside cards.
- The bottom nav is `h-16` (64 px) with the center FAB `h-12 w-12` (48 px touch target) and on Home a larger `h-20 w-20` (80 px) primary add button.
- Touch targets are always ≥ 44 px; small icon buttons are `p-2` inside a `rounded-full` hit area.

---

## CONTENT FUNDAMENTALS

**Voice.** Plain, short, instructional. Second-person where it appears at all ("Add your first expense →", "Sign out?", "Delete this expense?"). No marketing copy, no metaphors, no exclamation points outside of confirmations. The product never refers to itself by name inside its own UI — the only place "Family Budget" appears is the page `<title>` and the manifest; the header logo just says **"Budget"**.

**Casing.** Title Case for screen titles ("Add Expense", "Statistics"), Sentence case for inline labels and helpers ("Amount · ILS", "Tap + to add your first expense"). Buttons are Title Case ("Sign In", "Save Expense", "Send Invite"). Currency codes are uppercase (`ILS`, `USD`).

**Microcopy patterns.**
- Confirm prompts are one sentence with a question mark: "Delete this expense?", "Sign out?".
- Empty states are an emoji + a 2–4-word headline + one optional helper line:
  - `📭 No expenses this month / Tap + to add your first expense`
  - `🔍 No results / Try a different search or filter`
  - `💰 No income this month / Add income →`
  - `📊 No data for this period`
- Date headings group day rows: "Today", "Yesterday", "Wednesday, Nov 8".
- Money: prefix only when meaningful — `+₪3,200` for income, `-₪48` for expenses; never both for the same number. `₪0` when zero. Symbol always before the number.
- Status labels are status + value: `Offline`, `✓ Invite sent successfully`, `✓ Notifications enabled`.
- Inline helpers use a parenthetical hint: `Store / Place (optional)`, `Comment (optional)`.

**Emoji.** Yes, deliberately. Emoji are the icon system for **categories** and act as visual punctuation in two specific places:
- **Category icons** — every category in `defaultCategories.ts` carries an emoji (`🍽️ Food`, `🚗 Transport`, `🐷 Savings`). They are rendered inside a tinted square (`backgroundColor: color + '20'`).
- **Section labels in i18n strings** — `🎯 Savings Goals`, `🔄 Recurring Payments`, `🏷️ Categories`, `📩 Family Invite`, `👨‍👩‍👧 Create Family`, `☀️ Light`, `🌙 Dark`. These are baked into the translation files.
- Currency flags act as language switches: `🇺🇸 English`, `🇷🇺 Русский`, `🇮🇱 עברית`.

Emoji are never decorative on landing pages or marketing screens — they only show up as functional indicators or category glyphs.

**Action verbs.** "Add", "Save", "Save Changes", "Delete", "Sign In", "Sign Up", "Sign Out", "Accept", "Decline", "Leave Family", "Dissolve Family", "Send Invite", "Download CSV". Cancel actions are sometimes the bare glyph `✕`.

**Errors.** One-sentence, lowercased problem + retry suggestion: "Invalid email or password.", "Failed to save. Try again.", "Failed to send invite. Try again." Rendered as a small destructive-tinted pill: `bg-destructive/10 text-destructive` inside the form, never as a toast.

---

## ICONOGRAPHY

Family Budget runs **two parallel icon systems**, each with a clear job.

### 1. `lucide-react` — UI affordances

Installed as a dependency (`"lucide-react": "^1.14.0"`). These render structural / utility actions:

- `Plus` — Add (nav center + Add buttons)
- `List` — Expenses tab
- `BarChart2` — Statistics tab
- `Lightbulb` — Analytics tab
- `Settings` — Categories link in header
- `UserCircle` — Account
- `Repeat2` — Recurring payments
- `WifiOff`, `RefreshCw` — offline / syncing indicators
- `ChevronDown`, `Check` — picker affordances
- `TrendingUp`, `PiggyBank` — quick-add quick-tile glyphs

Visual style: outline, 1.5 px stroke (Lucide default), neutral color (`text-muted-foreground` or `text-primary` when active). Sizes step in 1 px-rem multiples: `h-3.5 w-3.5` (14), `h-4 w-4` (16), `h-5 w-5` (20), `h-6 w-6` (24), `h-9 w-9` (36) for the big FAB.

In this design system we load Lucide from CDN (`https://unpkg.com/lucide-static`) inside HTML demos so we don't have to bundle the npm package. The icon set is identical.

### 2. **Emoji** — Categories and stateful labels

Emoji are the entire category illustration system. Every default category in `defaultCategories.ts` has both an emoji glyph and a hex color (see colors_and_type.css). They appear:

- Inside the rounded-square `CategoryIcon` (tinted background using the category color at 12.5 % alpha).
- Inside picker rows, filter chips, expense cards.
- Inline in i18n strings as section markers (`🔄 Recurring Payments`).

This is intentional — it keeps the app instantly localizable, requires no asset pipeline, and inherits whatever emoji font the OS provides. Don't replace these with Lucide icons.

### 3. Unicode / typographic glyphs

A handful of glyphs are used like icons:
- `←` in "← Back"
- `→` in "Add your first expense →", row affordances
- `·` as a separator in metadata rows
- `✓` for confirmation states
- `✕` as a cancel/close affordance
- `✎` for inline edit
- `⚠` in `"⚠ Over"` budget label

### 4. App icon / logo

The codebase ships placeholder PNG app icons (`public/icons/icon-{192,512}.png`) — a solid flat blue square. There is no wordmark beyond the literal text "Budget" rendered in the header. **Flagged as a caveat below** — a real brand mark would substantially improve the system.

---

## Caveats / open questions

- **No real logo.** The shipped PWA icon is a flat blue square placeholder. We need a real mark.
- **No marketing site, no Figma file.** All design context is reverse-engineered from the Next.js codebase.
- **Inter is loaded from Google Fonts CDN.** The repo uses `next/font/google` for self-hosting — when productionising the SKILL, we should drop `Inter-{Regular,Medium,SemiBold,Bold}.ttf` into `fonts/` for offline use.
- **Hebrew RTL** is supported in the app but I haven't built a dedicated RTL preview card; the existing layout flips correctly via `dir="rtl"`.
- The PWA app icon needs a redesigned mark with the "Budget" wordmark or a piggy-bank glyph.

---

## Quick start

1. Open the **Design System** tab in this project to browse cards (foundations, components, screens).
2. Open `ui_kits/app/index.html` for an interactive click-through of the mobile app.
3. Drop `colors_and_type.css` into any new prototype and you have the full token set.
4. Use Lucide via `<script src="https://unpkg.com/lucide@latest"></script>` and call `lucide.createIcons()`.
