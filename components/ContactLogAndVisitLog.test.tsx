import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactLogModal from './ContactLogModal.tsx';
import VisitLogModal from './VisitLogModal.tsx';
import ActionTrackerPersonnelModal from './ActionTrackerPersonnelModal.tsx';
import { store } from '../services/dataStore.ts';
import { Branch, UserRole, UserStatus, Loan, MovingStatus, LocationStatus, ContactMethod, VisitLogAction } from '../types.ts';

vi.mock('../services/dataStore.ts', () => ({
  store: {
    getActionPersonnel: vi.fn(),
    addActionPersonnel: vi.fn(),
    updateActionPersonnel: vi.fn(),
    deleteActionPersonnel: vi.fn(),
    getCollectors: vi.fn(),
    getSupervisors: vi.fn(),
    getContactLogs: vi.fn(),
    addContactLog: vi.fn(),
    deleteContactLog: vi.fn(),
    getVisitLogs: vi.fn(),
    addVisitLog: vi.fn(),
    deleteVisitLog: vi.fn(),
    subscribe: vi.fn(() => vi.fn())
  }
}));

const mockUser = {
  id: 'u1',
  username: 'admin',
  fullName: 'System Administrator',
  role: UserRole.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
  branch: Branch.ALL,
  createdAt: new Date().toISOString()
};

const mockLoan: Loan = {
  id: 'l1',
  collector: 'John Doe',
  code: '1001',
  firstName: 'Maria',
  lastName: 'Santos',
  outstandingBalance: 5000,
  amountCollected: 1000,
  runningBalance: 4000,
  borrowerName: 'Maria Santos',
  monthReported: '2023-10',
  dueDate: '2023-11-15',
  status: MovingStatus.MOVING,
  location: LocationStatus.LOCATED,
  area: 'Area 1',
  city: 'Baybay',
  barangay: 'Zone 1',
  fullAddress: 'Zone 1, Baybay City, Leyte',
  payments: [],
  remarks: [],
  history: [],
  branch: Branch.NAVAL
};

describe('Personnel Assigned Dropdown and Action Tracker Personnel Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (store.getActionPersonnel as any).mockReturnValue([
      { id: 'p1', name: 'Aldie Remedial', nickname: 'ALDIE', branch: Branch.NAVAL, role: 'Remedial Staff' }
    ]);
    (store.getCollectors as any).mockReturnValue([
      { id: 'c1', name: 'John Collector', nickname: 'JOHN', branch: Branch.NAVAL }
    ]);
    (store.getSupervisors as any).mockReturnValue([
      { id: 's1', name: 'Jane Supervisor', nickname: 'JANE', branch: Branch.NAVAL }
    ]);
    (store.getContactLogs as any).mockReturnValue([]);
    (store.getVisitLogs as any).mockReturnValue([]);
  });

  it('renders Personnel Assigned as a dropdown in ContactLogModal with available personnel', () => {
    render(<ContactLogModal loan={mockLoan} currentUser={mockUser} onClose={vi.fn()} />);

    // Personnel Assigned dropdown options should exist
    expect(screen.getByText(/-- select personnel assigned --/i)).toBeInTheDocument();
    expect(screen.getByText(/aldie remedial \(@aldie\)/i)).toBeInTheDocument();
    expect(screen.getByText(/john collector \(@john\)/i)).toBeInTheDocument();
    expect(screen.getByText(/jane supervisor \(@jane\)/i)).toBeInTheDocument();
  });

  it('submits contact log with selected personnel from dropdown', async () => {
    (store.addContactLog as any).mockResolvedValue({});

    render(<ContactLogModal loan={mockLoan} currentUser={mockUser} onClose={vi.fn()} />);

    // Select ALDIE from dropdown
    const selectElements = screen.getAllByRole('combobox');
    const personnelSelect = selectElements.find(s => s.querySelector('option[value="ALDIE"]'));
    expect(personnelSelect).toBeDefined();

    fireEvent.change(personnelSelect!, { target: { value: 'ALDIE' } });
    fireEvent.change(screen.getByPlaceholderText(/called the client/i), { target: { value: 'Called borrower regarding promise' } });
    fireEvent.click(screen.getByText(/log contact attempt/i));

    await waitFor(() => {
      expect(store.addContactLog).toHaveBeenCalledWith(
        'l1',
        expect.any(String),
        ContactMethod.CALL,
        'Called borrower regarding promise',
        '',
        false,
        'admin',
        UserRole.SUPER_ADMIN,
        'ALDIE'
      );
    });
  });

  it('renders Personnel Assigned as a dropdown in VisitLogModal with available personnel', () => {
    render(<VisitLogModal loan={mockLoan} currentUser={mockUser} onClose={vi.fn()} />);

    const selectElements = screen.getAllByRole('combobox');
    const personnelSelect = selectElements.find(s => s.querySelector('option[value="ALDIE"]'));
    expect(personnelSelect).toBeDefined();

    expect(screen.getByText(/aldie remedial \(@aldie\)/i)).toBeInTheDocument();
    expect(screen.getByText(/john collector \(@john\)/i)).toBeInTheDocument();
  });

  it('allows adding new personnel in ActionTrackerPersonnelModal', async () => {
    (store.addActionPersonnel as any).mockResolvedValue({});

    render(
      <ActionTrackerPersonnelModal
        isOpen={true}
        selectedBranch={Branch.NAVAL}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/action tracker personnel/i)).toBeInTheDocument();
    expect(screen.getByText('Aldie Remedial')).toBeInTheDocument();

    // Click Add Personnel button
    fireEvent.click(screen.getByRole('button', { name: /add personnel/i }));

    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'Mark Remedial' } });
    fireEvent.change(screen.getByPlaceholderText(/^e\.g\. juan$/i), { target: { value: 'MARK' } });
    fireEvent.click(screen.getByText(/verify & save/i));

    await waitFor(() => {
      expect(store.addActionPersonnel).toHaveBeenCalledWith(
        'Mark Remedial',
        Branch.NAVAL,
        'MARK',
        'Account Officer',
        '',
        ''
      );
    });
  });
});
