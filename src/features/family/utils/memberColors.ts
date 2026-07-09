import type { UserProfile } from '@/shared/types';

export const MEMBER_PALETTE = ['#E8442A', '#8AA9D6', '#81B29A', '#E9B384', '#C97B84', '#A8B89C'];

/** memberId → accent color: the member's chosen color, else a stable palette pick. */
export function buildMemberColorMap(members: UserProfile[]): Record<string, string> {
  const map: Record<string, string> = {};
  members.forEach((m, i) => {
    map[m.id] = m.color ?? MEMBER_PALETTE[i % MEMBER_PALETTE.length];
  });
  return map;
}
