import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientUpdate from './ClientUpdate';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, PriorityLevel, UserRole, UserStatus } from '../types';

const mockClientUpdates = vi.fn();

vi.mock('../hooks/useClientUpdates.ts', () => ({
  useClientUpdates: (branch: Branch) => mockClientUpdates(branch)
}));

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    addRemark: vi.fn(),
    updateLoan: vi.fn()
  }
}));

vi.mock('./ClientModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="client-modal">{loan.borrowerName}<button onClick={onClose}>Close Profile</button></div> }));
vi.mock('./ClientFormModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="client-form-modal">{loan.borrowerName}<button onClick={onClose}>Close Form</button></div> }));
vi.mock('./RemarksModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="remarks-modal">{loan.borrowerName}<button onClick={onClose}>Close Remarks</button></div> }));
vi.mock('./VisitLogModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="visit-log-modal">{loan.borrowerName}<button onClick={onClose}>Close Visit</button></div> }));

const currentUser = {
  id: 'u1',
  username: 'Admin',
  fullName: 'System Admin',
  role: UserRole.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
  branch: Branch.ALL,
  createdAt: '2024-01-01',
  statusHistory: []
};

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
  amountCollected: 3000,
  runningBalance: 7000,
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'Area 1',
  city: 'Naval',
  barangay: 'Poblacion',
  fullAddress: 'Naval, Biliran',
  payments: [],
  remarks: [{
    id: 'r1',
    text: 'Promise to pay tomorrow',
    timestamp: '2026-05-25T08:00:00Z',
    collector: 'JOHN'
  }],
  history: [],
  aiPriority: PriorityLevel.TOP,
  branch: Branch.NAVAL,
  ...overrides
});

describe('ClientUpdate', () => {
  const priorityLoan = makeLoan();
  const monitorLoan = makeLoan({
    id: 'l2',
    code: 'C-002',
    borrowerName: 'Reyes, Ana',
    firstName: 'Ana',
    lastName: 'Reyes',
    aiPriority: PriorityLevel.MONITOR,
    daysWithoutPayment: 5,
    lastPaymentDateStr: '2026-05-20',
    latestRemark: {
      id: 'r2',
      text: 'Missed commitment',
      timestamp: '2026-05-24T08:00:00Z',
      collector: 'JANE'
    }
  });
  const noActivityLoan = makeLoan({
    id: 'l3',
    code: 'C-003',
    borrowerName: 'No Activity Client',
    firstName: 'Client',
    lastName: 'No Activity',
    collector: 'JANE',
    remarks: [],
    aiPriority: PriorityLevel.LOWEST
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (store.getLoans as any).mockReturnValue([priorityLoan, monitorLoan, noActivityLoan]);
    mockClientUpdates.mockReturnValue({
      loans: [priorityLoan, monitorLoan, noActivityLoan],
      updateList: [
        { ...priorityLoan, latestRemark: priorityLoan.remarks[0] },
        monitorLoan
      ],
      topPriorityList: [{ ...priorityLoan, latestRemark: priorityLoan.remarks[0] }],
      reminderList: [{ loan: monitorLoan, date: 'May 27', type: 'Follow-up', context: 'Call again' }],
      closeMonitoringList: [monitorLoan],
      filteredMainList: [monitorLoan]
    });
  });

  it('shows the major client update queues for the selected branch', () => {
    render(<ClientUpdate selectedBranch={Branch.NAVAL} currentUser={currentUser} />);

    expect(screen.getByText(/client pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/close monitoring queue/i)).toBeInTheDocument();
    expect(screen.getByText(/critical action/i)).toBeInTheDocument();
    expect(screen.getByText(/advance reminders/i)).toBeInTheDocument();
    expect(screen.getByText(priorityLoan.borrowerName)).toBeInTheDocument();
    expect(screen.getAllByText(monitorLoan.borrowerName).length).toBeGreaterThan(0);
  });

  it('downgrades stale top-priority loans during the automatic expiry check', async () => {
    render(<ClientUpdate selectedBranch={Branch.NAVAL} currentUser={currentUser} activeView="Priority" />);

    await waitFor(() => {
      expect(store.updateLoan).toHaveBeenCalledWith(priorityLoan.id, { aiPriority: PriorityLevel.NEED_ATTENTION }, 'System', 'Auto-Detection');
    });
  });

  it('opens action modals from monitoring rows', () => {
    render(<ClientUpdate selectedBranch={Branch.NAVAL} currentUser={currentUser} activeView="Monitoring" />);

    fireEvent.click(screen.getByTitle('Visit Log'));
    expect(screen.getByTestId('visit-log-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Visit'));

    fireEvent.click(screen.getByTitle('Remarks'));
    expect(screen.getByTestId('remarks-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Remarks'));

    fireEvent.click(screen.getByTitle('Client Details'));
    expect(screen.getByTestId('client-modal')).toBeInTheDocument();
  });

  it('can show only no-activity accounts', () => {
    render(<ClientUpdate selectedBranch={Branch.NAVAL} currentUser={currentUser} activeView="No Commitments" />);

    expect(screen.getByText('No Activity Client')).toBeInTheDocument();
    expect(screen.queryByText(priorityLoan.borrowerName)).not.toBeInTheDocument();
  });
});
