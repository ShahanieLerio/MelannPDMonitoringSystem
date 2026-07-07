import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import MonthlyPerformance from './MonthlyPerformance';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, PaymentStatus } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    getCollectors: vi.fn(),
    getDispositions: vi.fn(),
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
    Tooltip: Part
  };
});

const makeLoan = (overrides: Record<string, any> = {}) => ({
  id: 'loan-1',
  collector: 'PD CARIGARA',
  code: 'C-001',
  borrowerName: 'SANTOS, MARIA',
  firstName: 'Maria',
  lastName: 'Santos',
  monthReported: '2024-02',
  dueDate: '2024-06-18',
  totalLoan: 10000,
  outstandingBalance: 10000,
  amountCollected: 0,
  runningBalance: 10000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'CARIGARA',
  city: 'Carigara',
  barangay: 'Poblacion',
  fullAddress: 'Carigara, Leyte',
  payments: [],
  remarks: [],
  history: [],
  branch: Branch.ORMOC,
  ...overrides
});

describe('MonthlyPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
    (store.getCollectors as any).mockReturnValue([
      { id: 'collector-1', name: 'PD CARIGARA', nickname: 'PD CARIGARA', address: 'CARIGARA', branch: Branch.ORMOC },
      { id: 'collector-2', name: 'TORRETA', nickname: 'TORRETA', address: 'ISABEL - PALOMPON', branch: Branch.ORMOC }
    ]);
    (store.getDispositions as any).mockReturnValue([]);
  });

  it('opens account details for the clicked reported past due row', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        id: 'loan-1',
        collector: 'TORRETA',
        code: 'C-001',
        borrowerName: 'SANTOS, MARIA',
        monthReported: '2026-05',
        dueDate: '2026-05-15',
        totalLoan: 40000,
        outstandingBalance: 40000,
        area: 'ISABEL - PALOMPON'
      }),
      makeLoan({
        id: 'loan-2',
        collector: 'TORRETA',
        code: 'C-002',
        borrowerName: 'CRUZ, ANA',
        monthReported: '2026-05',
        dueDate: '2026-05-20',
        totalLoan: 29996,
        outstandingBalance: 29996,
        area: 'ISABEL - PALOMPON'
      }),
      makeLoan({
        id: 'loan-3',
        collector: 'PD CARIGARA',
        code: 'C-003',
        borrowerName: 'DELA CRUZ, JOSE',
        monthReported: '2026-04',
        dueDate: '2026-04-20',
        totalLoan: 10000
      })
    ]);

    const { container } = render(<MonthlyPerformance selectedBranch={Branch.ORMOC} />);

    const monthSelects = container.querySelectorAll('select');
    fireEvent.change(monthSelects[0], { target: { value: '05' } });
    fireEvent.change(monthSelects[1], { target: { value: '2026' } });
    fireEvent.change(monthSelects[2], { target: { value: '05' } });
    fireEvent.change(monthSelects[3], { target: { value: '2026' } });

    const collectorRow = screen.getByText('TORRETA').closest('tr');
    expect(collectorRow).not.toBeNull();
    expect(within(collectorRow as HTMLTableRowElement).getByText(/69,996/)).toBeInTheDocument();

    fireEvent.click(collectorRow as HTMLTableRowElement);

    expect(screen.getByText('Reported Past Due Details')).toBeInTheDocument();
    expect(screen.getAllByText('TORRETA').length).toBeGreaterThan(1);
    expect(screen.getByText('SANTOS, MARIA')).toBeInTheDocument();
    expect(screen.getByText('CRUZ, ANA')).toBeInTheDocument();
    expect(screen.getAllByText('May 2026').length).toBeGreaterThan(1);
    expect(screen.getByText('May 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('May 20, 2026')).toBeInTheDocument();
    expect(screen.getByText(/40,000/)).toBeInTheDocument();
    expect(screen.getByText(/29,996/)).toBeInTheDocument();
    expect(screen.getAllByText(/69,996/).length).toBeGreaterThan(1);
  });

  it('opens daily collection drilldown for the clicked past due collection efficiency row', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        payments: [
          {
            id: 'payment-1',
            loanId: 'loan-1',
            date: '2026-06-15',
            orNumber: 'OR-100',
            amount: 1905,
            balanceAfter: 8095,
            recorder: 'Admin',
            status: PaymentStatus.GOOD,
            createdAt: '2026-06-15'
          },
          {
            id: 'payment-2',
            loanId: 'loan-1',
            date: '2026-06-20',
            orNumber: 'OR-101',
            amount: 1000,
            balanceAfter: 7095,
            recorder: 'Admin',
            status: PaymentStatus.GOOD,
            createdAt: '2026-06-20'
          }
        ]
      }),
      makeLoan({
        id: 'loan-2',
        code: 'C-002',
        borrowerName: 'OUTSIDE, DUE RANGE',
        dueDate: '2025-01-01',
        payments: [
          {
            id: 'payment-4',
            loanId: 'loan-2',
            date: '2026-06-20',
            orNumber: 'OR-999',
            amount: 9999,
            balanceAfter: 1,
            recorder: 'Admin',
            status: PaymentStatus.GOOD,
            createdAt: '2026-06-20'
          }
        ]
      }),
      makeLoan({
        id: 'loan-3',
        collector: 'TORRETA',
        code: 'C-003',
        borrowerName: 'CRUZ, ANA',
        dueDate: '2024-07-01',
        payments: [
          {
            id: 'payment-3',
            loanId: 'loan-3',
            date: '2026-06-18',
            orNumber: 'OR-200',
            amount: 500,
            balanceAfter: 9500,
            recorder: 'Admin',
            status: PaymentStatus.GOOD,
            createdAt: '2026-06-18'
          }
        ]
      }),
      makeLoan({
        id: 'loan-4',
        code: 'C-004',
        borrowerName: 'FULLY PAID, CLIENT',
        dueDate: '2024-06-19',
        status: MovingStatus.PAID,
        outstandingBalance: 0,
        runningBalance: 0,
        amountCollected: 700,
        payments: [
          {
            id: 'payment-5',
            loanId: 'loan-4',
            date: '2026-06-20',
            orNumber: 'OR-PAID',
            amount: 700,
            balanceAfter: 0,
            recorder: 'Admin',
            status: PaymentStatus.GOOD,
            createdAt: '2026-06-20'
          }
        ]
      })
    ]);

    const { container } = render(<MonthlyPerformance selectedBranch={Branch.ORMOC} />);

    fireEvent.click(screen.getByRole('button', { name: /past due collection efficiency/i }));

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-06-15' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputs[2], { target: { value: '2016-01-01' } });
    fireEvent.change(dateInputs[3], { target: { value: '2024-12-31' } });

    const collectorRow = screen.getByText('PD CARIGARA').closest('tr');
    expect(collectorRow).not.toBeNull();
    expect(within(collectorRow as HTMLTableRowElement).getByText('₱3,605')).toBeInTheDocument();

    fireEvent.click(collectorRow as HTMLTableRowElement);

    expect(screen.getByText('Daily Collection Report')).toBeInTheDocument();
    expect(screen.getAllByText('PD CARIGARA').length).toBeGreaterThan(1);
    expect(screen.getByText('Jun 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('Jun 20, 2026')).toBeInTheDocument();
    expect(screen.queryByText('OR-999')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Jun 20, 2026/i }));

    expect(screen.getByText('Collection Details')).toBeInTheDocument();
    expect(screen.getByText('SANTOS, MARIA')).toBeInTheDocument();
    expect(screen.getByText('OR-101')).toBeInTheDocument();
    expect(screen.getByText('FULLY PAID, CLIENT')).toBeInTheDocument();
    expect(screen.getByText('OR-PAID')).toBeInTheDocument();
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0);
    expect(screen.queryByText('OUTSIDE, DUE RANGE')).not.toBeInTheDocument();
    expect(screen.getByText('₱1,905')).toBeInTheDocument();
    expect(screen.getAllByText('₱3,605')).toHaveLength(2);
  });
});
