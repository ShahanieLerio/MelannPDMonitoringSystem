import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollectionSheet from './CollectionSheet';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, PaymentStatus, UserRole, UserStatus } from '../types';
import * as XLSX from 'xlsx';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoans: vi.fn(),
    getCollectors: vi.fn(),
    subscribe: vi.fn()
  }
}));

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
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

describe('CollectionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.subscribe as any).mockReturnValue(() => {});
    (store.getCollectors as any).mockReturnValue([
      { id: 'c1', name: 'John Doe', nickname: 'JOHN', address: 'Naval', branch: Branch.NAVAL },
      { id: 'c2', name: 'Jane Smith', nickname: 'JANE', address: 'Ormoc', branch: Branch.NAVAL }
    ]);
    (store.getLoans as any).mockReturnValue([
      makeLoan(),
      makeLoan({
        id: 'l2',
        collector: 'JOHN',
        code: 'C-002',
        borrowerName: 'Reyes, Ana',
        firstName: 'Ana',
        lastName: 'Reyes',
        dueDate: '2024-04-15',
        city: 'Naval',
        barangay: 'Caraycaray',
        runningBalance: 5000
      }),
      makeLoan({
        id: 'l3',
        collector: 'JANE',
        code: 'C-003',
        borrowerName: 'Paid, Client',
        firstName: 'Client',
        lastName: 'Paid',
        status: MovingStatus.PAID,
        runningBalance: 0
      })
    ]);
  });

  it('shows collectors with only collectible account counts', () => {
    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText('Collection Sheets')).toBeInTheDocument();
    expect(screen.getByText('JOHN')).toBeInTheDocument();
    expect(screen.getByText('JANE')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('opens a collector sheet grouped by city and barangay and excludes paid accounts', () => {
    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('JOHN'));

    expect(screen.getAllByText(/CITY: Naval/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BARANGAY: Poblacion/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BARANGAY: Caraycaray/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('SANTOS, MARIA').length).toBeGreaterThan(0);
    expect(screen.queryByText('PAID, CLIENT')).not.toBeInTheDocument();
  });

  it('filters a collector sheet by due date range and exports visible accounts', () => {
    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('JOHN'));
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2024-04-01' } });

    expect(screen.queryByText('SANTOS, MARIA')).not.toBeInTheDocument();
    expect(screen.getAllByText('REYES, ANA').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/^excel$/i));

    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.arrayContaining(['C-002', 'REYES, ANA'])
      ])
    );
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^Collection_Sheet_JOHN_Naval_Branch_/));
  });

  it('filters a collector sheet by city and barangay for location-specific exports', () => {
    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('JOHN'));
    fireEvent.change(screen.getByLabelText('Filter by barangay'), { target: { value: 'Caraycaray' } });

    expect(screen.queryByText('SANTOS, MARIA')).not.toBeInTheDocument();
    expect(screen.getAllByText('REYES, ANA').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/^excel$/i));
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith(expect.arrayContaining([
      ['City', 'All cities'],
      ['Barangay', 'Caraycaray'],
      expect.arrayContaining(['C-002', 'REYES, ANA'])
    ]));
  });

  it('calls browser print for the printable collection sheet', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText('JOHN'));
    fireEvent.click(screen.getByText(/^print$/i));

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('prints the latest valid payment date with its amount below it', () => {
    (store.getLoans as any).mockReturnValue([
      makeLoan({
        payments: [
          {
            id: 'p1', loanId: 'l1', date: '2025-10-01', orNumber: 'OR-1', amount: 500,
            balanceAfter: 7500, recorder: 'Admin', status: PaymentStatus.GOOD, createdAt: '2025-10-01T08:00:00Z'
          },
          {
            id: 'p2', loanId: 'l1', date: '2025-11-06', orNumber: 'OR-2', amount: 1200,
            balanceAfter: 6300, recorder: 'Admin', status: PaymentStatus.GOOD, createdAt: '2025-11-06T08:00:00Z'
          },
          {
            id: 'p3', loanId: 'l1', date: '2025-12-01', orNumber: 'OR-3', amount: 999,
            balanceAfter: 5301, recorder: 'Admin', status: PaymentStatus.REVERSED, createdAt: '2025-12-01T08:00:00Z'
          }
        ]
      })
    ]);

    render(<CollectionSheet currentUser={currentUser} selectedBranch={Branch.NAVAL} />);
    fireEvent.click(screen.getByText('JOHN'));

    expect(screen.getByText('Last Payment & Amount')).toBeInTheDocument();
    expect(screen.getByText('11-06-2025')).toBeInTheDocument();
    expect(screen.getByText('₱1,200')).toBeInTheDocument();
    expect(screen.queryByText('12-01-2025')).not.toBeInTheDocument();
  });
});
