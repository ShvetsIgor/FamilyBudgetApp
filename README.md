# Family Budget

A conversational family budget tracker — mobile-first PWA built with Next.js 15, Firebase, and Redux Toolkit.

## Features

- **Chat-based expense entry** — type naturally ("Дабах 350", "Coffee 12") and the bot parses and saves
- **Numpad entry** — fast manual entry with split support
- **Categories** — folder tree with 55 sticker icons, budget limits, library
- **Income tracking** — income entry with categories
- **Statistics** — pie chart, bar chart, monthly breakdown, budget progress
- **Analytics** — trends, day-of-week spending, avg daily by month
- **Recurring payments** — upcoming bills widget
- **Savings goals** — CRUD + contributions
- **Family sharing** — shared budget with family members
- **Dark mode** — full dark/light theme
- **PWA** — installable, offline-capable via Firestore local cache
- **Multilingual** — English, Russian, Hebrew (RTL)

## Stack

- **Next.js 15** — App Router, TypeScript strict
- **Firebase** — Auth + Firestore (offline cache) + Storage
- **Redux Toolkit** — global state
- **Tailwind CSS** + shadcn/ui — styling
- **Recharts** — charts
- **next-pwa** — PWA support
- **date-fns** — date utilities
- **Vitest** — 427 tests

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd FamilyBudgetApp
npm install
```

### 2. Configure Firebase

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase project credentials:

```
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
# → http://localhost:3000
```

### 4. Build

```bash
npm run build   # production build
npm run lint    # type + lint check
npx vitest run  # 427 tests
```

## Deploy to Vercel

1. Push to GitHub
2. Connect repo at [vercel.com](https://vercel.com)
3. Add environment variables (copy from `.env.local`)
4. Deploy — Vercel auto-detects Next.js

Or via CLI:
```bash
npm install -g vercel
vercel --prod
```

## Project Structure

```
src/
  app/          — Next.js App Router pages
  features/     — feature modules (auth, chat, expenses, categories, ...)
  shared/       — shared components, hooks, utils, types
  store/        — Redux store
  messages/     — i18n strings (en/ru/he)
public/         — static assets, PWA icons, manifest
docs/           — reference docs and handoffs
design-archive/ — design system explorations (not part of build)
```

See `CLAUDE.md` for full architecture reference.

## License

Private — all rights reserved.
