import 'server-only';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

const WINDOWS = {
  minute: { duration: 60_000, limit: 10 },
  day: { duration: 86_400_000, limit: 100 },
} as const;
type Window = { count: number; resetAt: number };

/** Shared by all owner tokens, across server instances; attempts are not refunded. */
export async function consumeSiriQuota(uid: string, now = Date.now()): Promise<
  { allowed: true } | { allowed: false; retryAfter: number }
> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/shortcutUsage/rateLimit`);
  return db.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    const next = {} as Record<keyof typeof WINDOWS, Window>;
    let retryAfter = 0;
    for (const key of ['minute', 'day'] as const) {
      const policy = WINDOWS[key];
      const previous = data?.[key] as Window | undefined;
      if (data && (!previous || !Number.isSafeInteger(previous.count) || previous.count < 0
        || !Number.isSafeInteger(previous.resetAt))) throw new Error('Invalid Siri quota state');
      const current = previous && previous.resetAt > now
        ? previous : { count: 0, resetAt: now + policy.duration };
      if (current.count >= policy.limit) retryAfter = Math.max(retryAfter, Math.ceil((current.resetAt - now) / 1000));
      next[key] = { ...current, count: current.count + 1 };
    }
    if (retryAfter > 0) return { allowed: false, retryAfter };
    transaction.set(ref, next);
    return { allowed: true };
  });
}
