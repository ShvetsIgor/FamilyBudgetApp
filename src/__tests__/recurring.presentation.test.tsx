/**
 * What the recurring screens actually put in front of the user.
 *
 * The list row is the regression guard for the truncation fix: its subtitle
 * carries the status alone, while the term progress sits under the amount.
 * The detail view is checked against the REAL translator, so a missing i18n
 * key shows up here as a failing assertion instead of a raw key on screen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { RecurringListRow } from '@/features/recurring/components/RecurringListRow';
import { RecurringDetailView } from '@/features/recurring/components/RecurringDetailView';
import { occurrenceDate } from '@/features/recurring/utils/schedule';
import type { Category, SerializableExpense, SerializableRecurringPayment } from '@/shared/types';

const shopping: Category = {
  id: 'cat-shop', userId: 'u', name: 'Shopping', icon: 'box', color: '#12907A',
  type: 'expense', order: 0, isPrivate: false,
};

const start = new Date('2026-01-15T12:00:00');
/** 12 monthly payments of 5600; the pending one is #3 */
const installment: SerializableRecurringPayment = {
  id: 'r1', userId: 'u', name: 'Socks', amount: 5600, currency: 'ILS', categoryId: 'cat-shop',
  frequency: 'monthly', type: 'installment',
  startDate: start.toISOString(),
  endDate: occurrenceDate(start, 'monthly', 12).toISOString(),
  nextDueDate: occurrenceDate(start, 'monthly', 3).toISOString(),
  isActive: true, reminderDays: 3,
};

const subscription: SerializableRecurringPayment = {
  id: 'r2', userId: 'u', name: 'Youtube', amount: 24, currency: 'ILS', categoryId: 'cat-shop',
  frequency: 'monthly', type: 'subscription',
  startDate: start.toISOString(),
  nextDueDate: new Date('2099-01-15T12:00:00').toISOString(),
  isActive: true, reminderDays: 3,
};

const rowProps = {
  category: shopping,
  actionsOpen: false,
  payEditValue: null,
  onOpen: vi.fn(), onToggleActions: vi.fn(), onEdit: vi.fn(), onMarkPaid: vi.fn(),
  onStartPayEdit: vi.fn(), onChangePayEdit: vi.fn(), onCancelPayEdit: vi.fn(),
  onSkip: vi.fn(), onToggleActive: vi.fn(), onDelete: vi.fn(),
};

const detailProps = {
  category: shopping,
  history: null as SerializableExpense[] | null,
  payEditValue: null,
  onBack: vi.fn(), onEdit: vi.fn(), onMarkPaid: vi.fn(), onStartPayEdit: vi.fn(),
  onChangePayEdit: vi.fn(), onCancelPayEdit: vi.fn(), onSkip: vi.fn(),
  onToggleActive: vi.fn(), onFinish: vi.fn(), onDelete: vi.fn(), onOpenExpense: vi.fn(),
};

const withStore = (ui: React.ReactElement) => render(<Provider store={store}>{ui}</Provider>);

describe('RecurringListRow', () => {
  it('keeps the term progress out of the subtitle and under the amount', () => {
    withStore(<RecurringListRow item={installment} {...rowProps} />);

    // «payment 3 of 12» used to sit on the subtitle line and got cut off
    expect(screen.getByText('3/12')).toBeInTheDocument();
    expect(screen.queryByText(/payment 3 of 12/i)).toBeNull();
    // The kind moved to the detail screen — the icon and the edge carry it here
    expect(screen.queryByText('Installment')).toBeNull();
  });

  it('hides the frequency for monthly payments and prints it otherwise', () => {
    const { unmount } = withStore(<RecurringListRow item={subscription} {...rowProps} />);
    expect(screen.queryByText('Monthly')).toBeNull();
    unmount();

    withStore(<RecurringListRow item={{ ...subscription, frequency: 'weekly' }} {...rowProps} />);
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('says a paused template is paused instead of showing a due date', () => {
    withStore(<RecurringListRow item={{ ...installment, isActive: false }} {...rowProps} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});

describe('RecurringDetailView', () => {
  it('answers «how much is left» for a fixed term', () => {
    withStore(<RecurringDetailView item={installment} {...detailProps} />);

    expect(screen.getByText('Payment term')).toBeInTheDocument();
    expect(screen.getByText('Paid 2 of 12')).toBeInTheDocument();
    expect(screen.getByText('Payments left')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    // formatAmount puts a non-breaking space between symbol and number
    expect(screen.getByText(/56,000/)).toBeInTheDocument();  // left to pay
    expect(screen.getByText(/11,200/)).toBeInTheDocument();  // paid so far
    expect(screen.getByText('payment 3 of 12')).toBeInTheDocument();
  });

  it('names the kind and the category', () => {
    withStore(<RecurringDetailView item={installment} {...detailProps} />);
    expect(screen.getByText('Installment · Monthly')).toBeInTheDocument();
    expect(screen.getByText('Shopping')).toBeInTheDocument();
  });

  it('uses the user’s own wording for a custom kind', () => {
    withStore(
      <RecurringDetailView
        item={{ ...subscription, type: 'custom', typeLabel: 'Cleaner' }}
        {...detailProps}
      />,
    );
    expect(screen.getByText('Cleaner · Monthly')).toBeInTheDocument();
  });

  it('shows no term block for an open-ended subscription', () => {
    withStore(<RecurringDetailView item={subscription} {...detailProps} />);
    expect(screen.queryByText('Payment term')).toBeNull();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('lists booked payments with their total', () => {
    const paid = (id: string, date: string): SerializableExpense => ({
      id, userId: 'u', amount: 5600, currency: 'ILS', categoryId: 'cat-shop',
      date: new Date(date).toISOString(), paymentMethod: 'card', tags: ['recurring'],
      privacy: 'regular', splits: [], isRecurring: true, recurringId: 'r1',
      createdAt: date, updatedAt: date,
    });
    withStore(
      <RecurringDetailView
        item={installment}
        {...detailProps}
        history={[paid('e2', '2026-02-15T12:00:00'), paid('e1', '2026-01-15T12:00:00')]}
      />,
    );

    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('15 February 2026')).toBeInTheDocument();
    // also the «Started» row in Details, hence getAllByText
    expect(screen.getAllByText('15 January 2026').length).toBeGreaterThan(1);
  });

  it('tells an empty history apart from a loading one', () => {
    const { unmount } = withStore(<RecurringDetailView item={subscription} {...detailProps} history={[]} />);
    expect(screen.getByText('No payments booked yet')).toBeInTheDocument();
    unmount();

    withStore(<RecurringDetailView item={subscription} {...detailProps} history={null} />);
    expect(screen.queryByText('No payments booked yet')).toBeNull();
  });
});
