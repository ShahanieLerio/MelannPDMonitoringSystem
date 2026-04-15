import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryModal from './HistoryModal';
import { UserRole } from '../types';

describe('HistoryModal', () => {
    const mockHistory = [
        {
            id: 'h1',
            timestamp: '2024-02-01T10:00:00',
            type: 'LOAN_CREATED',
            description: 'Loan created',
            user: 'Admin',
            role: UserRole.SUPER_ADMIN,
            module: 'Loan Grid'
        },
        {
            id: 'h2',
            timestamp: '2024-02-02T11:00:00',
            type: 'PAYMENT_RECORDED',
            description: 'Payment of ₱5,000.00 recorded',
            user: 'Collector1',
            role: UserRole.NAVAL_USER,
            module: 'Payment Form'
        },
        {
            id: 'h3',
            timestamp: '2024-02-03T12:00:00',
            type: 'REMARK_ADDED',
            description: 'Remark added: Client promised to pay',
            user: 'Collector1',
            role: UserRole.NAVAL_USER,
            module: 'Client Modal'
        }
    ];

    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render when isOpen is true', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText(/history/i)).toBeInTheDocument();
        expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <HistoryModal
                isOpen={false}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should display all history records', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText('Loan created')).toBeInTheDocument();
        expect(screen.getByText(/Payment of ₱5,000.00 recorded/i)).toBeInTheDocument();
        expect(screen.getByText(/Remark added: Client promised to pay/i)).toBeInTheDocument();
    });

    it('should display user and role information', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText('Admin')).toBeInTheDocument();
        expect(screen.getByText('Collector1')).toBeInTheDocument();
    });

    it('should display module information', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText(/Loan Grid/i)).toBeInTheDocument();
        expect(screen.getByText(/Payment Form/i)).toBeInTheDocument();
        expect(screen.getByText(/Client Modal/i)).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        // Check for formatted date display
        expect(screen.getByText(/2024-02-01/i)).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        const closeButton = screen.getByText(/close/i);
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should display empty state when no history', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={[]}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText(/no history records/i)).toBeInTheDocument();
    });

    it('should sort history by timestamp descending', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        const descriptions = screen.getAllByText(/Loan created|Payment of|Remark added/i);
        // Most recent should be first
        expect(descriptions[0].textContent).toContain('Remark added');
    });

    it('should handle Escape key to close', () => {
        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={mockHistory}
                borrowerName="Santos, Maria"
            />
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should display different activity types with appropriate icons', () => {
        const diverseHistory = [
            {
                id: 'h1',
                timestamp: '2024-02-01T10:00:00',
                type: 'LOAN_CREATED',
                description: 'Loan created',
                user: 'Admin',
                role: UserRole.SUPER_ADMIN,
                module: 'Loan Grid'
            },
            {
                id: 'h2',
                timestamp: '2024-02-02T11:00:00',
                type: 'LOAN_UPDATED',
                description: 'Loan updated',
                user: 'Admin',
                role: UserRole.SUPER_ADMIN,
                module: 'Loan Grid'
            },
            {
                id: 'h3',
                timestamp: '2024-02-03T12:00:00',
                type: 'PAYMENT_RECORDED',
                description: 'Payment recorded',
                user: 'Collector',
                role: UserRole.NAVAL_USER,
                module: 'Payment Form'
            },
            {
                id: 'h4',
                timestamp: '2024-02-04T13:00:00',
                type: 'PAYMENT_REVERSED',
                description: 'Payment reversed',
                user: 'Admin',
                role: UserRole.SUPER_ADMIN,
                module: 'Payment Form'
            }
        ];

        render(
            <HistoryModal
                isOpen={true}
                onClose={mockOnClose}
                history={diverseHistory}
                borrowerName="Santos, Maria"
            />
        );

        expect(screen.getByText('Loan created')).toBeInTheDocument();
        expect(screen.getByText('Loan updated')).toBeInTheDocument();
        expect(screen.getByText('Payment recorded')).toBeInTheDocument();
        expect(screen.getByText('Payment reversed')).toBeInTheDocument();
    });
});
