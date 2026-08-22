import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Collectors from './Collectors';
import { store } from '../services/dataStore';
import { Branch } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getCollectors: vi.fn(),
    addCollector: vi.fn(),
    updateCollector: vi.fn(),
    deleteCollector: vi.fn(),
    getSupervisors: vi.fn(),
    addSupervisor: vi.fn(),
    updateSupervisor: vi.fn(),
    deleteSupervisor: vi.fn(),
    subscribe: vi.fn()
  }
}));

describe('Collectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (store.getCollectors as any).mockReturnValue([
      {
        id: 'c1',
        name: 'John Doe',
        nickname: 'JOHN',
        address: '123 Main St',
        assignedSupervisor: 'Supervisor A',
        branch: Branch.NAVAL
      },
      {
        id: 'c2',
        name: 'Jane Smith',
        nickname: 'JANE',
        address: '456 Oak Ave',
        branch: Branch.ORMOC
      }
    ]);

    (store.getSupervisors as any).mockReturnValue([
      {
        id: 's1',
        name: 'Supervisor A',
        nickname: 'SUP-A',
        branch: Branch.NAVAL,
        notes: 'Naval team lead'
      }
    ]);

    (store.subscribe as any).mockReturnValue(() => {});
  });

  it('renders personnel records for the selected branch view', () => {
    render(<Collectors selectedBranch={Branch.ALL} />);

    expect(screen.getByText('Personnel Management')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('@JOHN')).toBeInTheDocument();
    expect(screen.getByText('Supervisor A')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(store.getCollectors).toHaveBeenCalledWith(Branch.ALL);
  });

  it('subscribes to store updates', () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    expect(store.subscribe).toHaveBeenCalled();
  });

  it('adds a new personnel record', async () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getByText(/add personnel/i));
    fireEvent.change(screen.getByPlaceholderText(/john doe/i), { target: { value: 'New Collector' } });
    fireEvent.change(screen.getByPlaceholderText(/aldie/i), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/or type supervisor name/i), { target: { value: 'Supervisor B' } });
    fireEvent.change(screen.getByPlaceholderText(/specified branch/i), { target: { value: '789 Pine St' } });
    fireEvent.click(screen.getByText(/verify & save/i));

    await waitFor(() => {
      expect(store.addCollector).toHaveBeenCalledWith(
        'New Collector',
        Branch.NAVAL,
        '789 Pine St',
        'NEW',
        '',
        'Supervisor B'
      );
    });
  });

  it('updates an existing personnel record', async () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getAllByRole('button')[3]);
    fireEvent.change(screen.getByDisplayValue('John Doe'), { target: { value: 'John Updated' } });
    fireEvent.click(screen.getByText(/verify & save/i));

    await waitFor(() => {
      expect(store.updateCollector).toHaveBeenCalledWith(
        'c1',
        'John Updated',
        Branch.NAVAL,
        '123 Main St',
        'JOHN',
        '',
        'Supervisor A'
      );
    });
  });

  it('confirms before deleting a personnel record', async () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    fireEvent.click(screen.getAllByRole('button')[4]);
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.deleteCollector).toHaveBeenCalledWith('c1');
    });
  });

  it('uses NAVAL as the fallback branch when adding from all branches', async () => {
    render(<Collectors selectedBranch={Branch.ALL} />);

    fireEvent.click(screen.getByText(/add personnel/i));
    fireEvent.change(screen.getByPlaceholderText(/john doe/i), { target: { value: 'All Branch Entry' } });
    fireEvent.click(screen.getByText(/verify & save/i));

    await waitFor(() => {
      expect(store.addCollector).toHaveBeenCalledWith('All Branch Entry', Branch.NAVAL, '', '', '', '');
    });
  });

  it('shows an empty state when there are no personnel records', () => {
    (store.getCollectors as any).mockReturnValue([]);

    render(<Collectors selectedBranch={Branch.NAVAL} />);

    expect(screen.getByText(/no field personnel records/i)).toBeInTheDocument();
  });

  it('switches to Supervisor tab and renders supervisors', () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    // Click on the Supervisor tab button
    fireEvent.click(screen.getByRole('button', { name: /supervisor/i }));

    expect(screen.getByText('Supervisor A')).toBeInTheDocument();
    expect(screen.getByText('@SUP-A')).toBeInTheDocument();
    expect(screen.getByText('Naval team lead')).toBeInTheDocument();
    expect(screen.getByText(/1 collector\(s\)/i)).toBeInTheDocument();
  });

  it('adds a new supervisor in the Supervisor tab', async () => {
    render(<Collectors selectedBranch={Branch.NAVAL} />);

    // Switch to Supervisor tab
    fireEvent.click(screen.getByRole('button', { name: /supervisor/i }));
    fireEvent.click(screen.getByText(/add supervisor/i));

    fireEvent.change(screen.getByPlaceholderText(/supervisor jane doe/i), { target: { value: 'Supervisor Jane' } });
    fireEvent.change(screen.getByPlaceholderText(/sup-jane/i), { target: { value: 'JANE' } });
    fireEvent.change(screen.getByPlaceholderText(/in-charge of naval/i), { target: { value: 'Senior Supervisor' } });
    fireEvent.click(screen.getByText(/verify & save/i));

    await waitFor(() => {
      expect(store.addSupervisor).toHaveBeenCalledWith(
        'Supervisor Jane',
        Branch.NAVAL,
        'JANE',
        '',
        'Senior Supervisor'
      );
    });
  });
});
