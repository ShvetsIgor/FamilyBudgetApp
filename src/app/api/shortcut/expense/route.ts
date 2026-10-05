import { consumeSiriQuota } from '@/features/ai/siriRateLimit';
import { findSiriReceipt, siriRequestFingerprint, SiriRequestConflictError } from '@/features/ai/siriIdempotency';
import { addSiriExpense, SiriExpenseValidationError } from '@/features/expenses/services/siriExpensesService';
import { resolveShortcutAuthorization } from '@/features/ai/siriAuth';
import { parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import { readSiriRequest, SiriRequestError } from '@/features/ai/siriRequest';
import { loadSiriContext, SiriProfileError, type SiriContext } from '@/features/ai/siriContext';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  let uid: string | null;
  try {
    uid = await resolveShortcutAuthorization(request.headers.get('authorization'));
  } catch {
    // Never expose SDK diagnostics, credentials or the submitted bearer value.
    return Response.json(
      { ok: false, error: 'auth_unavailable', message: 'Authorization is temporarily unavailable. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!uid) {
    return Response.json(
      { ok: false, error: 'unauthorized', message: 'A valid personal Siri token is required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' } },
    );
  }

  let input: Awaited<ReturnType<typeof readSiriRequest>>;
  try { input = await readSiriRequest(request); }
  catch (error) {
    return Response.json(
      { ok: false, error: 'invalid_request', message: error instanceof SiriRequestError ? error.message : 'Could not read the request.' },
      { status: error instanceof SiriRequestError ? error.status : 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const fingerprint = siriRequestFingerprint(input.text, input.timeZone);
  if (input.requestId) {
    try {
      const receipt = await findSiriReceipt(uid, input.requestId, fingerprint);
      if (receipt) return Response.json(
        { ok: true, saved: true, replayed: true, expense: receipt.expense,
          message: receipt.language === 'ru'
            ? `Уже записано. ${receipt.expense.amount} ${receipt.expense.currency}, ${receipt.expense.categoryName}.`
            : `Already saved. ${receipt.expense.amount} ${receipt.expense.currency}, ${receipt.expense.categoryName}.` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (error) {
      const conflict = error instanceof SiriRequestConflictError;
      return Response.json(
        { ok: false, error: conflict ? 'request_conflict' : 'request_check_unavailable',
          message: conflict ? 'Use a new requestId for a different expense.' : 'Could not check the previous request. Retry with the same requestId.' },
        { status: conflict ? 409 : 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  try {
    const quota = await consumeSiriQuota(uid);
    if (!quota.allowed) return Response.json(
      { ok: false, error: 'rate_limited', retryAfter: quota.retryAfter,
        message: `Too many Siri requests. Try again in ${quota.retryAfter} seconds.` },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(quota.retryAfter) } },
    );
  } catch {
    return Response.json(
      { ok: false, error: 'rate_limit_unavailable', message: 'Could not check the request limit. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let context: SiriContext;
  try {
    context = await loadSiriContext(uid);
    if (context.categories.length === 0) {
      return Response.json(
        { ok: false, error: 'no_active_categories', message: context.language === 'ru'
          ? 'Добавьте категорию расходов в приложении.' : 'Add an expense category in the app.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch (error) {
    const invalidProfile = error instanceof SiriProfileError;
    return Response.json(
      { ok: false, error: invalidProfile ? 'profile_required' : 'context_unavailable',
        message: invalidProfile ? 'Set a supported currency and language in your account.' : 'Account data is temporarily unavailable. Try again later.' },
      { status: invalidProfile ? 409 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let parsed;
  try {
    parsed = await parseExpenseText({
      text: input.text, todayKey: input.todayKey,
      categories: context.categories.map(({ id, name }) => ({ id, name })),
      defaultCurrency: context.currency, language: context.language,
    });
  } catch {
    return Response.json(
      { ok: false, error: 'parser_unavailable', message: context.language === 'ru'
        ? 'Распознавание временно недоступно. Попробуйте позже.' : 'Expense recognition is temporarily unavailable. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const validation = validateParsedExpense(parsed, { categories: context.categories, todayKey: input.todayKey });
  if (!validation.valid) {
    const question = parsed.needsClarification && parsed.clarificationQuestion
      ? parsed.clarificationQuestion
      : context.language === 'ru' ? 'Уточните сумму, валюту, категорию и дату расхода.' : 'Please clarify the amount, currency, category and date.';
    return Response.json(
      { ok: false, error: 'clarification_required', needsClarification: true, message: question },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const saved = await addSiriExpense(uid, validation.expense, input.timeZone, input.requestId
      ? { id: input.requestId, fingerprint, language: context.language } : undefined, context.language);
    return Response.json(
      { ok: true, saved: true, expense: saved,
        message: context.language === 'ru'
          ? `Записано. ${saved.amount} ${saved.currency}, ${saved.categoryName}.`
          : `Saved. ${saved.amount} ${saved.currency}, ${saved.categoryName}.` },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SiriRequestConflictError) return Response.json(
      { ok: false, error: 'request_conflict', message: 'Use a new requestId for a different expense.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
    const invalid = error instanceof SiriExpenseValidationError;
    return Response.json(
      { ok: false, error: invalid ? 'category_changed' : 'save_unavailable',
        message: context.language === 'ru'
          ? invalid ? 'Категория изменилась. Уточните категорию расхода.' : 'Не удалось подтвердить сохранение. Проверьте список расходов в приложении.'
          : invalid ? 'The category changed. Please clarify the expense category.' : 'Could not confirm the save. Check your expenses in the app.' },
      { status: invalid ? 409 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
