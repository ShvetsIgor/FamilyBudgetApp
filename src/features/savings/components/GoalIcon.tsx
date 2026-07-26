import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { normalizeGoalIcon } from '@/features/savings/config/goalIcons';

export function GoalIcon({
  icon,
  color,
  size = 'md',
}: {
  icon?: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <CategoryIcon icon={normalizeGoalIcon(icon)} color={color} size={size} />;
}

export function GoalGlyph({
  icon,
  color,
  className,
}: {
  icon?: string;
  color: string;
  className?: string;
}) {
  return <StickerIcon icon={normalizeGoalIcon(icon)} color={color} className={className} />;
}
