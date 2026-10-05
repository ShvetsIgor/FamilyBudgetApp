import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ fetchShortcutTokens: vi.fn(), createShortcutToken: vi.fn(), revokeShortcutToken: vi.fn() }));
vi.mock('@/features/shortcuts/services/shortcutTokenService', () => api);
vi.mock('@/shared/hooks/useT', () => ({ useT: () => (key: string) => key }));
import { ShortcutTokens } from '@/features/shortcuts/components/ShortcutTokens';
const secret = 'a'.repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  api.fetchShortcutTokens.mockResolvedValue([]);
  api.createShortcutToken.mockResolvedValue({ token: { id: 'one', label: 'Phone' }, secret });
});
afterEach(cleanup);
async function open() {
  fireEvent.click(screen.getByText('shortcuts.title'));
  await waitFor(() => expect(screen.getByLabelText('shortcuts.label')).toBeEnabled());
}
async function create() {
  fireEvent.change(screen.getByLabelText('shortcuts.label'), { target: { value: 'Phone' } });
  fireEvent.click(screen.getByText('shortcuts.create'));
  await screen.findByDisplayValue(secret);
}
it('shows the secret once and never reloads it when reopened', async () => {
  render(<ShortcutTokens uid="alice" />);
  await open(); await create();
  fireEvent.click(screen.getByLabelText('common.close'));
  api.fetchShortcutTokens.mockResolvedValue([{ id: 'one', label: 'Phone' }]);
  await open();
  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
  expect(screen.getByText('Phone')).toBeInTheDocument();
});
it('clears the secret and old list when the account changes', async () => {
  const view = render(<ShortcutTokens uid="alice" />);
  await open(); await create();
  view.rerender(<ShortcutTokens uid="bob" />);
  await waitFor(() => expect(api.fetchShortcutTokens).toHaveBeenCalledWith('bob'));
  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
  expect(screen.queryByText('Phone')).not.toBeInTheDocument();
});
it('keeps a token visible when revocation fails and removes it after a successful retry', async () => {
  api.fetchShortcutTokens.mockResolvedValue([{ id: 'one', label: 'Phone' }]);
  render(<ShortcutTokens uid="alice" />); await open();
  fireEvent.click(screen.getByText('shortcuts.revoke'));
  api.revokeShortcutToken.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByText('shortcuts.revoke'));
  await screen.findByText('shortcuts.revokeFailed');
  expect(screen.getByText('Phone')).toBeInTheDocument();
  fireEvent.click(screen.getByText('shortcuts.revoke'));
  await waitFor(() => expect(screen.queryByText('Phone')).not.toBeInTheDocument());
  expect(api.revokeShortcutToken).toHaveBeenCalledWith('alice', 'one');
});
