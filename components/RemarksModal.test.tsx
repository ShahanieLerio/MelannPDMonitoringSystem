import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RemarksModal from './RemarksModal';
import { PriorityLevel, UserRole } from '../types';

describe('RemarksModal', () => {
    const mockRemarks = [
        {
            id: 'r1',
            text: 'Client promised to pay next week',
            timestamp: '2024-02-01T10:00:00',
            collector: 'John Doe'
        },
        {
            id: 'r2',
            text: 'Client not home during visit',
            timestamp: '2024-02-02T11:00:00',
            collector: 'Jane Smith'
        }
    ];

    const mockOnClose = vi.fn();
    const mockOnAddRemark = vi.fn();
    const mockOnEditRemark = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render when isOpen is true', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        expect(screen.getByText(/remarks/i)).toBeInTheDocument();
        expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <RemarksModal
                isOpen={false}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should display all remarks', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        expect(screen.getByText('Client promised to pay next week')).toBeInTheDocument();
        expect(screen.getByText('Client not home during visit')).toBeInTheDocument();
    });

    it('should display collector names', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should add a new remark', async () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const textarea = screen.getByPlaceholderText(/enter remark/i);
        fireEvent.change(textarea, { target: { value: 'New remark text' } });

        const addButton = screen.getByText(/add remark/i);
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(mockOnAddRemark).toHaveBeenCalledWith(
                'New remark text',
                expect.any(String)
            );
        });
    });

    it('should select priority level', async () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const prioritySelect = screen.getByLabelText(/priority/i);
        fireEvent.change(prioritySelect, { target: { value: PriorityLevel.TOP } });

        const textarea = screen.getByPlaceholderText(/enter remark/i);
        fireEvent.change(textarea, { target: { value: 'Urgent remark' } });

        const addButton = screen.getByText(/add remark/i);
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(mockOnAddRemark).toHaveBeenCalledWith(
                'Urgent remark',
                PriorityLevel.TOP
            );
        });
    });

    it('should validate remark text before adding', async () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const addButton = screen.getByText(/add remark/i);
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(screen.getByText(/remark cannot be empty/i)).toBeInTheDocument();
        });

        expect(mockOnAddRemark).not.toHaveBeenCalled();
    });

    it('should clear textarea after adding remark', async () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const textarea = screen.getByPlaceholderText(/enter remark/i) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'New remark' } });

        const addButton = screen.getByText(/add remark/i);
        fireEvent.click(addButton);

        await waitFor(() => {
            expect(textarea.value).toBe('');
        });
    });

    it('should show edit button for remarks when onEditRemark is provided', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                onEditRemark={mockOnEditRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const editButtons = screen.getAllByText(/edit/i);
        expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should edit a remark', async () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                onEditRemark={mockOnEditRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const editButtons = screen.getAllByText(/edit/i);
        fireEvent.click(editButtons[0]);

        const textarea = screen.getByDisplayValue('Client promised to pay next week');
        fireEvent.change(textarea, { target: { value: 'Updated remark text' } });

        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockOnEditRemark).toHaveBeenCalledWith(
                'r1',
                'Updated remark text',
                expect.any(String)
            );
        });
    });

    it('should call onClose when close button is clicked', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const closeButton = screen.getByText(/close/i);
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should display empty state when no remarks', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={[]}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        expect(screen.getByText(/no remarks yet/i)).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        // Check for formatted date display
        expect(screen.getByText(/2024-02-01/i)).toBeInTheDocument();
    });

    it('should sort remarks by timestamp descending', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const remarkTexts = screen.getAllByText(/Client/i);
        // Most recent should be first
        expect(remarkTexts[0].textContent).toContain('Client not home');
    });

    it('should have all priority level options', () => {
        render(
            <RemarksModal
                isOpen={true}
                onClose={mockOnClose}
                remarks={mockRemarks}
                borrowerName="Santos, Maria"
                onAddRemark={mockOnAddRemark}
                currentCollector="John Doe"
                currentUser="Admin"
                currentRole={UserRole.SUPER_ADMIN}
            />
        );

        const prioritySelect = screen.getByLabelText(/priority/i);
        const options = prioritySelect.querySelectorAll('option');

        expect(options.length).toBeGreaterThanOrEqual(5);
    });
});
