/** Restores a «download all data» JSON export into ONE account.
 *
 * Dry run (no Firebase access, prints counts only — never amounts or text):
 *   node scripts/restore-export.mjs --file=/private/export.json --uid=<targetUid>
 *
 * Apply to the emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8090 node scripts/restore-export.mjs \
 *     --file=… --uid=… --project=demo-family-budget --apply
 *
 * Apply to a real (test) project: run with `node --env-file=.env.test` holding
 * FIREBASE_ADMIN_* for that project and pass a matching --project. Production
 * is refused unless --allow-production is given as well, and every target must
 * have no entries yet: a restore never merges into live data.
 */
import { readFile } from 'node:fs/promises';
import { buildRestorePlan } from '../src/features/debug/services/restorePlan.ts';

const PRODUCTION_PROJECT = 'familybudgetapp-a0530';
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => process.argv.includes(`--${name}`);

const file = arg('file');
const uid = arg('uid');
if (!file || !uid) throw new Error('Usage: --file=<export.json> --uid=<target uid> [--project=<id> --apply]');

const exported = JSON.parse(await readFile(file, 'utf8'));
// Dry runs only need the shape, not real Timestamps
const plan = buildRestorePlan(exported, uid, (iso) => ({ $timestamp: iso }));
const counts = {};
for (const write of plan.writes) {
  // Top-level documents (users/{uid}, budgets/{uid}) are counted as themselves
  const parts = write.path.split('/');
  const collection = parts.length === 2 ? write.path : parts.slice(0, -1).join('/');
  counts[collection] = (counts[collection] ?? 0) + 1;
}
const apply = flag('apply');
console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run', schemaVersion: exported.schemaVersion,
  sameAccount: plan.sourceUid === uid, documents: plan.writes.length, counts, skipped: plan.skipped,
}, null, 2));
if (!apply) process.exit(0);

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const project = arg('project');
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!project) throw new Error('--apply requires --project=<id>');
if (project === PRODUCTION_PROJECT && !flag('allow-production')) {
  throw new Error('Refusing to restore into production without --allow-production');
}
if (emulator) {
  initializeApp({ projectId: project });
} else {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID !== project) throw new Error('--project must match FIREBASE_ADMIN_PROJECT_ID');
  initializeApp({ credential: cert({
    projectId: project, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64 ?? '', 'base64').toString('utf8'),
  }) });
}
const db = getFirestore();

// Never merge: a restore on top of existing entries would double money
for (const path of [`expenses/${uid}/items`, `incomes/${uid}/items`, `savingsGoals/${uid}/goals`]) {
  if (!(await db.collection(path).limit(1).get()).empty) throw new Error(`Target already has data in ${path}`);
}

const typed = buildRestorePlan(exported, uid, (iso) => Timestamp.fromDate(new Date(iso)));
const writer = db.bulkWriter();
for (const write of typed.writes) void writer.set(db.doc(write.path), write.data);
await writer.close();

// Read back what was written: the restore is only done when the counts match
const mismatches = [];
for (const [collection, expected] of Object.entries(counts)) {
  const isDoc = collection.split('/').length % 2 === 0;
  const actual = isDoc ? ((await db.doc(collection).get()).exists ? 1 : 0) : (await db.collection(collection).count().get()).data().count;
  if (actual !== expected) mismatches.push({ collection, expected, actual });
}
console.log(JSON.stringify({ restored: typed.writes.length, verified: mismatches.length === 0, mismatches }, null, 2));
if (mismatches.length) process.exit(1);
