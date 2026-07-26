import { describe, expect, it } from 'vitest';
import { GOAL_ICON_OPTIONS, normalizeGoalIcon } from '@/features/savings/config/goalIcons';

describe('savings goal icons', () => {
  it('keeps new outline icon keys unchanged', () => {
    expect(normalizeGoalIcon('house')).toBe('house');
    expect(normalizeGoalIcon('plane')).toBe('plane');
  });

  it('maps legacy emoji goals onto the outline registry', () => {
    expect(normalizeGoalIcon('🎯')).toBe('star');
    expect(normalizeGoalIcon('🚗')).toBe('car');
    expect(normalizeGoalIcon('🏖️')).toBe('palm');
  });

  it('falls back safely for unknown stored values', () => {
    expect(normalizeGoalIcon('unknown-icon')).toBe('star');
    expect(GOAL_ICON_OPTIONS).toContain(normalizeGoalIcon(undefined));
  });
});
