import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LoginPage from './LoginPage';
import { store } from '../services/dataStore';
import { UserRole, UserStatus, Branch } from '../types';

vi.mock('../services/dataStore', () => ({
  store: {
    authenticate: vi.fn(),
    registerUser: vi.fn(),
    refresh: vi.fn()
  }
}));

describe('LoginPage', () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (store.registerUser as any).mockResolvedValue({});
    (store.refresh as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const submitLogin = async (username = 'testuser') => {
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: username } });
    fireEvent.change(screen.getByPlaceholderText(/â€¢|•/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByText(/authorize access/i));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
  };

  it('renders the login form', () => {
    render(<LoginPage onLogin={onLogin} />);

    expect(screen.getByText(/past due and report monitoring/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByText(/authorize access/i)).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    const user = {
      id: '1',
      username: 'testuser',
      fullName: 'Test User',
      role: UserRole.COLLECTOR,
      status: UserStatus.ACTIVE,
      branch: Branch.NAVAL,
      createdAt: '2024-01-01',
      statusHistory: []
    };
    (store.authenticate as any).mockReturnValue({ user });

    render(<LoginPage onLogin={onLogin} />);
    await submitLogin();

    expect(store.authenticate).toHaveBeenCalledWith('testuser', 'password');
    expect(onLogin).toHaveBeenCalledWith(user);
  });

  it('shows authentication errors', async () => {
    (store.authenticate as any).mockReturnValue({ user: null, error: 'User not found' });

    render(<LoginPage onLogin={onLogin} />);
    await submitLogin('missing');

    expect(screen.getByText(/user not found/i)).toBeInTheDocument();
  });

  it('toggles into registration mode and back', () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    expect(screen.getByText(/account registration/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/juan dela cruz/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/back to login/i));
    expect(screen.getByText(/authorize access/i)).toBeInTheDocument();
  });

  it('submits a registration request', async () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByPlaceholderText(/â€¢|•/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByText(/submit registration/i));
    expect(screen.getByText(/are you sure the provided information is correct and you want to submit/i)).toBeInTheDocument();
    expect(store.registerUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/yes, submit registration/i));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(store.registerUser).toHaveBeenCalledWith({
      username: 'newuser',
      fullName: 'New User',
      password: 'password',
      role: UserRole.COLLECTOR,
      branch: Branch.NAVAL
    });
    expect(screen.getByText(/registration request sent/i)).toBeInTheDocument();
  });

  it('can select account role and assigned branch during registration', async () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'Ormoc User' } });
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'ormocuser' } });
    fireEvent.change(screen.getByPlaceholderText(/â€¢|•/i), { target: { value: 'password' } });
    const dropdowns = screen.getAllByRole('combobox');
    fireEvent.change(dropdowns[0], { target: { value: UserRole.SUPERVISOR } });
    fireEvent.change(dropdowns[1], { target: { value: Branch.ORMOC } });
    fireEvent.click(screen.getByText(/submit registration/i));
    fireEvent.click(screen.getByText(/yes, submit registration/i));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(store.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.SUPERVISOR, branch: Branch.ORMOC })
    );
  });

  it('keeps management roles scoped to the selected branch', async () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'President User' } });
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'president' } });
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'password' } });
    const dropdowns = screen.getAllByRole('combobox');
    fireEvent.change(dropdowns[0], { target: { value: UserRole.PRESIDENT } });
    fireEvent.change(dropdowns[1], { target: { value: Branch.ORMOC } });
    fireEvent.click(screen.getByText(/submit registration/i));
    expect(screen.getByText(/are you sure the provided information is correct and you want to submit/i)).toBeInTheDocument();
    expect(store.registerUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/yes, submit registration/i));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(store.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.PRESIDENT, branch: Branch.ORMOC })
    );
  });

  it('assigns all branches only to Super Admin accounts', async () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'Super Admin User' } });
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'superadmin' } });
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'password' } });
    const dropdowns = screen.getAllByRole('combobox');
    fireEvent.change(dropdowns[0], { target: { value: UserRole.SUPER_ADMIN } });
    fireEvent.change(dropdowns[1], { target: { value: Branch.NAVAL } });
    fireEvent.click(screen.getByText(/submit registration/i));
    fireEvent.click(screen.getByText(/yes, submit registration/i));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(store.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.SUPER_ADMIN, branch: Branch.ALL })
    );
  });

  it('does not submit registration when confirmation is cancelled', () => {
    render(<LoginPage onLogin={onLogin} />);

    fireEvent.click(screen.getByText(/request registration/i));
    fireEvent.change(screen.getByPlaceholderText(/juan dela cruz/i), { target: { value: 'Careful User' } });
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'carefuluser' } });
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'password' } });
    fireEvent.click(screen.getByText(/submit registration/i));
    fireEvent.click(screen.getByText(/review information/i));

    expect(store.registerUser).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure the provided information is correct and you want to submit/i)).not.toBeInTheDocument();
  });
});
