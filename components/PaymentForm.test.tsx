import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentForm from './PaymentForm';
import { store } from '../services/dataStore';
import { Branch, LocationStatus, MovingStatus, PaymentStatus, UserRole, UserStatus } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getLoanByCode: vi.fn(),
    recordPayment: vi.fn(),
    getPaymentByOR: vi.fn(),
    reversePayment: vi.fn()
  }
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

describe('PaymentForm', () => {
  const today = () => new Date().toISOString().split('T')[0];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as any).AudioContext = vi.fn(function AudioContextMock() {
      return {
      createOscillator: () => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        }
      }),
      createGain: () => ({
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        }
      }),
      currentTime: 0,
      destination: {}
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const findClient = (loan = makeLoan()) => {
    (store.getLoanByCode as any).mockReturnValue(loan);
    render(<PaymentForm currentUser={currentUser} selectedBranch={Branch.NAVAL} />);

    fireEvent.change(screen.getByPlaceholderText(/enter client code/i), { target: { value: loan.code } });
    fireEvent.click(screen.getByText(/verify/i));

    expect(screen.getByText(loan.borrowerName)).toBeInTheDocument();
    return loan;
  };

  it('posts a valid payment after client lookup and confirmation', async () => {
    const loan = findClient();
    (store.recordPayment as any).mockResolvedValue({ ...loan, runningBalance: 6000 });

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText(/collector notes/i), {
      target: { value: 'Cash collection' }
    });
    fireEvent.click(screen.getByText(/post payment now/i));
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.recordPayment).toHaveBeenCalledWith(
        loan.id,
        1000,
        today(),
        'Cash collection',
        'Admin',
        UserRole.SUPER_ADMIN
      );
    });
    expect(JSON.parse(localStorage.getItem('melann_recent_payments') || '[]')[0]).toMatchObject({
      code: loan.code,
      amount: 1000
    });
  });

  it('rejects invalid payment amounts before saving', () => {
    findClient();

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } });
    fireEvent.click(screen.getByText(/post payment now/i));

    expect(screen.getByText(/please enter a valid amount/i)).toBeInTheDocument();
    expect(store.recordPayment).not.toHaveBeenCalled();
  });

  it('warns before allowing a second active payment on the same date', async () => {
    const loan = findClient(makeLoan({
      payments: [{
        id: 'p1',
        loanId: 'l1',
        date: today(),
        orNumber: 'OR-1',
        amount: 500,
        balanceAfter: 6500,
        recorder: 'Admin',
        status: PaymentStatus.GOOD,
        createdAt: today()
      }],
      history: [{
        id: 'h1',
        timestamp: `${today()}T07:30:00Z`,
        type: 'Payment Received',
        description: 'Payment Received OR-1',
        user: 'Admin',
        role: 'SUPER_ADMIN',
        module: 'Payments'
      }]
    }));
    (store.recordPayment as any).mockResolvedValue(loan);

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '250' } });
    fireEvent.click(screen.getByText(/post payment now/i));

    expect(screen.getByText(/duplicate payment warning/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/proceed anyway/i));

    await waitFor(() => {
      expect(store.recordPayment).toHaveBeenCalledWith(
        loan.id,
        250,
        today(),
        '',
        'Admin',
        UserRole.SUPER_ADMIN
      );
    });
  });

  it('verifies an OR number and reverses it only after a reason is supplied', async () => {
    const loan = makeLoan();
    const payment = {
      id: 'p1',
      loanId: loan.id,
      date: '2026-05-20',
      orNumber: 'OR-123',
      amount: 1200,
      balanceAfter: 5800,
      recorder: 'Admin',
      status: PaymentStatus.GOOD,
      createdAt: '2026-05-20'
    };
    (store.getPaymentByOR as any).mockReturnValue({ loan, payment });
    (store.reversePayment as any).mockResolvedValue({ success: true, message: 'Payment reversed.' });

    render(<PaymentForm currentUser={currentUser} selectedBranch={Branch.NAVAL} activeView="reverse" />);

    fireEvent.change(screen.getByPlaceholderText(/enter or number/i), { target: { value: 'OR-123' } });
    fireEvent.click(screen.getByText(/search/i));
    await waitFor(() => expect(store.getPaymentByOR).toHaveBeenCalledWith('OR-123'));

    expect(screen.getByText(loan.borrowerName)).toBeInTheDocument();
    const reverseButton = screen.getByText(/authenticate.*reverse/i);
    expect(reverseButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/state why/i), { target: { value: 'Wrong posting' } });
    fireEvent.click(reverseButton);
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.reversePayment).toHaveBeenCalledWith('OR-123', 'Wrong posting', 'Admin', UserRole.SUPER_ADMIN);
    });
  });
});
