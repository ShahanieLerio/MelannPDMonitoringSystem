import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
    it('should render when isOpen is true', () => {
        render(
            <ConfirmationModal
                isOpen={true}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <ConfirmationModal
                isOpen={false}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should call onConfirm when Yes button is clicked', () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmationModal
                isOpen={true}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />
        );

        const yesButton = screen.getByText('Yes');
        fireEvent.click(yesButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when No button is clicked', () => {
        const onCancel = vi.fn();
        render(
            <ConfirmationModal
                isOpen={true}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />
        );

        const noButton = screen.getByText('No');
        fireEvent.click(noButton);

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle Enter key press to confirm', () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmationModal
                isOpen={true}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />
        );

        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should handle Escape key press to cancel', () => {
        const onCancel = vi.fn();
        render(
            <ConfirmationModal
                isOpen={true}
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should display custom confirmText and cancelText', () => {
        render(
            <ConfirmationModal
                isOpen={true}
                title="Delete Item"
                message="This action cannot be undone"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
                confirmText="Delete"
                cancelText="Keep"
            />
        );

        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText('Keep')).toBeInTheDocument();
    });

    it('should apply danger variant styling', () => {
        render(
            <ConfirmationModal
                isOpen={true}
                title="Delete Item"
                message="This action cannot be undone"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
                variant="danger"
            />
        );

        const confirmButton = screen.getByText('Yes');
        expect(confirmButton.className).toContain('danger');
    });
});
