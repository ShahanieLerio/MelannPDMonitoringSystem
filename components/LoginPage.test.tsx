import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { store } from '../services/dataStore';
import { UserRole, UserStatus, Branch } from '../types';

vi.mock('../services/dataStore', () => ({
    store: {
        authenticate: vi.fn(),
        registerUser: vi.fn()
    }
}));

describe('LoginPage', () => {
    const mockOnLogin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render login form', () => {
        render(<LoginPage onLogin={mockOnLogin} />);

        expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    it('should handle successful login', async () => {
        const mockUser = {
            id: '1',
            username: 'testuser',
            fullName: 'Test User',
            role: UserRole.NAVAL_USER,
            status: UserStatus.ACTIVE,
            branch: Branch.NAVAL,
            createdAt: '2024-01-01',
            statusHistory: []
        };

        (store.authenticate as any).mockReturnValue({ user: mockUser });

        render(<LoginPage onLogin={mockOnLogin} />);

        const usernameInput = screen.getByPlaceholderText(/username/i);
        fireEvent.change(usernameInput, { target: { value: 'testuser' } });

        const signInButton = screen.getByText(/sign in/i);
        fireEvent.click(signInButton);

        await waitFor(() => {
            expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
        });
    });

    it('should show error for invalid username', async () => {
        (store.authenticate as any).mockReturnValue({
            user: null,
            error: 'User not found'
        });

        render(<LoginPage onLogin={mockOnLogin} />);

        const usernameInput = screen.getByPlaceholderText(/username/i);
        fireEvent.change(usernameInput, { target: { value: 'invaliduser' } });

        const signInButton = screen.getByText(/sign in/i);
        fireEvent.click(signInButton);

        await waitFor(() => {
            expect(screen.getByText(/User not found/i)).toBeInTheDocument();
        });
    });

    it('should show error for empty username', async () => {
        render(<LoginPage onLogin={mockOnLogin} />);

        const signInButton = screen.getByText(/sign in/i);
        fireEvent.click(signInButton);

        await waitFor(() => {
            expect(screen.getByText(/please enter your username/i)).toBeInTheDocument();
        });
    });

    it('should toggle between login and register modes', () => {
        render(<LoginPage onLogin={mockOnLogin} />);

        const registerLink = screen.getByText(/create account/i);
        fireEvent.click(registerLink);

        expect(screen.getByText(/register/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    });

    it('should handle user registration', async () => {
        const mockUser = {
            id: '1',
            username: 'newuser',
            fullName: 'New User',
            role: UserRole.NAVAL_USER,
            status: UserStatus.PENDING,
            branch: Branch.NAVAL,
            createdAt: '2024-01-01',
            statusHistory: []
        };

        (store.registerUser as any).mockReturnValue(mockUser);

        render(<LoginPage onLogin={mockOnLogin} />);

        // Switch to register mode
        const registerLink = screen.getByText(/create account/i);
        fireEvent.click(registerLink);

        // Fill in registration form
        const usernameInput = screen.getByPlaceholderText(/username/i);
        const fullNameInput = screen.getByPlaceholderText(/full name/i);

        fireEvent.change(usernameInput, { target: { value: 'newuser' } });
        fireEvent.change(fullNameInput, { target: { value: 'New User' } });

        const registerButton = screen.getByText(/register/i);
        fireEvent.click(registerButton);

        await waitFor(() => {
            expect(store.registerUser).toHaveBeenCalled();
        });
    });

    it('should validate registration form fields', async () => {
        render(<LoginPage onLogin={mockOnLogin} />);

        // Switch to register mode
        const registerLink = screen.getByText(/create account/i);
        fireEvent.click(registerLink);

        const registerButton = screen.getByText(/register/i);
        fireEvent.click(registerButton);

        await waitFor(() => {
            expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
        });
    });

    it('should switch back to login from register', () => {
        render(<LoginPage onLogin={mockOnLogin} />);

        // Switch to register
        const registerLink = screen.getByText(/create account/i);
        fireEvent.click(registerLink);

        // Switch back to login
        const loginLink = screen.getByText(/back to login/i);
        fireEvent.click(loginLink);

        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
});
