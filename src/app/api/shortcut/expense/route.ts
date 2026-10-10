import { consumeAiQuota, recordAiCooldown } from '@/features/ai/siriRateLimit';
import { isAppManagedSavingsCategory } from '@/features/categories/policy/categoryPolicy';
import { findSiriReceipt, siriRequestFingerprint, SiriRequestConflictError } from '@/features/ai/siriIdempotency';
import { addSiriExpense, SiriExpenseValidationError } from '@/features/expenses/services/siriExpensesService';
import { resolveShortcutAuthorization } from '@/features/ai/siriAuth';
import { ExpenseParserCapacityError, parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { missingCategoryMessage } from '@/features/ai/expenseParser/categoryClarification';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import { readSiriRequest, SiriRequestError } from '@/features/ai/siriRequest';
import { loadSiriContext, SiriProfileError, type SiriContext } from '@/features/ai/siriContext';
import { reportProviderCapacity, reportServerFailure } from '@/shared/lib/serverMonitoring';

export const runtime = 'nodejs';
const ROUTE = 'siri_expense';

function limited(error: 'rate_limited' | 'ai_capacity', retryAfter: number, message: string) {
  return Response.json(
    { ok: false, error, retryAfter, message },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: Request): Promise<Response> {
  let uid: string | null;
  try {
    uid = await resolveShortcutAuthorization(request.headers.get('authorization'));
  } catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'auth', error });
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
      if (!conflict) reportServerFailure({ route: ROUTE, stage: 'request_check', error });
      return Response.json(
        { ok: false, error: conflict ? 'request_conflict' : 'request_check_unavailable',
          message: conflict ? 'Use a new requestId for a different expense.' : 'Could not check the previous request. Retry with the same requestId.' },
        { status: conflict ? 409 : 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  try {
    const quota = await consumeAiQuota(uid);
    if (!quota.allowed) return limited(quota.reason === 'global' ? 'ai_capacity' : 'rate_limited', quota.retryAfter,
      quota.reason === 'global'
        ? `Expense recognition is busy. Try again in ${quota.retryAfter} seconds.`
        : `Too many Siri requests. Try again in ${quota.retryAfter} seconds.`);
  } catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'rate_limit', error });
    return Response.json(
      { ok: false, error: 'rate_limit_unavailable', message: 'Could not check the request limit. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let context: SiriContext;
  try {
    context = await loadSiriContext(uid);
    // The app-managed Savings bucket alone is not a category to file spending under.
    if (!context.categories.some((category) => !isAppManagedSavingsCategory(category))) {
      return Response.json(
        { ok: false, saved: false, error: 'category_required', needsClarification: true,
          message: missingCategoryMessage(context.language), categoriesPath: '/categories' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch (error) {
    const invalidProfile = error instanceof SiriProfileError;
    if (!invalidProfile) reportServerFailure({ route: ROUTE, stage: 'context', error });
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
  } catch (error) {
    if (error instanceof ExpenseParserCapacityError) {
      reportProviderCapacity(ROUTE);
      await recordAiCooldown(error.retryAfter);
      return limited('ai_capacity', error.retryAfter, context.language === 'ru'
        ? `Распознавание сейчас перегружено. Попробуйте через ${error.retryAfter} с.`
        : `Expense recognition is busy. Try again in ${error.retryAfter} seconds.`);
    }
    reportServerFailure({ route: ROUTE, stage: 'parser', error });
    return Response.json(
      { ok: false, error: 'parser_unavailable', message: context.language === 'ru'
        ? 'Распознавание временно недоступно. Попробуйте позже.' : 'Expense recognition is temporarily unavailable. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const validation = validateParsedExpense(parsed, { categories: context.categories, todayKey: input.todayKey });
  if (!validation.valid) {
    if (validation.reason === 'invalid_category' || (parsed.amount !== null && parsed.amount > 0
      && parsed.suggestedCategoryName)) {
      return Response.json(
        { ok: false, saved: false, error: 'category_required', needsClarification: true,
          suggestedCategoryName: parsed.suggestedCategoryName ?? null, categoriesPath: '/categories',
          message: missingCategoryMessage(context.language, parsed.suggestedCategoryName) },
        { status: 422, headers: { 'Cache-Control': 'no-store' } },
      );
    }
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
    if (!invalid) reportServerFailure({ route: ROUTE, stage: 'save', error });
    return Response.json(
      { ok: false, error: invalid ? 'category_changed' : 'save_unavailable',
        message: context.language === 'ru'
          ? invalid ? 'Расход не сохранён: категория изменилась. Добавьте или активируйте категорию в приложении и повторите диктовку.' : 'Не удалось подтвердить сохранение. Проверьте список расходов в приложении.'
          : invalid ? 'Expense not saved: the category changed. Add or activate a category in the app and dictate again.' : 'Could not confirm the save. Check your expenses in the app.' },
      { status: invalid ? 409 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
