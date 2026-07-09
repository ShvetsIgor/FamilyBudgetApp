import { fetchSharedExpensesInRange } from '@/features/expenses/services/expensesService';
import { formatAmount } from '@/shared/utils/currency';
import type { Currency, UserProfile } from '@/shared/types';
import type { TFunc } from '@/shared/utils/makeT';

export interface FamilyActivityNote {
  kind: 'family';
  title: string;
  text: string;
  createdAt: string;
}

const seenKey = (uid: string) => `family_activity_seen_${uid}`;
const membersKey = (uid: string) => `family_members_seen_${uid}`;

/**
 * Pull-based family activity for the bell: compares the family state with
 * per-user localStorage markers and reports what happened since the last
 * launch — new members and other members' new (non-secret) expenses.
 * First run only plants the markers so a fresh login isn't spammed.
 */
export async function checkFamilyActivity(
  selfId: string,
  members: UserProfile[],
  t: TFunc,
  currency: Currency,
): Promise<FamilyActivityNote[]> {
  const notes: FamilyActivityNote[] = [];
  const now = new Date();

  // Members who joined since the last check
  try {
    const prevRaw = localStorage.getItem(membersKey(selfId));
    if (prevRaw) {
      const prev: string[] = JSON.parse(prevRaw);
      for (const m of members) {
        if (m.id !== selfId && !prev.includes(m.id)) {
          notes.push({
            kind: 'family',
            title: t('notifications.familyTitle'),
            text: t('notifications.memberJoined', { name: m.name }),
            createdAt: now.toISOString(),
          });
        }
      }
    }
    localStorage.setItem(membersKey(selfId), JSON.stringify(members.map((m) => m.id).sort()));
  } catch { /* storage unavailable */ }

  // Other members' expenses since the last visit (by expense date)
  try {
    const lastRaw = localStorage.getItem(seenKey(selfId));
    localStorage.setItem(seenKey(selfId), now.toISOString());
    if (lastRaw) {
      const from = new Date(lastRaw);
      const others = members.filter((m) => m.id !== selfId);
      const lists = await Promise.all(
        others.map((m) => fetchSharedExpensesInRange(m.id, from, now).catch(() => [])),
      );
      const all = lists.flat();
      if (all.length > 0) {
        const sum = all.reduce((s, e) => s + e.amount, 0);
        notes.push({
          kind: 'family',
          title: t('notifications.familyTitle'),
          text: t('notifications.familyDigest', { n: all.length, sum: formatAmount(sum, currency) }),
          createdAt: now.toISOString(),
        });
      }
    }
  } catch { /* offline — markers roll forward next launch */ }

  return notes;
}
