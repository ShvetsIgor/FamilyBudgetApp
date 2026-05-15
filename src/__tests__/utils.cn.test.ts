import { describe, it, expect } from 'vitest';
import { cn } from '@/shared/utils/cn';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});
