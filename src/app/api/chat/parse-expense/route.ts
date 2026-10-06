import { resolveChatAuthorization } from '@/features/ai/chatAuth';
import { parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { missingCategoryMessage } from '@/features/ai/expenseParser/categoryClarification';
import { readSiriRequest, SiriRequestError } from '@/features/ai/siriRequest';
import { consumeSiriQuota } from '@/features/ai/siriRateLimit';
import { loadSiriContext, SiriProfileError } from '@/features/ai/siriContext';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import { parseMerchantDraft } from '@/features/chat/parser/merchantDraft';

export const runtime = 'nodejs';

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Parse only. Confirmation and the existing expense + stats batch stay in chat. */
export async function POST(request: Request): Promise<Response> {
  let uid;
  try { uid = await resolveChatAuthorization(request.headers.get('authorization')); }
  catch { return json({ ok: false, error: 'auth_unavailable' }, 503); }
  if (!uid) return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });

  let input;
  try { input = await readSiriRequest(request); }
  catch (error) {
    return json({ ok: false, error: 'invalid_request' }, error instanceof SiriRequestError ? error.status : 400);
  }
  let context;
  try { context = await loadSiriContext(uid); }
  catch (error) {
    return json({ ok: false, error: error instanceof SiriProfileError ? 'profile_required' : 'context_unavailable' },
      error instanceof SiriProfileError ? 409 : 503);
  }
  const missingCategory = (name?: string | null) => missingCategoryMessage(context.language, name, 'chat');
  if (!context.categories.length) return json({ ok: false, error: 'category_required', message: missingCategory() }, 422);

  const merchantDraft = parseMerchantDraft(input.text, context.currency, input.todayKey);
  if (merchantDraft) return json({ ok: true, expense: merchantDraft });

  try {
    // One AI budget per owner across Siri and chat. Dictionary drafts use no AI.
    const quota = await consumeSiriQuota(uid);
    if (!quota.allowed) return json({ ok: false, error: 'rate_limited', retryAfter: quota.retryAfter },
      429, { 'Retry-After': String(quota.retryAfter) });
  } catch { return json({ ok: false, error: 'rate_limit_unavailable' }, 503); }

  let parsed;
  try {
    parsed = await parseExpenseText({ text: input.text, todayKey: input.todayKey,
      categories: context.categories.map(({ id, name }) => ({ id, name })),
      defaultCurrency: context.currency, language: context.language });
  } catch { return json({ ok: false, error: 'parser_unavailable' }, 503); }
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
