/**
 * Nested error boundaries swallow errors before the root boundary, so each
 * must report to Sentry itself — and keep the reset/retry UX working.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: (e: unknown) => captureException(e) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import AppError from '@/app/(app)/error';
import AuthError from '@/app/auth/error';

beforeEach(() => captureException.mockClear());

describe('nested error boundaries', () => {
  it('(app)/error reports to Sentry once and keeps reset working', () => {
    const error = Object.assign(new Error('boom'), { digest: 'd1' });
    const reset = vi.fn();
    render(<AppError error={error} reset={reset} />);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByText('Попробовать снова'));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('auth/error reports to Sentry once and keeps reset working', () => {
    const error = new Error('auth boom');
    const reset = vi.fn();
    render(<AuthError error={error} reset={reset} />);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByText('Повторить'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
