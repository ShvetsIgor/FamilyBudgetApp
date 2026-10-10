# Siri: deployment and request contract

New successful Siri expenses also create a saved card in the owner's chat history,
in the same transaction as the expense and monthly statistics. Cards show “Via Siri”
(“Через Siri” for Russian), the expense date, amount and merchant/category.
Retries with the same request ID do not duplicate cards. Expenses saved before
this integration are not backfilled into chat.

## План и состояние — 2026-10-05

- [x] Накопленные изменения Siri/ИИ отправлены в `master`: `c3531fe0`.
  Graphify-артефакты и секреты исключены.
- [x] Инструкция для английского интерфейса iOS: [SIRI-SETUP.md](SIRI-SETUP.md).
  Краткая инструкция доступна и в аккаунте приложения, внутри Siri tokens.
- [x] Отсутствующая категория: расход не сохраняется; Siri предлагает название
  категории и просит добавить/активировать её в приложении либо назвать существующую.
  Следующая диктовка использует новый requestId. Категории автоматически не создаются.
- [x] Отдельная opt-in проверка настоящего Groq на вымышленных фразах без записи расходов.
- [ ] Проверить на iPhone после обновления: карточку в чате, инструкцию и голосовой
  ответ для категории, которой нет у пользователя.
- [x] Подключить ИИ к обычному чату: `/api/chat/parse-expense` проверяет Firebase
  ID token, использует общий `missingCategoryMessage` и `category_required`.
  В чате возвращается черновик для подтверждения; сохранение остаётся в существующем
  потоке. Подробности и сценарии проверки: [AI-CHAT.md](AI-CHAT.md).

## Deployment

The Next.js API runs on Vercel's Node runtime. Required Production variables:
`GROQ_API_KEY`, `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY_BASE64`, and the existing public Firebase settings.
The Admin project must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
Secrets must never use the `NEXT_PUBLIC_` prefix.

Deploy `firestore.rules` and `firestore.indexes.json` with the feature. The
`shortcutTokens.tokenHash` collection-group index must be ready.
Preview needs its own server variables before authenticated API testing works.

## Personal token

Account → Siri tokens → enter a device name → Create → copy the secret once.
Keep it in the personal shortcut, never in a shared shortcut or a repository.
Revoking the token in Account blocks subsequent authenticated requests.

## Request

`POST https://family-budget-app-pi.vercel.app/api/shortcut/expense`

Headers: `Authorization: Bearer YOUR_PERSONAL_TOKEN`, `Content-Type: application/json`.

```json
{
  "text": "Кофе 18 шекелей",
  "timeZone": "Asia/Jerusalem",
  "requestId": "20261005120000123"
}
```

Use the device's IANA timezone; change it when travelling. `text` is limited to
2000 characters and the entire body to 8192 UTF-8 bytes. Only single expenses
are supported; currencies are ILS, USD, CAD and RUB. The owner's profile language
and default currency apply. Categories must already be active in the app.

Generate a new ID once before sending (the guide uses a timestamp including
milliseconds; callers may also use a UUID). Keep the same text, timezone and ID on
a network retry. New expense, corrected text or category setup after a rejected
request → new ID. `requestId` is optional in the API, but the shortcut should always
send it. A full restart of the simple timestamp shortcut generates a new ID and
does not deduplicate an earlier run; see the guide before retrying after a network error.

## Responses

Read `message` for speech. Treat only `ok: true` as a confirmed save.

- 201: saved, with expense ID, amount, currency, date and category name.
- 200: completed request replayed; no new expense or Groq call.
- 400/413: invalid or oversized input.
- 401: missing, invalid or revoked token.
- 409: profile/category setup issue, category changed, or request ID reused for different input.
- 422: clarification required; no expense saved. Correct the phrase and use a new ID.
- `category_required` (409 for an empty active list, or one holding only the
  app-managed Savings bucket; otherwise 422): `saved: false`,
  `categoriesPath: "/categories"` and optionally `suggestedCategoryName`. This name is
  a display-only model suggestion, not an existing category or permission to create
  one. Add/activate a category in the app or explicitly name an existing one, then
  dictate again. Archived and unactivated library categories are not parser choices.
- 429: wait the `Retry-After` seconds (also in `retryAfter`) before retrying.
  `error: "rate_limited"` is this account's quota; `error: "ai_capacity"` means
  recognition is busy service-wide (the global ceiling, or Groq's own limit and
  the cooldown it set) and is not the account's fault.
- 503: a dependency failed. A save may already have committed if its response
  was lost; retry with the SAME request ID, never a new one.

Quota is shared by all tokens of an account: 10 attempts per 60-second window,
100 per 24-hour window. Windows reset after expiry, starting with their first
accepted attempt. Failed new attempts consume quota; completed replays do not.

## Deployment verification

1. Missing/invalid token → JSON 401, with no save.
2. Create a disposable token in Account. Dictate one clearly named active-category
   expense; verify the returned category/amount/date and monthly statistics.
3. Repeat exactly the same request ID; verify the same expense ID and unchanged total.
4. Send the same ID with different text → 409.
5. Test a private category: expense must remain private.
6. Revoke the disposable token → 401 on the next call.
7. Delete any test expense through the app so statistics are reversed correctly.

Live expense creation changes the owner's real budget. Run these steps only with
an agreed test account/expense. Emulator tests cover concurrency and quota exhaustion;
do not consume real Groq requests simply to exhaust a production quota.

## Live AI evaluation (no financial writes)

`npm run eval:ai` uses `GROQ_API_KEY` from the environment or `.env.local` to run
synthetic phrases against the real model, then applies the production validator.
It never imports Firebase or the persistence service. It is excluded from `npm test`
and CI; run it explicitly when needed. Cases cover amounts, supported currencies,
dates, missing amount/category, category activation, unsupported EUR, income and
multiple expenses. Requests are spaced to reduce Groq burst-limit errors. A provider
429 is an infrastructure failure, not evidence of a parsing error. A passing sample
does not guarantee all natural-language inputs will be interpreted correctly.
