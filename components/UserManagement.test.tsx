import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserManagement from './UserManagement';
import { store } from '../services/dataStore';
import { UserRole, UserStatus, Branch, User } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    getUsers: vi.fn(),
    updateUserStatus: vi.fn()
  }
}));

describe('UserManagement', () => {
  const currentUser: User = {
    id: 'admin',
    username: 'SuperAdmin',
    fullName: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    branch: Branch.ALL,
    createdAt: '2024-01-01',
    statusHistory: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (store.getUsers as any).mockReturnValue([
      {
        id: '1',
        username: 'admin',
        fullName: 'System Admin',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        branch: Branch.ALL,
        createdAt: '2024-01-01',
        statusHistory: []
      },
      {
        id: 'u1',
        username: 'user1',
        fullName: 'User One',
        role: UserRole.NAVAL_USER,
        status: UserStatus.ACTIVE,
        branch: Branch.NAVAL,
        createdAt: '2024-01-02',
        statusHistory: [
          { status: UserStatus.PENDING, updatedAt: '2024-01-01', updatedBy: 'System' },
          { status: UserStatus.ACTIVE, updatedAt: '2024-01-02', updatedBy: 'Admin' }
        ]
      },
      {
        id: 'u2',
        username: 'user2',
        fullName: 'User Two',
        role: UserRole.ORMOC_USER,
        status: UserStatus.PENDING,
        branch: Branch.ORMOC,
        createdAt: '2024-01-03',
        statusHistory: [
          { status: UserStatus.PENDING, updatedAt: '2024-01-03', updatedBy: 'System' }
        ]
      },
      {
        id: 'u3',
        username: 'user3',
        fullName: 'User Three',
        role: UserRole.NAVAL_USER,
        status: UserStatus.DEACTIVATED,
        branch: Branch.NAVAL,
        createdAt: '2024-01-04',
        statusHistory: [
          { status: UserStatus.PENDING, updatedAt: '2024-01-04', updatedBy: 'System' },
          { status: UserStatus.ACTIVE, updatedAt: '2024-01-05', updatedBy: 'Admin' },
          { status: UserStatus.DEACTIVATED, updatedAt: '2024-01-06', updatedBy: 'Admin' }
        ]
      }
    ]);
  });

  it('renders current users and registration table headings', () => {
    render(<UserManagement currentUser={currentUser} />);

    expect(screen.getByText('Account Role Descriptions')).toBeInTheDocument();
    expect(screen.getByText('Collector')).toBeInTheDocument();
    expect(screen.getByText(/Can view only assigned clients/i)).toBeInTheDocument();
    expect(screen.getByText('System User Registrations')).toBeInTheDocument();
    expect(screen.getByText('System Identity')).toBeInTheDocument();
    expect(screen.getByText('Administrative Actions')).toBeInTheDocument();
    expect(screen.getAllByText('User One').length).toBeGreaterThan(0);
    expect(screen.getByText('User Two')).toBeInTheDocument();
    expect(screen.getAllByText('User Three').length).toBeGreaterThan(0);
  });

  it('displays role, branch, status, and created date information', () => {
    render(<UserManagement currentUser={currentUser} />);

    expect(screen.getAllByText('Naval Branch User').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Naval Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DEACTIVATED').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Created:/i).length).toBeGreaterThan(0);
  });

  it('protects the permanent system admin from status actions', () => {
    render(<UserManagement currentUser={currentUser} />);

    expect(screen.getByText('Permanent System Admin')).toBeInTheDocument();
  });

  it('approves a pending user after confirmation', async () => {
    render(<UserManagement currentUser={currentUser} />);

    fireEvent.click(screen.getByText('Approve'));
    expect(screen.getByRole('heading', { name: /activate account/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.updateUserStatus).toHaveBeenCalledWith('u2', UserStatus.ACTIVE, 'SuperAdmin');
    });
  });

  it('waits for approval to finish before refreshing the user list', async () => {
    let resolveUpdate: () => void = () => {};
    const pendingUser = {
      id: 'u2',
      username: 'user2',
      fullName: 'User Two',
      role: UserRole.ORMOC_USER,
      status: UserStatus.PENDING,
      branch: Branch.ORMOC,
      createdAt: '2024-01-03',
      statusHistory: [
        { status: UserStatus.PENDING, updatedAt: '2024-01-03', updatedBy: 'System' }
      ]
    };
    const activeUser = {
      ...pendingUser,
      status: UserStatus.ACTIVE,
      statusHistory: [
        ...pendingUser.statusHistory,
        { status: UserStatus.ACTIVE, updatedAt: '2024-01-04', updatedBy: 'SuperAdmin' }
      ]
    };

    (store.getUsers as any).mockReturnValue([pendingUser]);
    (store.updateUserStatus as any).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveUpdate = () => {
        (store.getUsers as any).mockReturnValue([activeUser]);
        resolve();
      };
    }));

    render(<UserManagement currentUser={currentUser} />);

    fireEvent.click(screen.getByText('Approve'));
    fireEvent.click(screen.getByText(/^yes$/i));

    expect(screen.getByText('PENDING')).toBeInTheDocument();

    resolveUpdate();

    await waitFor(() => {
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('deactivates an active user after confirmation', async () => {
    render(<UserManagement currentUser={currentUser} />);

    fireEvent.click(screen.getByText('Deactivate Account'));
    expect(screen.getByRole('heading', { name: /deactivate account/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.updateUserStatus).toHaveBeenCalledWith('u1', UserStatus.DEACTIVATED, 'SuperAdmin');
    });
  });

  it('reactivates a deactivated user after confirmation', async () => {
    render(<UserManagement currentUser={currentUser} />);

    fireEvent.click(screen.getByText('Reactivate Account'));
    expect(screen.getByRole('heading', { name: /activate account/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^yes$/i));

    await waitFor(() => {
      expect(store.updateUserStatus).toHaveBeenCalledWith('u3', UserStatus.ACTIVE, 'SuperAdmin');
    });
  });

  it('renders the mini audit view for users with status history', () => {
    render(<UserManagement currentUser={currentUser} />);

    expect(screen.getAllByText('LATEST STATUS LOGS').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/By Admin/i).length).toBeGreaterThan(0);
  });
});
