# Siri: deployment and request contract

New successful Siri expenses also create a saved card in the owner's chat history,
in the same transaction as the expense and monthly statistics. Cards show “Via Siri”
(“Через Siri” for Russian), the expense date, amount and merchant/category.
Retries with the same request ID do not duplicate cards. Expenses saved before
this integration are not backfilled into chat.

## Ближайший план — не реализовано

Эти пункты добавлены в план и будут сделаны после восстановления лимита, перед
расширенным тестированием ИИ:

1. Добавить отдельную понятную инструкцию по созданию Shortcut для Siri: английские
   названия действий для новой iOS, URL отдельным первым действием, русский
   `Dictate Text`, `Format Date` для нового `requestId`, JSON-поля, голосовое
   подтверждение и безопасный повтор запроса с тем же ID. Инструкция должна
   соответствовать фактическому production-домену и не содержать реального токена.
2. Предусмотреть сценарий, когда Siri или ИИ распознали категорию, которой нет среди
   активных категорий пользователя. Расход нельзя сохранять молча в случайную
   категорию или автоматически создавать новую без явного согласия. Нужно выбрать
   и реализовать единый поток: понятный ответ с названием ненайденной категории,
   предложение добавить/активировать категорию в приложении, затем повторить
   запрос с новым `requestId`; для чата и Siri использовать согласованные коды
   ошибки и тексты. Отдельно проверить архивную, неактивную и приватную категории.
3. После восстановления лимита создать коммит из накопленных изменений Siri/ИИ,
   правил Firestore, тестов и документации и отправить его в `master`. Перед push
   проверить `git diff --cached`, исключить `graphify-out/`, `.env.local` и любые
   секреты; затем убедиться, что `master` и `origin/master` совпадают.

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

`POST https://YOUR_APP_HOST/api/shortcut/expense`

Headers: `Authorization: Bearer YOUR_PERSONAL_TOKEN`, `Content-Type: application/json`.

```json
{
  "text": "Кофе 18 шекелей",
  "timeZone": "Asia/Jerusalem",
  "requestId": "A-NEW-UUID-FOR-EACH-EXPENSE"
}
```

Use the device's IANA timezone; change it when travelling. `text` is limited to
2000 characters and the entire body to 8192 UTF-8 bytes. Only single expenses
are supported; currencies are ILS, USD, CAD and RUB. The owner's profile language
and default currency apply. Categories must already be active in the app.

Generate the UUID once before sending. Keep the same text, timezone and ID on a
network retry. New dictated expense or corrected text → new UUID. `requestId` is
optional in the API, but the shortcut should always send it to prevent duplicates.

## Responses

Read `message` for speech. Treat only `ok: true` as a confirmed save.

- 201: saved, with expense ID, amount, currency, date and category name.
- 200: completed request replayed; no new expense or Groq call.
- 400/413: invalid or oversized input.
- 401: missing, invalid or revoked token.
- 409: profile/category setup issue, category changed, or request ID reused for different input.
- 422: clarification required; no expense saved. Correct the phrase and use a new ID.
- 429: quota exhausted; wait the `Retry-After` seconds before retrying.
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
