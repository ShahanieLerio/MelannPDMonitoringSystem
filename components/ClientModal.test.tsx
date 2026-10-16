import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClientModal from './ClientModal';
import { Branch, LocationStatus, MovingStatus, PaymentStatus, type Loan } from '../types';
import { store } from '../services/dataStore';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn()
  }
}));

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  collector: 'Shan',
  code: '1287',
  borrowerName: 'POBLETE, LIEZL',
  firstName: 'Liezl',
  lastName: 'Poblete',
  monthReported: '2026-06',
  dueDate: '2026-06-30',
  totalLoan: 60000,
  outstandingBalance: 60000,
  amountCollected: 3000,
  runningBalance: 57000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'Ormoc',
  city: 'Merida',
  barangay: 'Lamanoc',
  fullAddress: 'Lamanoc, Merida',
  payments: [],
  remarks: [],
  history: [],
  branch: Branch.ORMOC,
  ...overrides
});

describe('ClientModal', () => {
  it('shows payment stream from latest to oldest', async () => {
    const loan = makeLoan({
      payments: [
        {
          id: 'payment-old',
          loanId: 'loan-1',
          date: '2022-06-14',
          orNumber: 'JCASH-555250',
          amount: 2000,
          balanceAfter: 59692,
          recorder: 'pearl',
          status: PaymentStatus.GOOD,
          createdAt: '2022-06-14T08:00:00.000Z'
        },
        {
          id: 'payment-latest',
          loanId: 'loan-1',
          date: '2026-06-29',
          orNumber: 'OR-20260629-RMLJ',
          amount: 1000,
          balanceAfter: 7765,
          recorder: 'Shan',
          status: PaymentStatus.GOOD,
          createdAt: '2026-06-29T09:00:00.000Z'
        },
        {
          id: 'payment-middle',
          loanId: 'loan-1',
          date: '2025-07-29',
          orNumber: 'JCASH-888717',
          amount: 100,
          balanceAfter: 4030,
          recorder: 'mia',
          status: PaymentStatus.GOOD,
          createdAt: '2025-07-29T08:00:00.000Z'
        }
      ]
    });
    vi.mocked(store.getLoans).mockReturnValue([loan]);

    render(<ClientModal loan={loan} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /payment stream/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('OR-20260629-RMLJ')).toBeInTheDocument();
    expect(within(rows[0]).getByText('LATEST')).toBeInTheDocument();
    expect(within(rows[1]).getByText('JCASH-888717')).toBeInTheDocument();
    expect(within(rows[2]).getByText('JCASH-555250')).toBeInTheDocument();
  });

  it('keeps renewed loan cycles separate and lets the user review the old paid payments', () => {
    const oldPaidLoan = makeLoan({
      id: 'old-paid-cycle',
      dateRelease: '2024-01-10',
      dueDate: '2024-03-10',
      monthReported: '2024-04',
      amountCollected: 61000,
      runningBalance: 0,
      status: MovingStatus.PAID,
      payments: [{
        id: 'old-payment', loanId: 'old-paid-cycle', date: '2024-03-09',
        orNumber: 'OR-OLD-PAID', amount: 61000, balanceAfter: -1000,
        recorder: 'Shan', status: PaymentStatus.GOOD, createdAt: '2024-03-09T08:00:00.000Z'
      }]
    });
    const activeReloan = makeLoan({
      id: 'new-past-due-cycle',
      dateRelease: '2025-04-02',
      dueDate: '2025-05-27',
      monthReported: '2025-08',
      totalLoan: 9080,
      outstandingBalance: 5030,
      amountCollected: 4050,
      runningBalance: 5030,
      status: MovingStatus.NM,
      payments: [{
        id: 'new-payment', loanId: 'new-past-due-cycle', date: '2025-05-26',
        orNumber: 'OR-NEW-RELOAN', amount: 200, balanceAfter: 5030,
        recorder: 'Shan', status: PaymentStatus.GOOD, createdAt: '2025-05-26T08:00:00.000Z'
      }]
    });
    vi.mocked(store.getLoans).mockReturnValue([oldPaidLoan, activeReloan]);

    render(<ClientModal loan={activeReloan} onClose={vi.fn()} />);

    expect(screen.getByText('Renewed (2x)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /payment stream/i }));
    expect(screen.getByText('OR-NEW-RELOAN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /profile analytics/i }));
    fireEvent.click(screen.getByRole('button', { name: /view loan cycle released 2024-01-10/i }));
    expect(screen.getByText('FULLY PAID')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /payment stream/i }));
    expect(screen.getByText('OR-OLD-PAID')).toBeInTheDocument();
    expect(screen.queryByText('OR-NEW-RELOAN')).not.toBeInTheDocument();
  });
});
