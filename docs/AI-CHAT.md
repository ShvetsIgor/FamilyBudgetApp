# AI expense entry in chat

Ordinary messages on `/home` use the existing Groq expense parser. Examples:
`Вчера купила продукты на 85 шекелей в Даббах`, `Coffee 12.50 USD yesterday`.
The card displays the recognized amount, currency and date. Selecting a category
saves the expense; All categories, Split receipt and Sort later remain available.
No expense is saved just by sending a message.

Exact supermarket-and-amount shorthand (`Рами Леви 250`, `Rami Levy 100`)
uses the merchant dictionary instead of asking Groq to invent a category. It
uses the profile currency and the request's local today, then opens the same
confirmation card. Extra category, currency or date words still go through Groq.
One confirmed category choice is enough to rank it on the next merchant-only
input. Known English/Russian/Hebrew spellings share the existing account-local
merchant history; history is kept on this device, not synced across devices.
Without history, supermarkets offer an active owned Groceries category if it
exists (custom IDs supported). Missing/archived categories are never activated.
Split habits still take precedence over single-category suggestions.

`+100 salary` retains the existing income parser; slash commands bypass Groq.
Each AI message is independent. After a clarification, send the complete expense
again, including the amount. Multiple separate expenses in one message are not
supported yet. Split is an explicit next step for one purchase total.

If a suitable category does not exist, chat proposes a display-only name and asks
the user to add/activate it in Categories, then resend. Nothing is automatically
created. Missing amounts, unsupported currencies (including EUR), income without
the `+` workflow and uncertain results do not produce savable expense drafts.

Network/provider errors offer retry or manual entry via `+`. There is no silent
fallback that could reinterpret foreign currency as the profile currency.

## Server contract

`POST /api/chat/parse-expense`, Firebase ID token in `Authorization: Bearer …`.
JSON body: `{ "text": "Milk 20", "timeZone": "Asia/Jerusalem" }`.
Uses the existing bounded Siri request reader (8 KiB / 2000 characters).
Body uid/categories/currency are ignored; context is loaded from the verified
owner's profile. Firebase Admin checks token signature, expiry and revocation.
The service account therefore needs Firebase Auth user-read permission in addition
to the existing Firestore access. No new environment variables are needed.

`package.json` overrides only `jwks-rsa`'s `jose` dependency to the dual CJS/ESM
version 5.10.0. Its default v6 dependency crashes during Firebase Auth module
initialization under Vercel's loader (`ERR_REQUIRE_ESM`), even on Node 24.
See [upstream issue](https://github.com/auth0/node-jwks-rsa/issues/507).
`firebaseAdmin.runtime.test.ts` reproduces that loader constraint in a child
process and checks real RSA signing-key conversion. Remove the override only
after an upstream fix and a deployed API cold-start check.

Siri tokens do not authorize this endpoint. API key and Admin credentials stay on
the server. Responses have `Cache-Control: no-store`.

- 200: `{ ok: true, expense: ChatExpenseDraft }`, a draft only. Category is null
  only for a dictionary shorthand marked `merchantOnly: true`.
- 422: `{ ok: false, error: "clarification_required" | "category_required", message }`.
- 401: invalid/expired/revoked auth; 409: missing supported profile settings.
- 400/413: invalid input; 429: shared quota; 503: unavailable infrastructure.

AI quota is shared with Siri: 10 attempts/minute, 100/day per owner. Dictionary
shorthand does not call the provider or consume AI quota. Existing quota
documents retain their location under `shortcutUsage`; no migration is required.
This endpoint never writes expenses, monthlyStats, categories or messages.
The browser uses existing message writes and expense + monthlyStats batches.
Late results from another auth session are discarded. The browser timeout is 25s;
there is no automatic retry and no duplicate financial write on a parse retry.

## Verification

Unit tests cover authentication, account isolation, quotas, validation, provider
failures, timeout/session changes, pinned currency/date, explicit confirmation and
category privacy. `e2e-emulated/chat-ai.spec.ts` exercises real Firebase emulator
chat/expense persistence and the mobile UI with only the Groq response stubbed.
The existing opt-in `npm run eval:ai` covers the actual shared Groq parser.

Verified on 2026-10-07: 819 unit tests passed (including the Vercel loader and
supermarket shorthand regressions); lint, non-incremental TypeScript
and production-mode build passed; all 4 chat UI scenarios passed against Auth +
Firestore emulators. The confirmation test checks the stored USD expense and
its USD monthly/category aggregates. Firebase Admin Auth user-read permission
was also verified in the configured project. Initial chat input waits for category
loading, preventing a fast AI response from losing its category suggestion.
The supermarket UI scenario confirms Groceries, reloads the page and checks
the next shorthand input and persisted merchant history.

On the deployed PWA, accept the update, type an expense and confirm the category.
Check the saved card and Expenses list. Test a foreign currency, a relative date,
a nonexistent category and a message without an amount. Testing real saves
creates real expenses; delete any test entries afterward.
