/** One-time owner-privacy repair. Dry-run unless --apply is explicitly supplied.
 * Run with Node --env-file=.env.local; no financial values are logged.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { writeFile } from 'node:fs/promises';
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const expected = process.argv.find(a => a.startsWith('--project='))?.slice(10);
if (!expected || expected !== projectId) throw new Error('Pass --project matching FIREBASE_ADMIN_PROJECT_ID');
initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64 ?? '', 'base64').toString('utf8') }) });
const db = getFirestore();
const apply = process.argv.includes('--apply');
const backup = process.argv.find(a => a.startsWith('--backup='))?.slice(9);
if (apply && !backup) throw new Error('--apply requires --backup=/absolute/private/path.json');
const candidates = [];
const users = await db.collection('users').get();
for (const owner of users.docs) {
  for (const [collection, type] of [['expenses', 'expense'], ['incomes', 'income']]) {
    const cats = await db.collection(`categories/${owner.id}/${type}`).get();
    const privateIds = new Set(cats.docs.filter(c => c.data().isPrivate === true).map(c => c.id));
    const entries = await db.collection(`${collection}/${owner.id}/items`).get();
    for (const entry of entries.docs) {
      const data = entry.data();
      if (data.privacy === 'secret') continue;
      const categoryIds = [...new Set([data.categoryId, ...(data.splits ?? []).map(s => s.categoryId)])].filter(Boolean);
      const goalPath = data.goalId ? `savingsGoals/${data.goalOwnerId ?? owner.id}/goals/${data.goalId}` : null;
      const privateGoal = goalPath && (await db.doc(goalPath).get()).data()?.isPrivate === true;
      if (!privateGoal && !categoryIds.some(id => privateIds.has(id))) continue;
      candidates.push({ path: entry.ref.path, userId: owner.id, type, privacy: data.privacy ?? null });
    }
  }
}
console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', users: users.size, candidates: candidates.length }));
if (apply) {
  // Only the field being changed is backed up; never write amounts or chat text to logs.
  await writeFile(backup, JSON.stringify({ projectId, createdAt: new Date().toISOString(), candidates }, null, 2), { flag: 'wx', mode: 0o600 });
  let repaired = 0;
  for (const candidate of candidates) {
    const changed = await db.runTransaction(async tx => {
      const ref = db.doc(candidate.path);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().privacy === 'secret') return false;
      const data = snap.data();
      const ids = [...new Set([data.categoryId, ...(data.splits ?? []).map(s => s.categoryId)])].filter(Boolean);
      const cats = await Promise.all(ids.map(id => tx.get(db.doc(`categories/${candidate.userId}/${candidate.type}/${id}`))));
      const goal = data.goalId ? await tx.get(db.doc(`savingsGoals/${data.goalOwnerId ?? candidate.userId}/goals/${data.goalId}`)) : null;
      if (!cats.some(c => c.data()?.isPrivate === true) && goal?.data()?.isPrivate !== true) return false;
      tx.update(ref, { privacy: 'secret', updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (changed) repaired++;
  }
  console.log(JSON.stringify({ repaired }));
}
