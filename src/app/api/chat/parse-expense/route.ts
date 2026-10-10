import { resolveChatAuthorization } from '@/features/ai/chatAuth';
import { ExpenseParserCapacityError, parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { missingCategoryMessage } from '@/features/ai/expenseParser/categoryClarification';
import { readSiriRequest, SiriRequestError } from '@/features/ai/siriRequest';
import { consumeAiQuota, consumeChatRequestQuota, recordAiCooldown } from '@/features/ai/siriRateLimit';
import { loadSiriContext, SiriProfileError } from '@/features/ai/siriContext';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import { isAppManagedSavingsCategory } from '@/features/categories/policy/categoryPolicy';
import { isMerchantDraftText, parseMerchantDraft } from '@/features/chat/parser/merchantDraft';
import { reportProviderCapacity, reportServerFailure } from '@/shared/lib/serverMonitoring';

export const runtime = 'nodejs';
const ROUTE = 'chat_parse';

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

// request_rate_limited: this owner's chat requests; rate_limited: this owner's
// AI quota (shared with Siri); ai_capacity: the service-wide ceiling or Groq.
const limited = (error: 'request_rate_limited' | 'rate_limited' | 'ai_capacity', retryAfter: number) =>
  json({ ok: false, error, retryAfter }, 429, { 'Retry-After': String(retryAfter) });

/** Parse only. Confirmation and the existing expense + stats batch stay in chat. */
export async function POST(request: Request): Promise<Response> {
  let uid;
  try { uid = await resolveChatAuthorization(request.headers.get('authorization')); }
  catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'auth', error });
    return json({ ok: false, error: 'auth_unavailable' }, 503);
  }
  if (!uid) return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });

  let input;
  // referenceDate (chat only): the local day the message was written, bounded to the last week.
  try { input = await readSiriRequest(request, { acceptReferenceDate: true }); }
  catch (error) {
    return json({ ok: false, error: 'invalid_request' }, error instanceof SiriRequestError ? error.status : 400);
  }

  // Every metered decision precedes the profile/category reads, which cost Spark quota too.
  try {
    const requests = await consumeChatRequestQuota(uid);
    if (!requests.allowed) return limited('request_rate_limited', requests.retryAfter);
    // One AI budget per owner across Siri and chat. Dictionary drafts use no AI.
    if (!isMerchantDraftText(input.text)) {
      const quota = await consumeAiQuota(uid);
      if (!quota.allowed) return limited(quota.reason === 'global' ? 'ai_capacity' : 'rate_limited', quota.retryAfter);
    }
  } catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'rate_limit', error });
    return json({ ok: false, error: 'rate_limit_unavailable' }, 503);
  }

  let context;
  try { context = await loadSiriContext(uid); }
  catch (error) {
    if (error instanceof SiriProfileError) return json({ ok: false, error: 'profile_required' }, 409);
    reportServerFailure({ route: ROUTE, stage: 'context', error });
    return json({ ok: false, error: 'context_unavailable' }, 503);
  }
  const missingCategory = (name?: string | null) => missingCategoryMessage(context.language, name, 'chat');
  // The app-managed Savings bucket is not a category the user chose to spend in.
  if (!context.categories.some((category) => !isAppManagedSavingsCategory(category))) {
    return json({ ok: false, error: 'category_required', reason: 'no_categories', message: missingCategory() }, 422);
  }

  const merchantDraft = parseMerchantDraft(input.text, context.currency, input.todayKey);
  if (merchantDraft) return json({ ok: true, expense: merchantDraft });

  let parsed;
  try {
    parsed = await parseExpenseText({ text: input.text, todayKey: input.todayKey,
      categories: context.categories.map(({ id, name }) => ({ id, name })),
      defaultCurrency: context.currency, language: context.language });
  } catch (error) {
    if (error instanceof ExpenseParserCapacityError) {
      reportProviderCapacity(ROUTE);
      await recordAiCooldown(error.retryAfter);
      return limited('ai_capacity', error.retryAfter);
    }
    reportServerFailure({ route: ROUTE, stage: 'parser', error });
    return json({ ok: false, error: 'parser_unavailable' }, 503);
  }
  const validation = validateParsedExpense(parsed, { categories: context.categories, todayKey: input.todayKey });
  if (!validation.valid) {
    const categoryRequired = validation.reason === 'invalid_category'
      || (parsed.amount !== null && parsed.amount > 0 && !!parsed.suggestedCategoryName);
    return json({ ok: false, error: categoryRequired ? 'category_required' : 'clarification_required',
      message: categoryRequired ? missingCategory(parsed.suggestedCategoryName)
        : parsed.clarificationQuestion || (context.language === 'ru'
          ? 'Уточни сумму, валюту, категорию и дату и отправь расход целиком ещё раз.'
          : 'Clarify the amount, currency, category and date, then send the complete expense again.') }, 422);
  }
  return json({ ok: true, expense: validation.expense });
}
