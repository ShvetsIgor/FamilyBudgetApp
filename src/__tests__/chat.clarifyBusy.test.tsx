/**
 * While the chat is busy (the next card of a list is still being written) a
 * tap would be dropped by the one-operation guard; the card must say so.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { ClarifyCard } from '@/features/chat/components/BotCard/ClarifyCard';

const chip = { id: 'coffee', name: 'Coffee', icon: 'coffee', color: '#111' };

describe('ClarifyCard busy state', () => {
  const renderCard = (busy: boolean) => {
    const onSelectChip = vi.fn();
    render(<Provider store={store}>
      <ClarifyCard amount={18} currency="₪" chips={[chip]} busy={busy}
        onSelectChip={onSelectChip} onAllCategories={vi.fn()} onSplit={vi.fn()} onDefer={vi.fn()} />
    </Provider>);
    return onSelectChip;
  };

  it('disables every action and ignores taps while busy', () => {
    const onSelectChip = renderCard(true);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) expect((button as HTMLButtonElement).matches(':disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }));
    expect(onSelectChip).not.toHaveBeenCalled();
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('true');
  });

  it('works normally otherwise', () => {
    const onSelectChip = renderCard(false);
    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }));
    expect(onSelectChip).toHaveBeenCalledWith(chip);
  });
});
