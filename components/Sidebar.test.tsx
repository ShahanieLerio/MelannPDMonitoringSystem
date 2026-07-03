import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';
import { UserRole, Branch } from '../types';

vi.mock('../hooks/useClientUpdates', () => ({
  useClientUpdates: () => ({
    loans: [],
    topPriorityList: [],
    reminderList: [],
    closeMonitoringList: [],
    filteredMainList: []
  })
}));

describe('Sidebar', () => {
  const setIsOpen = vi.fn();
  const setActiveTab = vi.fn();
  const onLogout = vi.fn();

  const defaultProps = {
    isOpen: true,
    setIsOpen,
    activeTab: 'dashboard',
    setActiveTab,
    role: UserRole.SUPER_ADMIN,
    onLogout,
    username: 'SuperAdmin',
    selectedBranch: Branch.ALL
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders available menu items for SUPER_ADMIN', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Loan Grid')).toBeInTheDocument();
    expect(screen.getByText('Collection Sheet')).toBeInTheDocument();
    expect(screen.getByText('Client Update')).toBeInTheDocument();
    expect(screen.getByText('Demand Letters')).toBeInTheDocument();
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
    expect(screen.getByText('Collectors')).toBeInTheDocument();
    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
  });

  it('does not show Manage Users for branch users', () => {
    render(<Sidebar {...defaultProps} role={UserRole.NAVAL_USER} />);

    expect(screen.queryByText('Manage Users')).not.toBeInTheDocument();
  });

  it('shows data maintenance modules for IT/Accounting Clerk without backup access', () => {
    render(<Sidebar {...defaultProps} role={UserRole.IT_ACCOUNTING_CLERK} />);

    expect(screen.getByText('Collectors')).toBeInTheDocument();
    expect(screen.getByText('JCASH Migration')).toBeInTheDocument();
    expect(screen.getByText('Recycle Bin')).toBeInTheDocument();
    expect(screen.queryByText('Backup & Restore')).not.toBeInTheDocument();
  });

  it('shows Payments only for Super Admin, IT/Accounting Clerk, and Branch Manager', () => {
    const allowedRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.IT_ACCOUNTING_CLERK,
      UserRole.BRANCH_MANAGER
    ];

    const deniedRoles = [
      UserRole.CASHIER,
      UserRole.SUPERVISOR,
      UserRole.COLLECTOR,
      UserRole.OPERATIONS_MANAGER,
      UserRole.EXECUTIVE_VICE_PRESIDENT,
      UserRole.PRESIDENT,
      UserRole.NAVAL_USER,
      UserRole.ORMOC_USER
    ];

    allowedRoles.forEach(role => {
      const { unmount } = render(<Sidebar {...defaultProps} role={role} />);
      expect(screen.getByText('Payments')).toBeInTheDocument();
      unmount();
    });

    deniedRoles.forEach(role => {
      const { unmount } = render(<Sidebar {...defaultProps} role={role} />);
      expect(screen.queryByText('Payments')).not.toBeInTheDocument();
      unmount();
    });
  });

  it('shows pending account count on Manage Users', () => {
    render(<Sidebar {...defaultProps} pendingUserCount={3} />);

    expect(screen.getByText('Manage Users')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('highlights the active menu item', () => {
    render(<Sidebar {...defaultProps} activeTab="loans" />);

    const loanGridButton = screen.getByText('Loan Grid').closest('button');
    expect(loanGridButton?.className).toContain('bg-white/18');
  });

  it('navigates when a menu item is clicked', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Collection Sheet'));

    expect(setActiveTab).toHaveBeenCalledWith('collection-sheet');
  });

  it('expands and navigates parent menus with subitems', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Loan Grid'));

    expect(setActiveTab).toHaveBeenCalledWith('loans');
    expect(screen.getByText('Import Client')).toBeInTheDocument();
    expect(screen.getByText('Add Client')).toBeInTheDocument();
  });

  it('calls onLogout when logout is clicked and confirmed', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Logout'));
    fireEvent.click(screen.getByText('Yes, Log Out'));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows the authenticated username', () => {
    render(<Sidebar {...defaultProps} username="Admin User" />);

    expect(screen.getByText('Authenticated')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('collapses text labels when closed and opens on menu click', () => {
    render(<Sidebar {...defaultProps} isOpen={false} />);

    fireEvent.click(screen.getByTitle('Dashboard'));

    expect(setIsOpen).toHaveBeenCalledWith(true);
    expect(setActiveTab).toHaveBeenCalledWith('dashboard');
  });
});
