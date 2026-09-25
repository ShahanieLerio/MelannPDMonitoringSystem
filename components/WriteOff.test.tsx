import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import WriteOff from './WriteOff';
import { store } from '../services/dataStore.ts';
import {
  Branch,
  DispositionStatus,
  DispositionType,
  LocationStatus,
  MovingStatus,
  PaymentStatus,
  UserRole,
  UserStatus,
  type Loan,
  type ManagementDisposition,
  type User
} from '../types.ts';

vi.mock('../services/dataStore.ts', () => ({
  store: {
    getLoans: vi.fn(),
    getAllDispositions: vi.fn(),
    getDeadWriteOffs: vi.fn(),
    isDeadWriteOff: vi.fn(),
    subscribe: vi.fn(),
    addDisposition: vi.fn(),
    updateDispositionStatus: vi.fn(),
    updateLoan: vi.fn()
  }
}));

describe('WriteOff', () => {
  const loan: Loan = {
    id: 'loan-1',
    collector: 'Collector One',
    code: 'L-001',
    borrowerName: 'Maria Santos',
    firstName: 'Maria',
    lastName: 'Santos',
    monthReported: '2026-07',
    dueDate: '2026-07-15',
    outstandingBalance: 10000,
    amountCollected: 0,
    runningBalance: 10000,
    status: MovingStatus.NM,
    location: LocationStatus.NOT_LOCATED,
    area: 'Area 1',
    city: 'Ormoc',
    barangay: 'Barangay 1',
    fullAddress: 'Ormoc City',
    payments: [],
    remarks: [],
    history: [],
    branch: Branch.ORMOC
  };

  const disposition: ManagementDisposition = {
    id: 'disp-1',
    loanId: loan.id,
    type: DispositionType.PROSPECT_WRITE_OFF,
    reason: 'Long overdue account',
    evidence: [],
    status: DispositionStatus.PENDING_REVIEW,
    decidedBy: 'Manager One',
    decisionDate: '2026-07-03T00:00:00.000Z'
  };

  const makeUser = (role: UserRole): User => ({
    id: `user-${role}`,
    username: role,
    fullName: role,
    role,
    status: UserStatus.ACTIVE,
    branch: Branch.ALL,
    createdAt: '2026-07-03',
    statusHistory: []
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (store.getLoans as any).mockReturnValue([loan]);
    (store.getAllDispositions as any).mockReturnValue([disposition]);
    (store.getDeadWriteOffs as any).mockReturnValue([]);
    (store.isDeadWriteOff as any).mockReturnValue(false);
    (store.subscribe as any).mockReturnValue(() => {});
    (store.addDisposition as any).mockResolvedValue({ ...disposition, id: 'persisted-dead-disp' });
    (store.updateDispositionStatus as any).mockResolvedValue(undefined);
    (store.updateLoan as any).mockResolvedValue(undefined);
  });

  it('blocks non-EVP users from approving write-off clients and shows the warning modal', () => {
    render(<WriteOff currentUser={makeUser(UserRole.CASHIER)} selectedBranch={Branch.ALL} />);

    // Switch to Located tab to view pending review accounts
    fireEvent.click(screen.getByRole('button', { name: /📍\s*Located/i }));
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(screen.getByText('Sorry! Only the Executive Vice President can Approve Clients')).toBeInTheDocument();
    expect(store.updateDispositionStatus).not.toHaveBeenCalled();
    expect(store.updateLoan).not.toHaveBeenCalled();
  });

  it('allows the Executive Vice President to approve write-off clients', async () => {
    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

    // Switch to Located tab to view pending review accounts
    fireEvent.click(screen.getByRole('button', { name: /📍\s*Located/i }));
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(store.updateDispositionStatus).toHaveBeenCalledWith(
        'disp-1',
        DispositionStatus.APPROVED,
        UserRole.EXECUTIVE_VICE_PRESIDENT,
        UserRole.EXECUTIVE_VICE_PRESIDENT
      );
    });
    expect(store.updateLoan).toHaveBeenCalled();
  });

  it('renders Dashboard, Located, Unlocated, and Deceased Clients classification tabs', () => {
    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

    expect(screen.getByRole('button', { name: /📊\s*Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📍\s*Located/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🔍\s*Unlocated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🕊️\s*Deceased Clients/i })).toBeInTheDocument();
  });

  it('renders Dashboard overview summary cards and cross-category collector comparison table with overall total', () => {
    const loanLocated: Loan = {
      ...loan,
      id: 'loan-loc',
      collector: 'Collector A',
      code: 'L-LOC',
      borrowerName: 'Located Borrower',
      principal: 10000,
      totalLoan: 12000,
      amountCollected: 2000,
      runningBalance: 10000
    };
    const loanUnlocated: Loan = {
      ...loan,
      id: 'loan-unloc',
      collector: 'Collector A',
      code: 'L-UNLOC',
      borrowerName: 'Unlocated Borrower',
      principal: 20000,
      totalLoan: 24000,
      amountCollected: 4000,
      runningBalance: 20000
    };
    const loanDeceased: Loan = {
      ...loan,
      id: 'loan-dec',
      collector: 'Collector B',
      code: 'L-DEC',
      borrowerName: 'Deceased Borrower',
      principal: 30000,
      totalLoan: 35000,
      amountCollected: 5000,
      runningBalance: 30000,
      remarks: [{
        id: 'rem-dec',
        text: 'Deceased borrower',
        author: 'Collector B',
        timestamp: '2026-07-04T00:00:00.000Z'
      }]
    };

    const dispLoc: ManagementDisposition = {
      ...disposition,
      id: 'disp-loc',
      loanId: 'loan-loc',
      writeOffClassification: 'Located'
    };
    const dispUnloc: ManagementDisposition = {
      ...disposition,
      id: 'disp-unloc',
      loanId: 'loan-unloc',
      writeOffClassification: 'Unlocated'
    };

    (store.getLoans as any).mockReturnValue([loanLocated, loanUnlocated, loanDeceased]);
    (store.getAllDispositions as any).mockReturnValue([dispLoc, dispUnloc]);
    (store.getDeadWriteOffs as any).mockReturnValue([loanDeceased]);
    (store.isDeadWriteOff as any).mockImplementation((l: Loan) => l.id === 'loan-dec');

    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

    // Check 4 Dashboard KPI summary cards
    expect(screen.getByText('Located Write-Offs')).toBeInTheDocument();
    expect(screen.getByText('Unlocated Write-Offs')).toBeInTheDocument();
    expect(screen.getAllByText('Deceased Clients').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overall Grand Total')).toBeInTheDocument();

    // Check Collector Breakdown Table headers
    expect(screen.getByText('Collector Breakdown & Comparison Report')).toBeInTheDocument();
    expect(screen.getAllByText('Collector A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Collector B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overall Total')).toBeInTheDocument();
  });

  it('automatically lists deceased clients directly without requiring review/approval tabs', () => {
    const deceasedLoan: Loan = {
      ...loan,
      id: 'dead-loan-1',
      code: 'D-001',
      borrowerName: 'Juan Dela Cruz',
      remarks: [{
        id: 'remark-1',
        text: 'Deceased borrower',
        author: 'Collector One',
        timestamp: '2026-07-04T00:00:00.000Z'
      }]
    };
    (store.getLoans as any).mockReturnValue([deceasedLoan]);
    (store.getAllDispositions as any).mockReturnValue([]);
    (store.getDeadWriteOffs as any).mockReturnValue([deceasedLoan]);
    (store.isDeadWriteOff as any).mockReturnValue(true);

    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

    fireEvent.click(screen.getByRole('button', { name: /deceased clients/i }));

    // Sub-tabs should NOT exist on Deceased Clients tab
    expect(screen.queryByRole('button', { name: /pending review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /officially approved/i })).not.toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Deceased Accounts (1)')).toBeInTheDocument();
    // No approve action button on Deceased Clients tab
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('separates real collections from write-off/deceased amounts and shows the financial totals', () => {
    const deceasedLoan: Loan = {
      ...loan,
      id: 'dead-financial-loan',
      code: 'D-002',
      borrowerName: 'Pedro Reyes',
      principal: 8000,
      totalLoan: 10000,
      amountCollected: 10000,
      runningBalance: 0,
      payments: [
        {
          id: 'cash-payment',
          loanId: 'dead-financial-loan',
          date: '2026-06-01',
          orNumber: 'OR-001',
          amount: 3000,
          balanceAfter: 7000,
          recorder: 'Cashier',
          remarks: '',
          status: PaymentStatus.GOOD,
          createdAt: '2026-06-01T00:00:00.000Z'
        },
        {
          id: 'deceased-settlement',
          loanId: 'dead-financial-loan',
          date: '2026-07-01',
          orNumber: 'OR-DECEASED',
          amount: 7000,
          balanceAfter: 0,
          recorder: 'Manager',
          remarks: 'Deceased',
          status: PaymentStatus.GOOD,
          createdAt: '2026-07-01T00:00:00.000Z'
        }
      ],
      remarks: [{
        id: 'dead-remark',
        text: 'Deceased borrower',
        author: 'Collector One',
        timestamp: '2026-07-01T00:00:00.000Z'
      }]
    };
    (store.getLoans as any).mockReturnValue([deceasedLoan]);
    (store.getAllDispositions as any).mockReturnValue([]);
    (store.getDeadWriteOffs as any).mockReturnValue([deceasedLoan]);
    (store.isDeadWriteOff as any).mockReturnValue(true);

    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);
    fireEvent.click(screen.getByRole('button', { name: /deceased clients/i }));

    expect(screen.getByText('Total Principal')).toBeInTheDocument();
    expect(screen.getByText('Total Interest')).toBeInTheDocument();
    expect(screen.getAllByText('Amt. Collected').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Balance Before Write-Off')).toBeInTheDocument();
    expect(screen.getAllByText('Amt. Deceased').length).toBeGreaterThanOrEqual(1);

    const row = screen.getByText('Pedro Reyes').closest('tr');
    expect(row).not.toBeNull();
    const rowQueries = within(row as HTMLTableRowElement);
    expect(rowQueries.getByText('PHP 8,000')).toBeInTheDocument();
    expect(rowQueries.getByText('PHP 2,000')).toBeInTheDocument();
    expect(rowQueries.getByText('PHP 10,000')).toBeInTheDocument();
    expect(rowQueries.getByText('PHP 3,000')).toBeInTheDocument();
    expect(rowQueries.getAllByText('PHP 7,000')).toHaveLength(2);
    expect(screen.getByText('PHP 3,000.00')).toBeInTheDocument();
    expect(screen.getByText('PHP 2,000.00')).toBeInTheDocument();
    expect(screen.getAllByText('PHP 7,000.00')).toHaveLength(2);
  });

  it('updates total headers dynamically when a Collector Filter is selected', () => {
    const loanCollectorA: Loan = {
      ...loan,
      id: 'loan-col-a',
      collector: 'Collector A',
      code: 'L-A',
      borrowerName: 'Alice Santos',
      principal: 10000,
      totalLoan: 12000,
      amountCollected: 4000,
      runningBalance: 8000
    };
    const loanCollectorB: Loan = {
      ...loan,
      id: 'loan-col-b',
      collector: 'Collector B',
      code: 'L-B',
      borrowerName: 'Bob Reyes',
      principal: 20000,
      totalLoan: 24000,
      amountCollected: 10000,
      runningBalance: 14000
    };
    const dispA: ManagementDisposition = {
      ...disposition,
      id: 'disp-a',
      loanId: 'loan-col-a'
    };
    const dispB: ManagementDisposition = {
      ...disposition,
      id: 'disp-b',
      loanId: 'loan-col-b'
    };

    (store.getLoans as any).mockReturnValue([loanCollectorA, loanCollectorB]);
    (store.getAllDispositions as any).mockReturnValue([dispA, dispB]);
    (store.getDeadWriteOffs as any).mockReturnValue([]);
    (store.isDeadWriteOff as any).mockReturnValue(false);

    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

    // Initially with All Collectors: Total Loan = 36,000, Total Principal = 30,000
    expect(screen.getByText('PHP 36,000.00')).toBeInTheDocument();
    expect(screen.getByText('PHP 30,000.00')).toBeInTheDocument();

    // Select Collector A
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Collector A' } });

    // Header totals update to Collector A only: Total Loan = 12,000, Total Principal = 10,000
    expect(screen.getByText('PHP 12,000.00')).toBeInTheDocument();
    expect(screen.getByText('PHP 10,000.00')).toBeInTheDocument();
    expect(screen.queryByText('PHP 36,000.00')).not.toBeInTheDocument();
  });
});
