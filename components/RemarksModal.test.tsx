import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RemarksModal from './RemarksModal';
import { Branch, MovingStatus, LocationStatus, PriorityLevel, UserRole, UserStatus } from '../types';
import { store } from '../services/dataStore';
import { analyzeRemarkPriority } from '../services/geminiService';

vi.mock('../services/dataStore', () => ({
  store: {
    addRemark: vi.fn(),
    updateRemark: vi.fn(),
    updateLoan: vi.fn()
  }
}));

vi.mock('../services/geminiService', () => ({
  analyzeRemarkPriority: vi.fn()
}));

describe('RemarksModal', () => {
  const onClose = vi.fn();
  const currentUser = {
    id: 'u1',
    username: 'Admin',
    fullName: 'Admin User',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    branch: Branch.ALL,
    createdAt: '2024-01-01',
    statusHistory: []
  };

  const loan = {
    id: 'l1',
    code: 'C-001',
    borrowerName: 'Santos, Maria',
    branch: Branch.NAVAL,
    movingStatus: MovingStatus.MOVING,
    locationStatus: LocationStatus.LOCATED,
    aiPriority: PriorityLevel.LOWEST,
    remarks: [
      {
        id: 'r1',
        text: 'Client promised to pay next week',
        timestamp: '2024-02-01T10:00:00',
        collector: 'John Doe',
        priority: PriorityLevel.FOLLOW_UP
      },
      {
        id: 'r2',
        text: 'Client not home during visit',
        timestamp: '2024-02-02T11:00:00',
        collector: 'Jane Smith',
        priority: PriorityLevel.LOWEST
      },
      {
        id: 'r3',
        text: 'Older field note',
        timestamp: '2024-01-31T09:00:00',
        collector: 'Admin',
        priority: PriorityLevel.LOWEST
      }
    ],
    history: []
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (analyzeRemarkPriority as any).mockResolvedValue(PriorityLevel.FOLLOW_UP);
  });

  it('renders field intelligence for a loan', () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    expect(screen.getByText('Field Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    expect(screen.getByText(/Pulse:/i)).toBeInTheDocument();
  });

  it('shows recent remarks newest first', () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    const recentTexts = screen.getAllByText(/Client /i);
    expect(recentTexts[0].textContent).toContain('Client not home');
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText(/more entries below/i)).toBeInTheDocument();
  });

  it('adds a new field intelligence remark', async () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/describe field findings/i), {
      target: { value: 'New remark text' }
    });
    fireEvent.click(screen.getByText(/log field intel/i));

    await waitFor(() => {
      expect(store.addRemark).toHaveBeenCalledWith(
        'l1',
        'New remark text',
        'Admin',
        PriorityLevel.FOLLOW_UP,
        'Admin',
        UserRole.SUPER_ADMIN,
        null,
        null
      );
    });
  });

  it('edits an existing remark', async () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('button')[1]);
    fireEvent.change(screen.getByDisplayValue('Older field note'), {
      target: { value: 'Updated remark text' }
    });
    fireEvent.click(screen.getByText(/update intelligence/i));

    await waitFor(() => {
      expect(store.updateRemark).toHaveBeenCalledWith(
        'l1',
        'r3',
        'Updated remark text',
        PriorityLevel.FOLLOW_UP,
        'Admin',
        UserRole.SUPER_ADMIN,
        null,
        null
      );
    });
  });

  it('saves promise-to-pay and follow-up dates with a remark', async () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    const dateInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    fireEvent.change(screen.getByPlaceholderText(/describe field findings/i), {
      target: { value: 'Will pay on schedule' }
    });
    fireEvent.change(dateInputs[1], { target: { value: '2024-03-01' } });
    fireEvent.change(dateInputs[2], { target: { value: '2024-03-05' } });
    fireEvent.click(screen.getByText(/log field intel/i));

    await waitFor(() => {
      expect(store.addRemark).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '2024-03-01',
        '2024-03-05'
      );
    });
  });

  it('closes when the header close button is clicked', () => {
    render(<RemarksModal loan={loan} currentUser={currentUser} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty activity copy when no remarks exist', () => {
    render(<RemarksModal loan={{ ...loan, remarks: [] } as any} currentUser={currentUser} onClose={onClose} />);

    expect(screen.getByText(/no field activity yet/i)).toBeInTheDocument();
  });
});
