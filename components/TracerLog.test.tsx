import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TracerLog from './TracerLog';

const { getTracerLogs, getTracerUsers } = vi.hoisted(() => ({ getTracerLogs: vi.fn(), getTracerUsers: vi.fn() }));
vi.mock('../services/dataStore.ts', () => ({ store: { getTracerLogs, getTracerUsers } }));

describe('Tracer Log', () => {
  it('loads events and applies user and action filters', async () => {
    getTracerLogs.mockResolvedValue({
      rows: [{ id: 1, occurred_at: '2026-10-16T01:00:00Z', user_name: 'admin', user_role: 'SUPER_ADMIN', branch: 'All Branches', action: 'LOGIN', module: 'Account', detail: '', record_id: null, ip_address: '192.168.1.12', pc_id: 'PC-TEST', pc_name: 'Ormoc Cashier PC' }],
      total: 1
    });

    render(<TracerLog />);
    expect(await screen.findByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Ormoc Cashier PC')).toBeInTheDocument();
    expect(screen.getByText('PC-TEST · 192.168.1.12')).toBeInTheDocument();
    expect(getTracerLogs).toHaveBeenCalledWith({ user: '', userId: undefined, action: '', module: '', from: '', to: '', offset: 0, limit: 50 });

    fireEvent.change(screen.getByLabelText('Search username'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Filter action'), { target: { value: 'LOGIN' } });
    await waitFor(() => expect(getTracerLogs).toHaveBeenLastCalledWith({ user: 'admin', userId: undefined, action: 'LOGIN', module: '', from: '', to: '', offset: 0, limit: 50 }));
  });

  it('shows one tab per user with recorded activity and filters by exact user ID', async () => {
    getTracerUsers.mockResolvedValue([
      { id: '1', username: 'admin', role: 'SUPER_ADMIN', branch: 'All Branches', last_activity: '2026-10-16T01:00:00Z' },
      { id: '2', username: 'Cyril', role: 'IT_ACCOUNTING_CLERK', branch: 'Ormoc Branch', last_activity: '2026-10-16T00:00:00Z' }
    ]);
    getTracerLogs.mockResolvedValue({ rows: [], total: 0 });

    render(<TracerLog />);
    fireEvent.click(screen.getByRole('tab', { name: 'By User View' }));
    expect(await screen.findByRole('tab', { name: /Cyril/ })).toBeInTheDocument();
    await waitFor(() => expect(getTracerLogs).toHaveBeenLastCalledWith(expect.objectContaining({ user: undefined, userId: '1' })));

    fireEvent.click(screen.getByRole('tab', { name: /Cyril/ }));
    await waitFor(() => expect(getTracerLogs).toHaveBeenLastCalledWith(expect.objectContaining({ user: undefined, userId: '2' })));
  });
});
