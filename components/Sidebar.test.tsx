import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';
import { UserRole, Branch } from '../types';

describe('Sidebar', () => {
    const mockOnNavigate = vi.fn();
    const defaultProps = {
        currentView: 'dashboard' as const,
        onNavigate: mockOnNavigate,
        userRole: UserRole.SUPER_ADMIN,
        userBranch: Branch.NAVAL,
        onLogout: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all menu items for SUPER_ADMIN', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Loan Grid')).toBeInTheDocument();
        expect(screen.getByText('Collection Sheet')).toBeInTheDocument();
        expect(screen.getByText('Client Update')).toBeInTheDocument();
        expect(screen.getByText('Demand Letters')).toBeInTheDocument();
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByText('Collectors')).toBeInTheDocument();
        expect(screen.getByText('User Management')).toBeInTheDocument();
        expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    });

    it('should not show User Management for non-SUPER_ADMIN', () => {
        render(<Sidebar {...defaultProps} userRole={UserRole.NAVAL_USER} />);

        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('should highlight current view', () => {
        render(<Sidebar {...defaultProps} currentView="loanGrid" />);

        const loanGridButton = screen.getByText('Loan Grid').closest('button');
        expect(loanGridButton?.className).toContain('active');
    });

    it('should call onNavigate when menu item is clicked', () => {
        render(<Sidebar {...defaultProps} />);

        const loanGridButton = screen.getByText('Loan Grid');
        fireEvent.click(loanGridButton);

        expect(mockOnNavigate).toHaveBeenCalledWith('loanGrid');
    });

    it('should call onLogout when logout button is clicked', () => {
        const mockOnLogout = vi.fn();
        render(<Sidebar {...defaultProps} onLogout={mockOnLogout} />);

        const logoutButton = screen.getByText('Logout');
        fireEvent.click(logoutButton);

        expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('should display user role and branch', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText(/SUPER_ADMIN/i)).toBeInTheDocument();
        expect(screen.getByText(/Naval Branch/i)).toBeInTheDocument();
    });

    it('should render for ORMOC_USER', () => {
        render(
            <Sidebar
                {...defaultProps}
                userRole={UserRole.ORMOC_USER}
                userBranch={Branch.ORMOC}
            />
        );

        expect(screen.getByText(/ORMOC_USER/i)).toBeInTheDocument();
        expect(screen.getByText(/Ormoc Branch/i)).toBeInTheDocument();
    });
});
