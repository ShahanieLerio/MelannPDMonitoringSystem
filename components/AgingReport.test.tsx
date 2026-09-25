import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import AgingReport from './AgingReport';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, PaymentStatus } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    subscribe: vi.fn()
  }
}));

vi.mock('recharts', () => {
  const Shell = ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>;
  const Part = () => null;
  return {
    ResponsiveContainer: Shell,
    BarChart: Shell,
    Bar: Shell,
    XAxis: Part,
    YAxis: Part,
    CartesianGrid: Part,
    Tooltip: Part,
    Cell: Part
  };
});

const makeLoan = (overrides: Record<string, any> = {}) => ({
  id: 'loan-active',
  collector: 'PD PALOMPON',
  code: 'C-001',
  borrowerName: 'ACTIVE, CLIENT',
  firstName: 'Client',
  lastName: 'Active',
  monthReported: '2024-01',
  dueDate: '2024-01-01',
  totalLoan: 10000,
  outstandingBalance: 10000,
  amountCollected: 6000,
  runningBalance: 4000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'PALOMPON',
  city: 'Ormoc',
  barangay: 'Donghol',
  fullAddress: 'Donghol, Ormoc City',
  payments: [{
    id: 'payment-1',
    loanId: 'loan-active',
    amount: 6000,
    orNumber: 'OR-001',
    date: '2024-02-01',
    balanceAfter: 4000,
    recorder: 'Admin',
    remarks: '',
    status: PaymentStatus.GOOD,
    createdAt: '2024-02-01T00:00:00.000Z'
  }],
  remarks: [],
  history: [],
  branch: Branch.ORMOC,
  ...overrides
});

describe('AgingReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
  });

  it('shows only accounts with a current collectible balance and uses the authoritative running balance', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan(),
      makeLoan({
        id: 'loan-paid-deceased',
        code: '2583',
        borrowerName: 'PACALDO, REYNALDO',
        runningBalance: 0,
        amountCollected: 10000,
        status: MovingStatus.PAID
      }),
      makeLoan({
        id: 'loan-paid-reconstructed',
        code: 'C-003',
        borrowerName: 'RECONSTRUCTED, CLIENT',
        runningBalance: 0,
        amountCollected: 10000,
        status: MovingStatus.PAID,
        payments: [{
          ...makeLoan().payments[0],
          id: 'payment-recon',
          loanId: 'loan-paid-reconstructed',
          amount: 10000,
          balanceAfter: 0,
          remarks: 'Reconstructed'
        }]
      }),
      makeLoan({
        id: 'loan-terminal-write-off',
        code: 'C-004',
        borrowerName: 'WRITE-OFF, CLIENT',
        runningBalance: 2500,
        amountCollected: 7500,
        status: MovingStatus.NM,
        actionNote: 'Approved write-off'
      })
    ]);

    render(<AgingReport selectedBranch={Branch.ORMOC} />);

    expect(screen.getAllByText('₱4,000').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('120+ Days')[0]);

    expect(screen.getByText('ACTIVE, CLIENT')).toBeInTheDocument();
    expect(screen.queryByText('PACALDO, REYNALDO')).not.toBeInTheDocument();
    expect(screen.queryByText('RECONSTRUCTED, CLIENT')).not.toBeInTheDocument();
    expect(screen.queryByText('WRITE-OFF, CLIENT')).not.toBeInTheDocument();
  });
});
