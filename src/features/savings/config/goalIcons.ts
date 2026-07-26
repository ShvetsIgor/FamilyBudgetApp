import type { IconKey } from '@/features/categories/icons/icons';

/** Outline icons offered for new savings goals. */
export const GOAL_ICON_OPTIONS: IconKey[] = [
  'star', 'house', 'car', 'plane', 'laptop', 'phone',
  'gift', 'cap', 'palm', 'coin', 'couch', 'controller',
  'dumbbell', 'paw', 'brush', 'compass', 'pill', 'suitcase',
];

/** Legacy emoji values remain readable after moving goals onto outline icons. */
const LEGACY_GOAL_ICONS: Record<string, IconKey> = {
  '🎯': 'star',
  '🏠': 'house',
  '🚗': 'car',
  '✈️': 'plane',
  '💻': 'laptop',
  '📱': 'phone',
  '👶': 'teddy',
  '💍': 'gift',
  '🎓': 'cap',
  '🏖️': 'palm',
  '💰': 'coin',
  '🛋️': 'couch',
  '🎮': 'controller',
  '🏋️': 'dumbbell',
  '🐶': 'paw',
  '🎨': 'brush',
  '🏕️': 'compass',
  '💊': 'pill',
};

export function normalizeGoalIcon(icon: string | undefined): IconKey {
  if (!icon) return 'star';
  if (GOAL_ICON_OPTIONS.includes(icon as IconKey)) return icon as IconKey;
  return LEGACY_GOAL_ICONS[icon] ?? 'star';
}
