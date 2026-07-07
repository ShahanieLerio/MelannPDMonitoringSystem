import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryModal from './HistoryModal';
import { Branch, UserRole } from '../types';

describe('HistoryModal', () => {
  const onClose = vi.fn();
  const loan = {
    id: 'l1',
    code: 'C-001',
    borrowerName: 'Santos, Maria',
    branch: Branch.NAVAL,
    history: [
      {
        id: 'h1',
        timestamp: '2024-02-01T10:00:00',
        type: 'Loan Creation',
        description: 'Loan created',
        user: 'Admin',
        role: UserRole.SUPER_ADMIN,
        module: 'Loan Grid'
      },
      {
        id: 'h2',
        timestamp: '2024-02-02T11:00:00',
        type: 'Payment Received',
        description: 'Payment of PHP 5,000.00 recorded',
        user: 'Collector1',
        role: UserRole.NAVAL_USER,
        module: 'Payment Form'
      },
      {
        id: 'h3',
        timestamp: '2024-02-03T12:00:00',
        type: 'Remark Added',
        description: 'Remark added: Client promised to pay',
        user: 'Collector1',
        role: UserRole.NAVAL_USER,
        module: 'Client Modal'
      }
    ]
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the audit trail header and loan identity', () => {
    render(<HistoryModal loan={loan} onClose={onClose} />);

    expect(screen.getByText('Activity Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    expect(screen.getByText(/Client Code: C-001/i)).toBeInTheDocument();
  });

  it('displays history records, modules, and user information', () => {
    render(<HistoryModal loan={loan} onClose={onClose} />);

    expect(screen.getByText('Loan created')).toBeInTheDocument();
    expect(screen.getByText(/Payment of PHP 5,000.00 recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Remark added: Client promised to pay/i)).toBeInTheDocument();
    expect(screen.getByText(/Loan Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment Form/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Collector1/i).length).toBeGreaterThan(0);
  });

  it('sorts history by timestamp descending', () => {
    render(<HistoryModal loan={loan} onClose={onClose} />);

    const descriptions = screen.getAllByText(/Loan created|Payment of|Remark added/i);
    expect(descriptions[0].textContent).toMatch(/remark added/i);
  });

  it('calls onClose from header and footer controls', () => {
    render(<HistoryModal loan={loan} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText(/close history/i));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when no history exists', () => {
    render(<HistoryModal loan={{ ...loan, history: [] } as any} onClose={onClose} />);

    expect(screen.getByText(/no activity history recorded/i)).toBeInTheDocument();
  });
});
