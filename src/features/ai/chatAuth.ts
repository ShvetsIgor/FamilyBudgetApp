import 'server-only';
import { getAdminAuth } from '@/shared/lib/firebaseAdmin';

/** Chat uses the signed-in Firebase session, never a Siri token or a body uid. */
export async function resolveChatAuthorization(header: string | null): Promise<string | null> {
  const token = header?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token || token.length > 8192) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return decoded.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
      'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) return null;
    // Infrastructure failures must remain retryable, not look like a logout.
    throw error;
  }
}
