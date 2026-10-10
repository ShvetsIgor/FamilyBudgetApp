import 'server-only';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

type WindowPolicy = { duration: number; limit: number };
type Window = { count: number; resetAt: number };
export interface QuotaMeter {
  path: string;
  windows: Readonly<Record<string, WindowPolicy>>;
  /** Honour a stored `blockedUntil` (ms epoch): deny until then without counting. */
  cooldown?: boolean;
}
export type QuotaDecision = { allowed: true } | { allowed: false; retryAfter: number };

export const AI_LIMIT_PER_MINUTE = 10;
export const AI_LIMIT_PER_DAY = 100;
export const CHAT_REQUEST_LIMIT_PER_MINUTE = 30;
export const CHAT_REQUEST_LIMIT_PER_DAY = 300;
// Groq's free-tier REQUEST limits for openai/gpt-oss-20b. The same tier also
// caps ~8K tokens/minute and ~200K tokens/day, and one parse costs ~1K+ tokens,
// so Groq's token caps usually bind first and a Groq 429 is expected before
// these windows fill. That case is handled by the cooldown Groq's Retry-After
// stores on the global document (recordAiCooldown), not by these numbers.
const AI_GLOBAL_DEFAULT_PER_MINUTE = 30;
const AI_GLOBAL_DEFAULT_PER_DAY = 1000;
const AI_GLOBAL_PATH = 'aiUsage/global';

const perMinuteAndDay = (minute: number, day: number) => ({
  minute: { duration: 60_000, limit: minute },
  day: { duration: 86_400_000, limit: day },
});

const ownerAiMeter = (uid: string): QuotaMeter => ({
  path: `users/${uid}/shortcutUsage/rateLimit`, windows: perMinuteAndDay(AI_LIMIT_PER_MINUTE, AI_LIMIT_PER_DAY),
});

function positiveInteger(raw: string | undefined, fallback: number) {
  if (!raw || !/^\s*\d+\s*$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function aiGlobalLimits(env: Record<string, string | undefined> = process.env) {
  return {
    perMinute: positiveInteger(env.AI_GLOBAL_LIMIT_PER_MINUTE, AI_GLOBAL_DEFAULT_PER_MINUTE),
    perDay: positiveInteger(env.AI_GLOBAL_LIMIT_PER_DAY, AI_GLOBAL_DEFAULT_PER_DAY),
  };
}

/**
 * Windows start with their first accepted attempt and reset independently;
 * accepted attempts are never refunded. Every meter is read and checked before
 * anything is written, so a denial by one leaves all of them untouched. When
 * several meters deny, `deniedBy` is the one with the longest wait — what the
 * caller actually has to sit out — and the earlier meter wins a tie.
 * Corrupt window state throws: callers fail closed. A malformed cooldown is
 * ignored instead: it can only ever block, never grant.
 */
export async function consumeWindowedQuota(meters: readonly QuotaMeter[], now = Date.now()): Promise<
  { allowed: true } | { allowed: false; retryAfter: number; deniedBy: number }
> {
  const db = getAdminDb();
  return db.runTransaction(async (transaction) => {
    const writes: [ReturnType<typeof db.doc>, Record<string, Window>][] = [];
    let deniedBy = -1;
    let retryAfter = 0;
    for (const [index, meter] of meters.entries()) {
      const ref = db.doc(meter.path);
      const data = (await transaction.get(ref)).data();
      const next: Record<string, Window> = {};
      let wait = 0;
      for (const [key, policy] of Object.entries(meter.windows)) {
        const previous = data?.[key] as Window | undefined;
        // A cooldown can be stored before any window exists (merge write).
        const invalid = previous == null
          ? !!data && !meter.cooldown
          : !Number.isSafeInteger(previous.count) || previous.count < 0 || !Number.isSafeInteger(previous.resetAt);
        if (invalid) throw new Error('Invalid quota state');
        const current = previous && previous.resetAt > now
          ? previous : { count: 0, resetAt: now + policy.duration };
        if (current.count >= policy.limit) wait = Math.max(wait, Math.ceil((current.resetAt - now) / 1000));
        next[key] = { ...current, count: current.count + 1 };
      }
      const blockedUntil = meter.cooldown ? data?.blockedUntil : undefined;
      // Only a live cooldown denies, so an allowed set() may drop an expired one.
      if (typeof blockedUntil === 'number' && Number.isFinite(blockedUntil) && blockedUntil > now) {
        wait = Math.max(wait, Math.ceil((blockedUntil - now) / 1000));
      }
      if (wait > retryAfter) { deniedBy = index; retryAfter = wait; }
      writes.push([ref, next]);
    }
    if (deniedBy >= 0) return { allowed: false, retryAfter, deniedBy };
    for (const [ref, next] of writes) transaction.set(ref, next);
    return { allowed: true };
  });
}

/** The owner's AI budget alone, shared by Siri tokens and authenticated chat. */
export async function consumeSiriQuota(uid: string, now = Date.now()): Promise<QuotaDecision> {
  const result = await consumeWindowedQuota([ownerAiMeter(uid)], now);
  return result.allowed ? result : { allowed: false, retryAfter: result.retryAfter };
}

/**
 * Owner budget plus a global ceiling across all accounts, in one transaction.
 * One global document is fine at the default ceiling (≤1 write/s, Firestore's
 * sustained per-document limit); shard it before raising the limit far past that.
 */
export async function consumeAiQuota(uid: string, now = Date.now()): Promise<
  { allowed: true } | { allowed: false; reason: 'owner' | 'global'; retryAfter: number }
> {
  const { perMinute, perDay } = aiGlobalLimits();
  const result = await consumeWindowedQuota([ownerAiMeter(uid),
    { path: AI_GLOBAL_PATH, windows: perMinuteAndDay(perMinute, perDay), cooldown: true }], now);
  return result.allowed ? result
    : { allowed: false, reason: result.deniedBy === 0 ? 'owner' : 'global', retryAfter: result.retryAfter };
}

/**
 * After a Groq 429, stop calling Groq for its Retry-After: consumeAiQuota then
 * denies every owner with reason 'global' and counts nothing. Best-effort — the
 * caller has already answered "busy", so a failed write is swallowed.
 */
export async function recordAiCooldown(retryAfter: number, now = Date.now()): Promise<void> {
  try {
    if (!Number.isFinite(retryAfter) || retryAfter <= 0) return;
    await getAdminDb().doc(AI_GLOBAL_PATH).set({ blockedUntil: now + retryAfter * 1000 }, { merge: true });
  } catch { /* the next Groq 429 tries again */ }
}

/** Every authenticated chat parse, dictionary or AI, before any context read. */
export async function consumeChatRequestQuota(uid: string, now = Date.now()): Promise<QuotaDecision> {
  const result = await consumeWindowedQuota([{
    path: `users/${uid}/shortcutUsage/chatRequests`,
    windows: perMinuteAndDay(CHAT_REQUEST_LIMIT_PER_MINUTE, CHAT_REQUEST_LIMIT_PER_DAY),
  }], now);
  return result.allowed ? result : { allowed: false, retryAfter: result.retryAfter };
}
