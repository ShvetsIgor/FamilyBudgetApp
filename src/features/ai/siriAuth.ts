import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

/** Resolve the owner from the stored document path, never from request input. */
export async function resolveShortcutToken(rawToken: string): Promise<string | null> {
  if (rawToken.length !== 64 || !/^[0-9a-f]{64}$/.test(rawToken)) return null;

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const snapshot = await getAdminDb().collectionGroup('shortcutTokens')
    .where('tokenHash', '==', tokenHash).limit(2).get();
  // Fail closed if duplicate hashes make ownership ambiguous.
  if (snapshot.docs.length !== 1) return null;

  const token = snapshot.docs[0];
  const parts = token.ref.path.split('/');
  if (parts.length !== 4 || parts[0] !== 'users' || parts[2] !== 'shortcutTokens' || !parts[1]) return null;

  // Advisory metadata only: never delay authentication or recreate a revoked
  // document. A serverless invocation may end before this update completes.
  void token.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
  return parts[1];
}

/** Header scheme is case-insensitive; the opaque token itself is not. */
export async function resolveShortcutAuthorization(authorization: string | null): Promise<string | null> {
  if (!authorization) return null;
  const match = /^Bearer +([0-9a-f]{64})$/i.exec(authorization.trim());
  return match ? resolveShortcutToken(match[1]) : null;
}
