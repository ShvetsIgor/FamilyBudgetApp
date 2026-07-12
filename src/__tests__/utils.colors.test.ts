import { describe, expect, it } from 'vitest';
import { getReadableForeground } from '@/shared/utils/colors';

describe('getReadableForeground', () => {
  it('uses dark ink on pastel category colours', () => {
    expect(getReadableForeground('#F2CC8F')).toBe('#111827');
    expect(getReadableForeground('#81B29A')).toBe('#111827');
  });

  it('keeps white on genuinely dark colours', () => {
    expect(getReadableForeground('#1E3A5F')).toBe('#FFFFFF');
  });

  it('fails safe for malformed custom colours', () => {
    expect(getReadableForeground('not-a-color')).toBe('#111827');
  });
});
