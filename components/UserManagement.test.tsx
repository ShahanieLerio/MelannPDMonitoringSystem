import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserManagement from './UserManagement';
import { store } from '../services/dataStore';
import { UserRole, UserStatus, Branch } from '../types';

vi.mock('../services/dataStore', () => ({
    store: {
        getUsers: vi.fn(),
        updateUserStatus: vi.fn(),
        subscribe: vi.fn()
    }
}));

describe('UserManagement', () => {
    const mockCurrentUser = 'SuperAdmin';

    beforeEach(() => {
        vi.clearAllMocks();

        (store.getUsers as any).mockReturnValue([
            {
                id: 'u1',
                username: 'user1',
                fullName: 'User One',
                role: UserRole.NAVAL_USER,
                status: UserStatus.ACTIVE,
                branch: Branch.NAVAL,
                createdAt: '2024-01-01',
                createdBy: 'Admin',
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
                createdBy: 'Admin',
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
                createdBy: 'Admin',
                statusHistory: [
                    { status: UserStatus.PENDING, updatedAt: '2024-01-04', updatedBy: 'System' },
                    { status: UserStatus.ACTIVE, updatedAt: '2024-01-05', updatedBy: 'Admin' },
                    { status: UserStatus.DEACTIVATED, updatedAt: '2024-01-06', updatedBy: 'Admin' }
                ]
            }
        ]);

        (store.subscribe as any).mockImplementation((callback: () => void) => {
            return () => { };
        });
    });

    it('should render users list', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.getByText('User Two')).toBeInTheDocument();
        expect(screen.getByText('User Three')).toBeInTheDocument();
    });

    it('should display user details', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText(/NAVAL_USER/i)).toBeInTheDocument();
        expect(screen.getByText(/Naval Branch/i)).toBeInTheDocument();
    });

    it('should show different status badges', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.getByText('DEACTIVATED')).toBeInTheDocument();
    });

    it('should filter users by status', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const activeFilter = screen.getByText(/active/i);
        fireEvent.click(activeFilter);

        // Should only show active users
        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.queryByText('User Two')).not.toBeInTheDocument();
    });

    it('should activate a pending user', async () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const activateButtons = screen.getAllByText(/activate/i);
        fireEvent.click(activateButtons[0]);

        const confirmButton = screen.getByText(/yes/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(store.updateUserStatus).toHaveBeenCalledWith(
                'u2',
                UserStatus.ACTIVE,
                mockCurrentUser
            );
        });
    });

    it('should deactivate an active user', async () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const deactivateButtons = screen.getAllByText(/deactivate/i);
        fireEvent.click(deactivateButtons[0]);

        const confirmButton = screen.getByText(/yes/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(store.updateUserStatus).toHaveBeenCalledWith(
                'u1',
                UserStatus.DEACTIVATED,
                mockCurrentUser
            );
        });
    });

    it('should reactivate a deactivated user', async () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const reactivateButtons = screen.getAllByText(/reactivate/i);
        fireEvent.click(reactivateButtons[0]);

        const confirmButton = screen.getByText(/yes/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(store.updateUserStatus).toHaveBeenCalledWith(
                'u3',
                UserStatus.ACTIVE,
                mockCurrentUser
            );
        });
    });

    it('should show confirmation before status change', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const activateButtons = screen.getAllByText(/activate/i);
        fireEvent.click(activateButtons[0]);

        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should display status history', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const viewHistoryButtons = screen.getAllByText(/view history/i);
        fireEvent.click(viewHistoryButtons[0]);

        expect(screen.getByText(/status history/i)).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should search users by name or username', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'user1' } });

        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.queryByText('User Two')).not.toBeInTheDocument();
    });

    it('should filter users by role', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const roleFilter = screen.getByLabelText(/role/i);
        fireEvent.change(roleFilter, { target: { value: UserRole.NAVAL_USER } });

        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.queryByText('User Two')).not.toBeInTheDocument();
    });

    it('should filter users by branch', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const branchFilter = screen.getByLabelText(/branch/i);
        fireEvent.change(branchFilter, { target: { value: Branch.ORMOC } });

        expect(screen.getByText('User Two')).toBeInTheDocument();
        expect(screen.queryByText('User One')).not.toBeInTheDocument();
    });

    it('should subscribe to data updates', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        expect(store.subscribe).toHaveBeenCalled();
    });

    it('should display empty state when no users match filter', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });

    it('should show created by information', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        expect(screen.getAllByText(/created by: Admin/i).length).toBeGreaterThan(0);
    });

    it('should format dates correctly', () => {
        render(<UserManagement currentUser={mockCurrentUser} />);

        // Check for formatted date display
        expect(screen.getByText(/2024-01-01/i)).toBeInTheDocument();
    });
});
