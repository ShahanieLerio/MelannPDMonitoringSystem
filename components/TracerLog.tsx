import React, { useEffect, useState } from 'react';
import { store, TracerLog as TracerLogRecord, TracerUser } from '../services/dataStore.ts';

const PAGE_SIZE = 50;
const actions = ['LOGIN', 'LOGOUT', 'VIEW', 'ADD', 'EDIT', 'DELETE', 'RESTORE', 'REVERSE', 'IMPORT', 'SCAN'];
const actionStyle: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700', LOGOUT: 'bg-slate-100 text-slate-700',
  VIEW: 'bg-sky-100 text-sky-700', ADD: 'bg-teal-100 text-teal-700',
  EDIT: 'bg-amber-100 text-amber-700', DELETE: 'bg-rose-100 text-rose-700',
  RESTORE: 'bg-violet-100 text-violet-700', REVERSE: 'bg-orange-100 text-orange-700',
  IMPORT: 'bg-indigo-100 text-indigo-700', SCAN: 'bg-gray-100 text-gray-700'
};

const TracerLog: React.FC = () => {
  const [view, setView] = useState<'all' | 'by-user'>('all');
  const [users, setUsers] = useState<TracerUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userInput, setUserInput] = useState('');
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<TracerLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (view !== 'by-user') return;
    let active = true;
    setUsersLoading(true);
    setUsersError('');
    store.getTracerUsers()
      .then(result => {
        if (!active) return;
        setUsers(result);
        setSelectedUserId(current => result.some(person => person.id === current) ? current : (result[0]?.id || ''));
      })
      .catch(err => { if (active) setUsersError(err instanceof Error ? err.message : 'Unable to load users.'); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [view, revision]);

  useEffect(() => {
    if (view === 'by-user' && !selectedUserId) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    store.getTracerLogs({ user: view === 'all' ? user : undefined, userId: view === 'by-user' ? selectedUserId : undefined, action, module, from, to, offset: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then(result => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load tracer logs.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, selectedUserId, user, action, module, from, to, page, revision]);

  const applyUser = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(0);
    setUser(userInput.trim());
  };

  const selectView = (nextView: 'all' | 'by-user') => {
    setView(nextView);
    setPage(0);
  };

  return (
    <section className="space-y-5 max-w-[1500px] mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tracer Log</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">User sign-ins, sign-outs, module views, and saved account changes.</p>
          </div>
          <button type="button" onClick={() => setRevision(value => value + 1)} className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold">Refresh logs</button>
        </div>
        <div role="tablist" aria-label="Tracer Log view" className="mt-5 flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button type="button" role="tab" aria-selected={view === 'all'} onClick={() => selectView('all')} className={`px-4 py-2.5 text-sm font-bold border-b-2 ${view === 'all' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>All User View</button>
          <button type="button" role="tab" aria-selected={view === 'by-user'} onClick={() => selectView('by-user')} className={`px-4 py-2.5 text-sm font-bold border-b-2 ${view === 'by-user' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>By User View</button>
        </div>
        {view === 'by-user' && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Users with recorded activity</p>
            {usersError && <p role="alert" className="mb-2 text-sm text-rose-700">{usersError}</p>}
            {usersLoading && <p className="text-sm text-slate-500">Loading users…</p>}
            {!usersLoading && !usersError && users.length === 0 && <p className="text-sm text-slate-500">No users with recorded activity yet.</p>}
            {users.length > 0 && (
              <div role="tablist" aria-label="Users with tracer logs" className="flex gap-2 overflow-x-auto pb-2">
                {users.map(person => (
                  <button key={person.id} type="button" role="tab" aria-selected={selectedUserId === person.id} onClick={() => { setSelectedUserId(person.id); setPage(0); }} className={`shrink-0 rounded-xl border px-4 py-2 text-left text-sm ${selectedUserId === person.id ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
                    <span className="block font-bold">{person.username}</span><span className="block text-[10px] opacity-75">{person.branch}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {view === 'all' && <form onSubmit={applyUser} className="flex gap-2">
            <input aria-label="Search username" value={userInput} onChange={event => setUserInput(event.target.value)} placeholder="Search username" className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm" />
            <button className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white text-sm font-bold">Search</button>
          </form>}
          <select aria-label="Filter action" value={action} onChange={event => { setAction(event.target.value); setPage(0); }} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm">
            <option value="">All actions</option>
            {actions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <input aria-label="Filter module" value={module} onChange={event => { setModule(event.target.value); setPage(0); }} placeholder="Filter module" className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm" />
          <input aria-label="From date" title="From date (Philippine time)" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm" />
          <input aria-label="To date" title="To date (Philippine time)" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm" />
          <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">{total.toLocaleString()} matching events</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-sm overflow-hidden">
        {error && <p role="alert" className="p-4 text-rose-700 bg-rose-50">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <tr><th className="px-4 py-3">Date & time</th><th className="px-4 py-3">User</th><th className="px-4 py-3">PC</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Record / detail</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(row => (
                <tr key={row.id} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(row.occurred_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3"><div className="font-bold">{row.user_name}</div><div className="text-xs text-slate-400">{row.user_role.replaceAll('_', ' ')}</div></td>
                  <td className="px-4 py-3"><div className="font-bold">{row.pc_name || row.pc_id || 'Unknown PC'}</div><div className="text-xs text-slate-400">{[row.pc_id !== row.pc_name ? row.pc_id : null, row.ip_address].filter(Boolean).join(' · ')}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.branch}</td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-lg px-2 py-1 text-xs font-black ${actionStyle[row.action] || 'bg-slate-100 text-slate-700'}`}>{row.action}</span></td>
                  <td className="px-4 py-3 font-semibold">{row.module}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 break-all">{row.record_id ? `ID: ${row.record_id}` : row.detail || '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No tracer events found.</td></tr>}
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading tracer logs…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-500">
          <span>{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : '0 events'}</span>
          <div className="flex gap-2">
            <button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 dark:border-slate-700">Previous</button>
            <button disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(value => value + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 dark:border-slate-700">Next</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TracerLog;
