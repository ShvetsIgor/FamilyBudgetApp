import { getAdminAuth } from '@/shared/lib/firebaseAdmin';
import { AccountDeletionBlockedError, deleteAccount } from '@/features/account/accountDeletion';
import { reportServerFailure } from '@/shared/lib/serverMonitoring';

export const runtime = 'nodejs';

/** Deleting is only accepted right after the user proved who they are again. */
const RECENT_SIGN_IN_MS = 5 * 60_000;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

const UNAUTHORIZED = new Set(['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
  'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found']);

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token || token.length > 8192) return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });

  let uid: string;
  let authTime: number;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    uid = decoded.uid;
    authTime = decoded.auth_time * 1000;
  } catch (error) {
    if (UNAUTHORIZED.has((error as { code?: string }).code ?? '')) {
      return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
    }
    reportServerFailure({ route: 'account_delete', stage: 'auth', error });
    return json({ ok: false, error: 'auth_unavailable' }, 503);
  }
  // A stolen or forgotten-open session must not be enough to erase everything
  if (!(Date.now() - authTime <= RECENT_SIGN_IN_MS)) return json({ ok: false, error: 'reauth_required' }, 403);

  try {
    await deleteAccount(uid);
  } catch (error) {
    if (error instanceof AccountDeletionBlockedError) return json({ ok: false, error: error.reason }, 409);
    reportServerFailure({ route: 'account_delete', stage: 'save', error });
    // Every step is idempotent: the client may simply try again
    return json({ ok: false, error: 'delete_unavailable' }, 503);
  }
  return json({ ok: true });
}
