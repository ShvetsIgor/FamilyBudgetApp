/**
 * The receipt card in the chat: nothing is saved until every amount has a
 * category the user confirmed, Save is one expense with splits under the photo
 * message's operation id, and a malformed persisted card renders nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';

vi.mock('@/shared/lib/firebase', () => ({ getFirebaseAuth: () => ({ currentUser: null }), getDb: () => ({}) }));

import { store } from '@/store/store';
import { setLanguage } from '@/features/ui/store/uiSlice';
import { ReceiptCard } from '@/features/chat/components/BotCard/ReceiptCard';
import { readReceiptCard, saveReceipt, type ReceiptCardData } from '@/features/chat/services/receiptChat';
import { receiptTargetSize } from '@/features/chat/services/receiptImage';
import type { Category } from '@/shared/types';

const cats: Category[] = [
  { id: 'groceries', userId: 'u', name: 'Groceries', icon: 'cart', color: '#111', type: 'expense', isPrivate: false, order: 0 },
  { id: 'household', userId: 'u', name: 'Household', icon: 'box', color: '#222', type: 'expense', isPrivate: false, order: 1 },
];
const data: ReceiptCardData = {
  userMsgId: 'photo-msg', merchant: 'Shufersal', date: '2026-10-09', currency: 'ILS', total: 76.1,
  groups: [
    { categoryId: 'groceries', amount: 29.2, names: ['Milk', 'Bread', 'Bananas'] },
    { categoryId: 'household', amount: 14.9, names: ['Dish soap'] },
    { categoryId: null, amount: 32, names: ['Coffee'] },
  ],
};

afterEach(() => { store.dispatch(setLanguage('en')); });

describe('ReceiptCard', () => {
  const renderCard = (onSave = vi.fn().mockResolvedValue(undefined), card = data) => {
    render(<Provider store={store}><ReceiptCard data={card} categories={cats} folders={[]} onSave={onSave} onCancel={vi.fn()} /></Provider>);
    return onSave;
  };

  it('shows the total and every group, and cannot save while an amount has no category', () => {
    renderCard();
    expect(screen.getByText('Shufersal')).toBeTruthy();
    expect(screen.getByText('Milk, Bread, Bananas')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Choose a category for every amount, then you can save.')).toBeTruthy();
  });

  it('saves the groups with the categories the user chose', async () => {
    const onSave = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a category' }));
    // The real picker: categories without a folder sit under «Without folder»
    fireEvent.click(screen.getByRole('button', { name: 'Without folder' }));
    fireEvent.click(screen.getAllByText('Groceries').at(-1)!.closest('button')!);
    const save = screen.getByRole('button', { name: /Save/ });
    expect(save.hasAttribute('disabled')).toBe(false);
    await act(async () => { fireEvent.click(save); });
    expect(onSave).toHaveBeenCalledWith([
      { categoryId: 'groceries', amount: 29.2, names: ['Milk', 'Bread', 'Bananas'] },
      { categoryId: 'household', amount: 14.9, names: ['Dish soap'] },
      { categoryId: 'groceries', amount: 32, names: ['Coffee'] },
    ]);
  });

  it('treats a category archived since the photo as not chosen', () => {
    renderCard(undefined, { ...data, groups: [{ categoryId: 'gone', amount: 76.1, names: [] }] });
    expect(screen.getByRole('button', { name: /Save/ }).hasAttribute('disabled')).toBe(true);
    expect(within(screen.getByRole('list')).getByText(/choose a category/i)).toBeTruthy();
  });
});

describe('saveReceipt', () => {
  const base = { userId: 'u', card: data, categories: cats, language: 'en' as const };
  const groups = data.groups.map((g) => ({ ...g, categoryId: g.categoryId ?? 'groceries' }));

  it('writes ONE expense with splits under the photo message operation id, at local noon', async () => {
    const addExpense = vi.fn().mockResolvedValue({ id: 'e1', categoryId: 'groceries', splits: [{ categoryId: 'household', amount: 14.9 }] });
    const result = await saveReceipt({ ...base, groups, addExpense });
    expect(addExpense).toHaveBeenCalledTimes(1);
    const input = addExpense.mock.calls[0][0];
    expect(input).toMatchObject({
      operationId: 'chat-photo-msg', amount: 76.1, currency: 'ILS', categoryId: 'groceries',
      splits: [{ categoryId: 'household', amount: 14.9 }], store: 'Shufersal', privacy: 'regular',
    });
    expect([input.date.getFullYear(), input.date.getMonth(), input.date.getDate(), input.date.getHours()]).toEqual([2026, 9, 9, 12]);
    expect(result).toMatchObject({ status: 'saved', card: { expenseId: 'e1', card: { kind: 'saved', data: { userMsgId: 'photo-msg', hint: 'Receipt · 2 categories' } } } });
  });

  it('reports an unacknowledged write as unconfirmed, and a deleted one as deleted', async () => {
    await expect(saveReceipt({ ...base, groups, addExpense: vi.fn().mockRejectedValue(new Error('unavailable')) }))
      .resolves.toEqual({ status: 'unconfirmed' });
    await expect(saveReceipt({ ...base, groups, addExpense: vi.fn().mockRejectedValue(new Error('entry-already-deleted')) }))
      .resolves.toEqual({ status: 'deleted' });
  });

  it('refuses to save while an amount has no category', async () => {
    const addExpense = vi.fn();
    await expect(saveReceipt({ ...base, groups: data.groups, addExpense })).rejects.toThrow(/category/);
    expect(addExpense).not.toHaveBeenCalled();
  });
});

describe('persisted card and photo size', () => {
  it('renders only well-formed cards', () => {
    expect(readReceiptCard(data)).toEqual(data);
    expect(readReceiptCard({ ...data, total: -1 })).toBeNull();
    expect(readReceiptCard({ ...data, currency: 'EUR' })).toBeNull();
    expect(readReceiptCard({ ...data, userMsgId: undefined })).toBeNull();
  });

  it('scales the long side to 1600 px and never enlarges', () => {
    expect(receiptTargetSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(receiptTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
