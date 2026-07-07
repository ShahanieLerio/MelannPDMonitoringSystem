import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoanGrid from './LoanGrid';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, UserRole, UserStatus } from '../types';
import * as XLSX from 'xlsx';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    getCollectors: vi.fn(),
    getDispositions: vi.fn(),
    deleteLoan: vi.fn(),
    subscribe: vi.fn()
  }
}));

vi.mock('./ClientModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="client-modal">{loan.borrowerName}<button onClick={onClose}>Close Profile</button></div> }));
vi.mock('./ClientFormModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="client-form-modal">{loan ? loan.borrowerName : 'Add Client'}<button onClick={onClose}>Close Form</button></div> }));
vi.mock('./RemarksModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="remarks-modal">{loan.borrowerName}<button onClick={onClose}>Close Remarks</button></div> }));
vi.mock('./HistoryModal.tsx', () => ({ default: ({ loan, onClose }: any) => <div data-testid="history-modal">{loan.borrowerName}<button onClick={onClose}>Close History</button></div> }));
vi.mock('./BulkImportModal.tsx', () => ({ default: ({ onClose }: any) => <div data-testid="bulk-import-modal"><button onClick={onClose}>Close Import</button></div> }));
vi.mock('./SecureDeleteModal.tsx', () => ({ default: ({ clientName, onConfirm, onCancel }: any) => <div data-testid="secure-delete-modal">{clientName}<button onClick={onConfirm}>Confirm Delete</button><button onClick={onCancel}>Cancel Delete</button></div> }));

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}));

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
  remarks: [],
  history: [],
  branch: Branch.NAVAL,
  ...overrides
});

describe('LoanGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.getCollectors as any).mockReturnValue([
      { id: 'c1', name: 'John Doe', nickname: 'JOHN', branch: Branch.NAVAL },
      { id: 'c2', name: 'Jane Smith', nickname: 'JANE', branch: Branch.NAVAL }
    ]);
    (store.getDispositions as any).mockReturnValue([]);
    (store.subscribe as any).mockReturnValue(() => {});
    (store.getLoans as any).mockReturnValue([
      makeLoan(),
      makeLoan({
        id: 'l2',
        collector: 'JANE',
        code: 'C-002',
        borrowerName: 'Reyes, Ana',
        firstName: 'Ana',
        lastName: 'Reyes',
        monthReported: '2024-05',
        status: MovingStatus.PAID,
        runningBalance: 0
      })
    ]);
  });

  it('renders branch portfolio records and hides paid accounts by default', () => {
    render(<LoanGrid currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    expect(store.getLoans).toHaveBeenCalledWith(Branch.NAVAL);
    expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    expect(screen.queryByText('Reyes, Ana')).not.toBeInTheDocument();
  });

  it('searches by client code and explains when active filters hide a match', () => {
    render(<LoanGrid currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.change(screen.getByPlaceholderText(/numeric code or name/i), { target: { value: 'C-002' } });

    expect(screen.queryByText('Santos, Maria')).not.toBeInTheDocument();
    expect(screen.getByText(/matching client/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/clear filters/i));
    expect(screen.getByText('Reyes, Ana')).toBeInTheDocument();
  });

  it('exports the currently visible rows to Excel', () => {
    render(<LoanGrid currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText(/export excel/i));

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([
      expect.objectContaining({
        'Client Code': 'C-001',
        Collected: 3000,
        'Running Balance': 7000
      })
    ]);
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^LoanGrid_Naval_Branch_/));
  });

  it('opens detail, edit, remarks, history, import, and delete flows from user actions', async () => {
    (store.deleteLoan as any).mockResolvedValue(true);
    const onActionComplete = vi.fn();
    const { rerender } = render(<LoanGrid currentUser={currentUser} selectedBranch={Branch.NAVAL} activeAction="import" onActionComplete={onActionComplete} />);

    expect(screen.getByTestId('bulk-import-modal')).toBeInTheDocument();
    expect(onActionComplete).toHaveBeenCalled();
    rerender(<LoanGrid currentUser={currentUser} selectedBranch={Branch.NAVAL} activeAction={null} onActionComplete={onActionComplete} />);

    fireEvent.click(screen.getByText('Santos, Maria'));
    expect(screen.getByTestId('client-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Profile'));

    fireEvent.click(screen.getByTitle('Remarks'));
    expect(screen.getByTestId('remarks-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Remarks'));

    fireEvent.click(screen.getByTitle('Edit Client'));
    expect(screen.getByTestId('client-form-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Form'));

    fireEvent.click(screen.getByTitle('Activity History'));
    expect(screen.getByTestId('history-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close History'));

    fireEvent.click(screen.getByTitle('Delete Client'));
    fireEvent.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(store.deleteLoan).toHaveBeenCalledWith('l1', 'Admin', 'Deleted via Loan Grid');
    });
  });
});
