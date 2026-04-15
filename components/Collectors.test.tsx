import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Collectors from './Collectors';
import { store } from '../services/dataStore';
import { UserRole, Branch } from '../types';

vi.mock('../services/dataStore', () => ({
    store: {
        getCollectors: vi.fn(),
        addCollector: vi.fn(),
        updateCollector: vi.fn(),
        deleteCollector: vi.fn(),
        subscribe: vi.fn()
    }
}));

describe('Collectors', () => {
    const defaultProps = {
        userRole: UserRole.SUPER_ADMIN,
        userBranch: Branch.NAVAL
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (store.getCollectors as any).mockReturnValue([
            {
                id: 'c1',
                name: 'John Doe',
                nickname: 'JOHN',
                address: '123 Main St',
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

        (store.subscribe as any).mockImplementation((callback: () => void) => {
            return () => { };
        });
    });

    it('should render collectors list', () => {
        render(<Collectors {...defaultProps} />);

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display collector details', () => {
        render(<Collectors {...defaultProps} />);

        expect(screen.getByText('JOHN')).toBeInTheDocument();
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText(/Naval Branch/i)).toBeInTheDocument();
    });

    it('should open add collector modal', () => {
        render(<Collectors {...defaultProps} />);

        const addButton = screen.getByText(/add collector/i);
        fireEvent.click(addButton);

        expect(screen.getByText(/new collector/i)).toBeInTheDocument();
    });

    it('should add a new collector', async () => {
        render(<Collectors {...defaultProps} />);

        const addButton = screen.getByText(/add collector/i);
        fireEvent.click(addButton);

        const nameInput = screen.getByPlaceholderText(/collector name/i);
        const nicknameInput = screen.getByPlaceholderText(/nickname/i);
        const addressInput = screen.getByPlaceholderText(/address/i);

        fireEvent.change(nameInput, { target: { value: 'New Collector' } });
        fireEvent.change(nicknameInput, { target: { value: 'NEW' } });
        fireEvent.change(addressInput, { target: { value: '789 Pine St' } });

        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(store.addCollector).toHaveBeenCalledWith(
                'New Collector',
                expect.any(String),
                '789 Pine St',
                'NEW'
            );
        });
    });

    it('should open edit collector modal', () => {
        render(<Collectors {...defaultProps} />);

        const editButtons = screen.getAllByText(/edit/i);
        fireEvent.click(editButtons[0]);

        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    it('should update a collector', async () => {
        render(<Collectors {...defaultProps} />);

        const editButtons = screen.getAllByText(/edit/i);
        fireEvent.click(editButtons[0]);

        const nameInput = screen.getByDisplayValue('John Doe');
        fireEvent.change(nameInput, { target: { value: 'John Updated' } });

        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(store.updateCollector).toHaveBeenCalledWith(
                'c1',
                'John Updated',
                expect.any(String),
                expect.any(String),
                expect.any(String)
            );
        });
    });

    it('should show confirmation before deleting', () => {
        render(<Collectors {...defaultProps} />);

        const deleteButtons = screen.getAllByText(/delete/i);
        fireEvent.click(deleteButtons[0]);

        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should delete a collector after confirmation', async () => {
        render(<Collectors {...defaultProps} />);

        const deleteButtons = screen.getAllByText(/delete/i);
        fireEvent.click(deleteButtons[0]);

        const confirmButton = screen.getByText(/yes/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(store.deleteCollector).toHaveBeenCalledWith('c1');
        });
    });

    it('should filter collectors by branch for branch users', () => {
        render(<Collectors {...defaultProps} userRole={UserRole.NAVAL_USER} />);

        expect(store.getCollectors).toHaveBeenCalledWith(Branch.NAVAL);
    });

    it('should show all collectors for SUPER_ADMIN', () => {
        render(<Collectors {...defaultProps} />);

        expect(store.getCollectors).toHaveBeenCalledWith(undefined);
    });

    it('should validate required fields', async () => {
        render(<Collectors {...defaultProps} />);

        const addButton = screen.getByText(/add collector/i);
        fireEvent.click(addButton);

        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        });
    });

    it('should close modal on cancel', () => {
        render(<Collectors {...defaultProps} />);

        const addButton = screen.getByText(/add collector/i);
        fireEvent.click(addButton);

        const cancelButton = screen.getByText(/cancel/i);
        fireEvent.click(cancelButton);

        expect(screen.queryByText(/new collector/i)).not.toBeInTheDocument();
    });

    it('should display empty state when no collectors', () => {
        (store.getCollectors as any).mockReturnValue([]);

        render(<Collectors {...defaultProps} />);

        expect(screen.getByText(/no collectors found/i)).toBeInTheDocument();
    });

    it('should subscribe to data updates', () => {
        render(<Collectors {...defaultProps} />);

        expect(store.subscribe).toHaveBeenCalled();
    });
});
