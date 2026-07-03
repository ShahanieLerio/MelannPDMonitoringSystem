import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WriteOff from './WriteOff';
import { store } from '../services/dataStore.ts';
import {
  Branch,
  DispositionStatus,
  DispositionType,
  LocationStatus,
  MovingStatus,
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
    subscribe: vi.fn(),
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
    (store.subscribe as any).mockReturnValue(() => {});
    (store.updateDispositionStatus as any).mockResolvedValue(undefined);
    (store.updateLoan as any).mockResolvedValue(undefined);
  });

  it('blocks non-EVP users from approving write-off clients and shows the warning modal', () => {
    render(<WriteOff currentUser={makeUser(UserRole.CASHIER)} selectedBranch={Branch.ALL} />);

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(screen.getByText('Sorry! Only the Executive Vice President can Approve Clients')).toBeInTheDocument();
    expect(store.updateDispositionStatus).not.toHaveBeenCalled();
    expect(store.updateLoan).not.toHaveBeenCalled();
  });

  it('allows the Executive Vice President to approve write-off clients', async () => {
    render(<WriteOff currentUser={makeUser(UserRole.EXECUTIVE_VICE_PRESIDENT)} selectedBranch={Branch.ALL} />);

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
});
