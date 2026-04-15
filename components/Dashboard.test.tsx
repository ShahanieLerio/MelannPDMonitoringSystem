import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { store } from '../services/dataStore';
import { UserRole, Branch, MovingStatus, LocationStatus } from '../types';

vi.mock('../services/dataStore', () => ({
    store: {
        getStats: vi.fn(),
        getRecentPayments: vi.fn(),
        subscribe: vi.fn(),
        getLoans: vi.fn()
    }
}));

describe('Dashboard', () => {
    const defaultProps = {
        userRole: UserRole.SUPER_ADMIN,
        userBranch: Branch.NAVAL
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock default stats
        (store.getStats as any).mockReturnValue({
            totalAccounts: 100,
            totalReported: 1000000,
            totalCollected: 500000,
            totalRunningBalance: 500000,
            collectionRate: 50,
            paidCount: 25,
            movingCount: 50,
            nmCount: 15,
            nmsrCount: 10
        });

        (store.getRecentPayments as any).mockReturnValue([
            {
                id: 'p1',
                loanId: 'l1',
                date: '2024-02-01',
                orNumber: 'OR-001',
                amount: 5000,
                balanceAfter: 5000,
                recorder: 'Admin',
                status: 'GOOD'
            }
        ]);

        (store.getLoans as any).mockReturnValue([]);
        (store.subscribe as any).mockImplementation((callback: () => void) => {
            return () => { };
        });
    });

    it('should render dashboard statistics', () => {
        render(<Dashboard {...defaultProps} />);

        expect(screen.getByText(/total accounts/i)).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText(/collection rate/i)).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should display formatted currency values', () => {
        render(<Dashboard {...defaultProps} />);

        // Check for formatted amounts (₱1,000,000.00)
        expect(screen.getByText(/₱1,000,000.00/i)).toBeInTheDocument();
        expect(screen.getByText(/₱500,000.00/i)).toBeInTheDocument();
    });

    it('should show recent payments', () => {
        render(<Dashboard {...defaultProps} />);

        expect(screen.getByText(/recent payments/i)).toBeInTheDocument();
        expect(screen.getByText('OR-001')).toBeInTheDocument();
        expect(screen.getByText(/₱5,000.00/i)).toBeInTheDocument();
    });

    it('should display status distribution', () => {
        render(<Dashboard {...defaultProps} />);

        expect(screen.getByText(/status distribution/i)).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument(); // Paid count
        expect(screen.getByText('50')).toBeInTheDocument(); // Moving count
    });

    it('should filter data by branch for branch users', () => {
        render(<Dashboard {...defaultProps} userRole={UserRole.NAVAL_USER} />);

        expect(store.getStats).toHaveBeenCalledWith(Branch.NAVAL);
        expect(store.getRecentPayments).toHaveBeenCalledWith(Branch.NAVAL, 5);
    });

    it('should show all branches data for SUPER_ADMIN', () => {
        render(<Dashboard {...defaultProps} />);

        expect(store.getStats).toHaveBeenCalledWith(undefined);
        expect(store.getRecentPayments).toHaveBeenCalledWith(undefined, 5);
    });

    it('should subscribe to data updates', () => {
        render(<Dashboard {...defaultProps} />);

        expect(store.subscribe).toHaveBeenCalled();
    });

    it('should handle zero collection rate', () => {
        (store.getStats as any).mockReturnValue({
            totalAccounts: 100,
            totalReported: 1000000,
            totalCollected: 0,
            totalRunningBalance: 1000000,
            collectionRate: 0,
            paidCount: 0,
            movingCount: 50,
            nmCount: 30,
            nmsrCount: 20
        });

        render(<Dashboard {...defaultProps} />);

        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should display empty state when no recent payments', () => {
        (store.getRecentPayments as any).mockReturnValue([]);

        render(<Dashboard {...defaultProps} />);

        expect(screen.getByText(/no recent payments/i)).toBeInTheDocument();
    });
});
