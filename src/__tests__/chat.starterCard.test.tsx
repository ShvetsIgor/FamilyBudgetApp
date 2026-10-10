/**
 * The in-chat first-expense setup card, checked against the REAL translator
 * (a missing key would surface as a raw key), plus the helpers that let the
 * page finish the ORIGINAL message from the persisted card.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { setLanguage } from '@/features/ui/store/uiSlice';
import { StarterCategoriesCard } from '@/features/chat/components/BotCard/StarterCategoriesCard';
import { readStarterCard, starterContinuationMessage } from '@/features/chat/components/BotCard/starterCardData';
import { STARTER_CATEGORY_IDS } from '@/features/categories/services/starterCategories';
import type { SerializableChatMessage } from '@/shared/types/message';

const handlers = () => ({
  onActivate: vi.fn().mockResolvedValue(undefined),
  onContinue: vi.fn().mockResolvedValue(undefined),
  onCustom: vi.fn(),
});

const withStore = (ui: React.ReactElement) => render(<Provider store={store}>{ui}</Provider>);

afterEach(() => { store.dispatch(setLanguage('en')); });

describe('StarterCategoriesCard', () => {
  it('quotes the pending text and preselects every starter category', () => {
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories={false} {...handlers()} />);
    expect(screen.getByText('«coffee 20»')).toBeInTheDocument();
    const chips = screen.getAllByRole('button', { pressed: true });
    expect(chips).toHaveLength(STARTER_CATEGORY_IDS.length);
    expect(screen.getByRole('button', { name: /Groceries/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Add and record' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Create my own category/ })).toBeInTheDocument();
  });

  it('submits only the chips left selected', async () => {
    const h = handlers();
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories={false} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Fuel/ }));
    expect(screen.getByRole('button', { name: /Fuel/ })).toHaveAttribute('aria-pressed', 'false');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add and record' })); });
    expect(h.onActivate).toHaveBeenCalledTimes(1);
    expect(h.onActivate.mock.calls[0][0]).toEqual(STARTER_CATEGORY_IDS.filter((id) => id !== 'fuel'));
  });

  it('disables the primary action when nothing is selected', () => {
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories={false} {...handlers()} />);
    for (const chip of screen.getAllByRole('button', { pressed: true })) fireEvent.click(chip);
    expect(screen.getByRole('button', { name: 'Add and record' })).toBeDisabled();
  });

  it('shows a spinner and ignores a second tap while saving', async () => {
    const h = handlers();
    let release!: () => void;
    h.onActivate.mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories={false} {...h} />);
    const button = screen.getByRole('button', { name: 'Add and record' });
    fireEvent.click(button);
    expect(screen.getByTestId('starter-spinner')).toBeInTheDocument();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(h.onActivate).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
    expect(screen.queryByTestId('starter-spinner')).not.toBeInTheDocument();
  });

  it('opens custom creation through the page', () => {
    const h = handlers();
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories={false} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Create my own category/ }));
    expect(h.onCustom).toHaveBeenCalledTimes(1);
  });

  it('only offers to finish the message once categories exist', async () => {
    const h = handlers();
    withStore(<StarterCategoriesCard pendingText="coffee 20" hasCategories {...h} />);
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record' })); });
    expect(h.onContinue).toHaveBeenCalledTimes(1);
    expect(h.onActivate).not.toHaveBeenCalled();
  });

  it('renders a resolved card inert', () => {
    withStore(<StarterCategoriesCard pendingText="coffee 20" resolvedCount={3} hasCategories={false} {...handlers()} />);
    expect(screen.getByText('Categories added: 3')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('speaks Russian with preset names in Russian', () => {
    store.dispatch(setLanguage('ru'));
    withStore(<StarterCategoriesCard pendingText="кофе 20" hasCategories={false} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Добавить и записать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Продукты/ })).toBeInTheDocument();
  });
});

describe('starter card data', () => {
  it('reads persisted cards and rejects malformed ones', () => {
    expect(readStarterCard({ pendingText: 'кофе 20', userMsgId: 'm1' })).toEqual({ pendingText: 'кофе 20', userMsgId: 'm1' });
    expect(readStarterCard({ pendingText: 'кофе 20', userMsgId: 'm1', fromServer: true, resolved: { count: 2 } }))
      .toEqual({ pendingText: 'кофе 20', userMsgId: 'm1', fromServer: true, resolved: { count: 2 } });
    expect(readStarterCard({ pendingText: '', userMsgId: 'm1' })).toBeNull();
    expect(readStarterCard({ pendingText: 'x' })).toBeNull();
    expect(readStarterCard(null)).toBeNull();
  });

  it('keeps a well-formed writtenOn day and drops a malformed one (old cards have none)', () => {
    expect(readStarterCard({ pendingText: 'кофе 20', userMsgId: 'm1', writtenOn: '2026-10-08' }))
      .toEqual({ pendingText: 'кофе 20', userMsgId: 'm1', writtenOn: '2026-10-08' });
    expect(readStarterCard({ pendingText: 'кофе 20', userMsgId: 'm1', writtenOn: 'yesterday' }))
      .toEqual({ pendingText: 'кофе 20', userMsgId: 'm1' });
    expect(readStarterCard({ pendingText: 'кофе 20', userMsgId: 'm1', writtenOn: 20261008 }))
      .toEqual({ pendingText: 'кофе 20', userMsgId: 'm1' });
  });

  it('continues the original bubble with the text from the card, never a new one', () => {
    const original: SerializableChatMessage = {
      id: 'm1', userId: 'u1', senderId: 'u1', kind: 'user', text: 'stale', status: 'clarifying',
      createdAt: '2026-10-10T08:00:00.000Z',
    };
    const card = { pendingText: 'кофе 20', userMsgId: 'm1' };
    expect(starterContinuationMessage(card, [original], 'u1')).toEqual({ ...original, text: 'кофе 20' });
    // Scrolled out of the loaded window (or reloaded): same id, text from the card
    expect(starterContinuationMessage(card, [], 'u1')).toMatchObject({ id: 'm1', kind: 'user', userId: 'u1', text: 'кофе 20' });
  });
});
