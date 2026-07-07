import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import Dashboard from './Dashboard';
import { store } from '../services/dataStore';
import { Branch, MovingStatus, LocationStatus, PaymentStatus } from '../types';
import * as XLSX from 'xlsx';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    getCollectors: vi.fn(),
    subscribe: vi.fn()
  }
}));

vi.mock('../services/geminiService', () => ({
  getLoanInsights: vi.fn()
}));

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}));

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-chart">{children}</div>
  );
  const ChartShell = () => <div data-testid="mock-chart-shell" />;
  const ChartPart = () => null;

  return {
    ResponsiveContainer,
    AreaChart: ChartShell,
    PieChart: ChartShell,
    Area: ChartPart,
    Bar: ChartPart,
    BarChart: ChartShell,
    CartesianGrid: ChartPart,
    Cell: ChartPart,
    Legend: ChartPart,
    Pie: ChartShell,
    Tooltip: ChartPart,
    XAxis: ChartPart,
    YAxis: ChartPart
  };
});

describe('Dashboard', () => {
  const makeLoan = (overrides: Record<string, any> = {}) => ({
    id: 'l1',
    collector: 'JOHN',
    code: 'C-001',
    borrowerName: 'Santos, Maria',
    firstName: 'Maria',
    lastName: 'Santos',
    monthReported: '2024-02',
    dueDate: '2024-03-01',
    totalLoan: 10000,
    outstandingBalance: 10000,
    amountCollected: 5000,
    runningBalance: 5000,
    status: MovingStatus.MOVING,
    location: LocationStatus.LOCATED,
    area: '',
    city: '',
    barangay: '',
    fullAddress: '',
    payments: [
      {
        id: 'p1',
        loanId: 'l1',
        date: new Date().toISOString().split('T')[0],
        orNumber: 'OR-001',
        amount: 5000,
        balanceAfter: 5000,
        recorder: 'Admin',
        status: PaymentStatus.GOOD,
        createdAt: '2024-02-01'
      }
    ],
    remarks: [],
    history: [],
    branch: Branch.NAVAL,
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (store.getLoans as any).mockReturnValue([
      makeLoan(),
      makeLoan({
        id: 'l2',
        code: 'C-002',
        borrowerName: 'Reyes, Ana',
        collector: 'JANE',
        totalLoan: 8000,
        outstandingBalance: 8000,
        amountCollected: 8000,
        runningBalance: 0,
        status: MovingStatus.PAID,
        payments: []
      }),
      makeLoan({
        id: 'l3',
        code: 'C-003',
        borrowerName: 'Near Full Client',
        collector: 'JOHN',
        totalLoan: 3000,
        outstandingBalance: 3000,
        amountCollected: 2200,
        runningBalance: 800,
        status: MovingStatus.MOVING,
        payments: []
      })
    ]);
    (store.getCollectors as any).mockReturnValue([
      { id: 'c1', name: 'John Doe', nickname: 'JOHN', branch: Branch.NAVAL },
      { id: 'c2', name: 'Jane Smith', nickname: 'JANE', branch: Branch.NAVAL }
    ]);
    (store.subscribe as any).mockReturnValue(() => {});
  });

  it('renders portfolio KPI cards from loan data', () => {
    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText('Institutional Performance Matrix')).toBeInTheDocument();
    expect(screen.getByText('Total Accounts')).toBeInTheDocument();
    expect(screen.getByText('Total Loan')).toBeInTheDocument();
    expect(screen.getByText('Total Reported')).toBeInTheDocument();
    expect(screen.getByText('Total Collected')).toBeInTheDocument();
    expect(screen.getByText('Running Balance')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('2 Active as of now')).toBeInTheDocument();
    expect(screen.getAllByText(/21,000/).length).toBeGreaterThan(0);
  });

  it('keeps total accounts fixed while active count excludes paid and terminal outcome clients', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        id: 'active',
        code: 'C-ACT',
        borrowerName: 'Active Client',
        runningBalance: 5000,
        status: MovingStatus.MOVING
      }),
      makeLoan({
        id: 'paid',
        code: 'C-PAID',
        borrowerName: 'Paid Client',
        runningBalance: 0,
        status: MovingStatus.PAID
      }),
      makeLoan({
        id: 'dead',
        code: 'C-DEAD',
        borrowerName: 'Deceased Client',
        runningBalance: 5000,
        status: MovingStatus.NM,
        remarks: [{ id: 'r-dead', text: 'Client deceased', timestamp: '2024-02-01', collector: 'JOHN' }]
      }),
      makeLoan({
        id: 'recon',
        code: 'C-RECON',
        borrowerName: 'Reconstructed Client',
        runningBalance: 5000,
        status: MovingStatus.NM,
        payments: [{
          id: 'p-recon',
          loanId: 'recon',
          date: '2024-02-01',
          orNumber: 'OR-RECON',
          amount: 1000,
          balanceAfter: 4000,
          recorder: 'Admin',
          remarks: 'Reconstructed account payment',
          status: PaymentStatus.GOOD,
          createdAt: '2024-02-01'
        }]
      }),
      makeLoan({
        id: 'write-off',
        code: 'C-WO',
        borrowerName: 'Write Off Client',
        runningBalance: 5000,
        status: MovingStatus.NMSR,
        actionStage: 'For Write-Off'
      })
    ]);

    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getByText('1 Active as of now')).toBeInTheDocument();
  });

  it('counts all assigned collector accounts while calculating efficiency from collectible accounts only', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        id: 'active',
        collector: 'JOHN',
        outstandingBalance: 10000,
        amountCollected: 5000,
        runningBalance: 5000,
        status: MovingStatus.MOVING,
        payments: [{
          id: 'p-active',
          loanId: 'active',
          date: '2024-02-01',
          orNumber: 'OR-ACT',
          amount: 5000,
          balanceAfter: 5000,
          recorder: 'Admin',
          status: PaymentStatus.GOOD,
          createdAt: '2024-02-01'
        }]
      }),
      makeLoan({
        id: 'paid',
        collector: 'JOHN',
        outstandingBalance: 8000,
        amountCollected: 8000,
        runningBalance: 0,
        status: MovingStatus.PAID,
        payments: [{
          id: 'p-paid',
          loanId: 'paid',
          date: '2024-02-01',
          orNumber: 'OR-PAID',
          amount: 8000,
          balanceAfter: 0,
          recorder: 'Admin',
          status: PaymentStatus.GOOD,
          createdAt: '2024-02-01'
        }]
      }),
      makeLoan({
        id: 'dead',
        collector: 'JOHN',
        outstandingBalance: 7000,
        runningBalance: 7000,
        remarks: [{ id: 'r-dead', text: 'Client deceased', timestamp: '2024-02-01', collector: 'JOHN' }]
      }),
      makeLoan({
        id: 'recon',
        collector: 'JOHN',
        outstandingBalance: 6000,
        runningBalance: 6000,
        payments: [{
          id: 'p-recon',
          loanId: 'recon',
          date: '2024-02-01',
          orNumber: 'OR-RECON',
          amount: 1000,
          balanceAfter: 5000,
          recorder: 'Admin',
          remarks: 'Reconstructed account payment',
          status: PaymentStatus.GOOD,
          createdAt: '2024-02-01'
        }]
      }),
      makeLoan({
        id: 'write-off',
        collector: 'JOHN',
        outstandingBalance: 5000,
        runningBalance: 5000,
        actionStage: 'For Write-Off'
      })
    ]);

    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('Export Excel'));

    const exportRows = (XLSX.utils.aoa_to_sheet as any).mock.calls[0][0];
    expect(exportRows).toContainEqual(['JOHN', 5, 18000, 13000, 5000, 72.22, 1]);
  });

  it('keeps total loan aligned with collected plus running balance when ledger data exceeds the recorded loan amount', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        totalLoan: 10000,
        outstandingBalance: 10000,
        amountCollected: 6000,
        runningBalance: 5000
      })
    ]);

    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getAllByText(/11,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
  });

  it('loads loans for the selected branch and subscribes to updates', () => {
    render(<Dashboard selectedBranch={Branch.ORMOC} />);

    expect(store.getLoans).toHaveBeenCalledWith(Branch.ORMOC);
    expect(store.getCollectors).toHaveBeenCalledWith(Branch.ALL);
    expect(store.subscribe).toHaveBeenCalled();
  });

  it('shows collector performance and account distribution', () => {
    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText('Collector Performance Matrix')).toBeInTheDocument();
    expect(screen.getByText('Account Distribution')).toBeInTheDocument();
    expect(screen.getAllByText('JOHN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JANE').length).toBeGreaterThan(0);
  });

  it('shows action and near-full-payment panels', () => {
    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText("Today's Action Summary")).toBeInTheDocument();
    expect(screen.getByText('Near Full Payment')).toBeInTheDocument();
    expect(screen.getByText('Near Full Client')).toBeInTheDocument();
    expect(screen.getAllByText(/800/).length).toBeGreaterThan(0);
  });

  it('exports near-full-payment clients grouped by collector with client and loan details', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        id: 'l3',
        code: 'C-003',
        borrowerName: 'Near Full Client',
        collector: 'JOHN',
        fullAddress: '123 Main St',
        dateRelease: '2024-01-15',
        dueDate: '2024-03-15',
        totalLoan: 3000,
        outstandingBalance: 3000,
        amountCollected: 2200,
        runningBalance: 800,
        status: MovingStatus.MOVING,
        payments: []
      }),
      makeLoan({
        id: 'l4',
        code: 'C-004',
        borrowerName: 'Second Near Full',
        collector: 'JANE',
        fullAddress: '456 Market Ave',
        dateRelease: '2024-02-01',
        dueDate: '2024-04-01',
        totalLoan: 5000,
        outstandingBalance: 5000,
        amountCollected: 4100,
        runningBalance: 900,
        status: MovingStatus.NM,
        payments: []
      })
    ]);

    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByTitle('Export Near Full Payment clients'));

    const exportRows = (XLSX.utils.aoa_to_sheet as any).mock.calls[0][0];
    expect(exportRows).toContainEqual(['Collector Filter', 'All Collectors']);
    expect(exportRows).toContainEqual(['Collector: JANE']);
    expect(exportRows).toContainEqual(['Collector: JOHN']);
    expect(exportRows).toContainEqual([
      'Code',
      'Client Name',
      'Address',
      'Moving Status',
      'Running Balance',
      'Date Release',
      'Maturity Date'
    ]);
    expect(exportRows).toContainEqual(['C-003', 'Near Full Client', '123 Main St', MovingStatus.MOVING, 800, '01/15/2024', '03/15/2024']);
    expect(exportRows).toContainEqual(['C-004', 'Second Near Full', '456 Market Ave', MovingStatus.NM, 900, '02/01/2024', '04/01/2024']);
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^Near_Full_Payment_Naval_Branch_All_Collectors_/));
  });

  it('can toggle the last-30-days filter', () => {
    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('Last 30 Days'));

    expect(screen.getByText(/Last 30 Days/)).toBeInTheDocument();
  });

  it('shows empty collector copy when no loans are assigned', () => {
    (store.getLoans as any).mockReturnValue([]);

    render(<Dashboard selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    expect(screen.getByText(/no clients assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/no clients with/i)).toBeInTheDocument();
  });
});
