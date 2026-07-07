import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/dataStore.ts';
import { MigrationAccount, MigrationBatch, User, Branch, Loan } from '../types.ts';
import ClientFormModal from './ClientFormModal.tsx';
import SecureDeleteModal from './SecureDeleteModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface MigrationCenterProps {
  currentUser: User;
  onMigrationChange?: (count: number) => void;
}

const formatDate = (value: string) => {
  if (!value) return 'N/A';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const getAccountKey = (account: MigrationAccount) =>
  String(account.sourceLoanId || account.loan?.id || account.sourceCode || account.loan?.code || '').trim();

const isZeroPaymentOrNmsrAccount = (account: MigrationAccount) =>
  account.payments.length === 0 || account.loan.status === 'NMSR';

const MigrationCenter: React.FC<MigrationCenterProps> = ({ currentUser, onMigrationChange }) => {
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [maturityFrom, setMaturityFrom] = useState('2016-01-01');
  const [maturityTo, setMaturityTo] = useState('2026-03-31');
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<{ code: string; borrowerName: string; balance: number } | null>(null);
  const [successPopup, setSuccessPopup] = useState<{ isOpen: boolean; name: string }>({ isOpen: false, name: '' });
  const [sortConfig, setSortConfig] = useState<{ key: 'borrowerName' | 'dueDate' | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [selectedAccountKeys, setSelectedAccountKeys] = useState<string[]>([]);

  const selectedBatch = useMemo(
    () => batches.find(batch => batch.id === selectedBatchId) || batches[0],
    [batches, selectedBatchId]
  );

  const accounts = selectedBatch?.payload?.accounts || [];
  const accountKeys = useMemo(() => accounts.map(getAccountKey).filter(Boolean), [accounts]);
  const selectedAccountKeySet = useMemo(() => new Set(selectedAccountKeys), [selectedAccountKeys]);
  const selectedAccounts = useMemo(
    () => accounts.filter(account => selectedAccountKeySet.has(getAccountKey(account))),
    [accounts, selectedAccountKeySet]
  );
  const zeroPaymentOrNmsrAccounts = useMemo(
    () => accounts.filter(isZeroPaymentOrNmsrAccount),
    [accounts]
  );
  
  const sortedAccounts = useMemo(() => {
    const sortableAccounts = [...accounts];
    if (sortConfig.key) {
      sortableAccounts.sort((a, b) => {
        let valA = a.loan[sortConfig.key!] || '';
        let valB = b.loan[sortConfig.key!] || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableAccounts;
  }, [accounts, sortConfig]);

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.loan.runningBalance || 0), 0);
  const totalPayments = accounts.reduce((sum, account) => sum + account.payments.reduce((pSum, payment) => pSum + Number(payment.amount || 0), 0), 0);
  const selectedBalance = selectedAccounts.reduce((sum, account) => sum + Number(account.loan.runningBalance || 0), 0);
  const selectedPayments = selectedAccounts.reduce((sum, account) => sum + account.payments.reduce((pSum, payment) => pSum + Number(payment.amount || 0), 0), 0);
  const selectedPaymentCount = selectedAccounts.reduce((sum, account) => sum + account.payments.length, 0);

  const publishBatches = (nextBatches: MigrationBatch[], preferredBatchId?: string) => {
    setBatches(nextBatches);
    onMigrationChange?.(nextBatches.reduce((sum, batch) => sum + batch.detectedCount, 0));
    if (preferredBatchId && nextBatches.some(batch => batch.id === preferredBatchId)) {
      setSelectedBatchId(preferredBatchId);
      return;
    }
    if (!selectedBatchId && nextBatches.length > 0) setSelectedBatchId(nextBatches[0].id);
  };

  const selectAccounts = (nextAccounts: MigrationAccount[]) => {
    setSelectedAccountKeys(nextAccounts.map(getAccountKey).filter(Boolean));
  };

  const toggleAccountSelection = (account: MigrationAccount) => {
    const key = getAccountKey(account);
    if (!key) return;
    setSelectedAccountKeys(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    );
  };

  const toggleAllAccounts = () => {
    setSelectedAccountKeys(current =>
      current.length === accountKeys.length ? [] : accountKeys
    );
  };

  const handleSort = (key: 'borrowerName' | 'dueDate') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const loadPending = async () => {
    setIsLoading(true);
    try {
      const pending = await store.getMigrationBatches();
      publishBatches(pending);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to load pending migrations.' });
    } finally {
      setIsLoading(false);
    }
  };

  const scanSource = async () => {
    if (!maturityFrom || !maturityTo || maturityFrom > maturityTo) {
      setMessage({ type: 'error', text: 'Please select a valid Maturity Date From and To date range.' });
      return;
    }

    setIsScanning(true);
    setMessage({ type: 'info', text: `Scanning read-only JCASH database for Maturity Date ${formatDate(maturityFrom)} to ${formatDate(maturityTo)}...` });
    try {
      const pending = await store.scanMigrationBatches(maturityFrom, maturityTo);
      const scannedBatchId = `jcash-${maturityFrom}-${maturityTo}`;
      const scannedBatch = pending.find(batch => batch.id === scannedBatchId);
      publishBatches(pending, scannedBatchId);
      setMessage({
        type: scannedBatch && scannedBatch.detectedCount > 0 ? 'success' : 'info',
        text: scannedBatch
          ? scannedBatch.detectedCount > 0
            ? `Migration-ready Maturity Date range detected: ${formatDate(maturityFrom)} to ${formatDate(maturityTo)} (${scannedBatch.detectedCount} accounts).`
            : `No migration-ready Good/NMSR accounts detected for Maturity Date ${formatDate(maturityFrom)} to ${formatDate(maturityTo)}.`
          : `Scan completed, but no batch was created for Maturity Date ${formatDate(maturityFrom)} to ${formatDate(maturityTo)}.`
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unable to scan jcashdb.mdb.' });
    } finally {
      setIsScanning(false);
    }
  };

  const migrateSelected = async () => {
    if (!selectedBatch) return;
    if (selectedAccountKeys.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one client to migrate.' });
      return;
    }
    setIsMigrating(true);
    setMessage({ type: 'info', text: `Migrating ${selectedAccountKeys.length} selected client${selectedAccountKeys.length === 1 ? '' : 's'} into the system database...` });
    try {
      const result = await store.migrateBatch(selectedBatch.id, currentUser.fullName || currentUser.username, selectedAccountKeys);
      const pending = await store.getMigrationBatches();
      publishBatches(pending);
      setSelectedBatchId(pending[0]?.id || '');
      setSelectedAccountKeys([]);
      setMessage({
        type: 'success',
        text: `Migration completed: ${result.importedCount || 0} selected accounts and ${result.paymentCount || 0} good payments synced. ${result.remainingCount || 0} accounts remain pending.`
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Migration failed.' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveAccount = async (updatedData: any) => {
    if (!selectedBatchId || !editingLoan) return;
    try {
      await store.updateMigrationBatchAccount(selectedBatchId, editingLoan.code, updatedData);
      await loadPending();
      setEditingLoan(null);
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  const handleDeleteAccount = (account: any) => {
    setDeletingAccount({
      code: account.loan.code,
      borrowerName: account.loan.borrowerName,
      balance: account.loan.runningBalance || 0
    });
  };

  const confirmDeleteAccount = async () => {
    if (!selectedBatchId || !deletingAccount) return;
    const deletedName = deletingAccount.borrowerName;
    
    try {
      await store.removeMigrationBatchAccount(selectedBatchId, deletingAccount.code, currentUser.username);
      await loadPending();
      setDeletingAccount(null);
      setSuccessPopup({ isOpen: true, name: deletedName });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to remove account.' });
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  useEffect(() => {
    setSelectedAccountKeys(current => current.filter(key => accountKeys.includes(key)));
  }, [accountKeys]);

  return (
    <div className="animate-fadeIn space-y-6 transition-colors duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 p-8 shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9"></path></svg>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">JCASH Cycle Migration</h2>
            </div>
            <p className="mt-2 text-sm font-medium text-emerald-100/70">
              Read-only scan from <code className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-300">\\SERVERPC\LendingV2Melan\db\jcashdb.mdb</code> by selected Maturity Date range.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-md border border-white/10 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Maturity Date From</span>
              <input
                type="date"
                value={maturityFrom}
                onChange={(event) => setMaturityFrom(event.target.value)}
                className="h-11 rounded-lg border border-transparent bg-white/95 px-3 text-sm font-bold text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 transition-all"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Maturity Date To</span>
              <input
                type="date"
                value={maturityTo}
                onChange={(event) => setMaturityTo(event.target.value)}
                className="h-11 rounded-lg border border-transparent bg-white/95 px-3 text-sm font-bold text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 transition-all"
              />
            </label>
            <button
              onClick={scanSource}
              disabled={isScanning || isMigrating}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-500 px-6 text-xs font-black uppercase tracking-widest text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isScanning ? (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                  Scanning...
                </div>
              ) : 'Scan Database'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300'
            : message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300'
              : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-900/20 dark:text-sky-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-emerald-200 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-emerald-500/50 flex items-center justify-between">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-50 transition-colors group-hover:bg-emerald-50 dark:bg-slate-700/50 dark:group-hover:bg-emerald-500/10"></div>
          <div className="relative z-10 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Batches</p>
            <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white leading-none">{batches.length}</p>
          </div>
          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-emerald-500/20 dark:group-hover:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-sky-200 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-sky-500/50 flex items-center justify-between">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-50 transition-colors group-hover:bg-sky-50 dark:bg-slate-700/50 dark:group-hover:bg-sky-500/10"></div>
          <div className="relative z-10 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detected Accounts</p>
            <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white leading-none">{accounts.length}</p>
          </div>
          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-sky-100 group-hover:text-sky-600 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-sky-500/20 dark:group-hover:text-sky-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-amber-200 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-amber-500/50 flex items-center justify-between">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-50 transition-colors group-hover:bg-amber-50 dark:bg-slate-700/50 dark:group-hover:bg-amber-500/10"></div>
          <div className="relative z-10 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Good Payments</p>
            <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white leading-none">{selectedBatch?.paymentCount || 0}</p>
          </div>
          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-amber-100 group-hover:text-amber-600 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-amber-500/20 dark:group-hover:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-indigo-200 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-indigo-500/50 flex items-center justify-between">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-50 transition-colors group-hover:bg-indigo-50 dark:bg-slate-700/50 dark:group-hover:bg-indigo-500/10"></div>
          <div className="relative z-10 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Running Balance</p>
            <p className="mt-0.5 text-xl font-black text-slate-900 dark:text-white leading-none">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Selected Cycle</span>
            <div className="relative">
              <select
                value={selectedBatch?.id || ''}
                onChange={(event) => setSelectedBatchId(event.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 shadow-sm outline-none transition-colors focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {batches.length === 0 && <option value="">No pending cycle</option>}
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {formatDate(batch.cycleStart)} to {formatDate(batch.cycleEnd)} ({batch.detectedCount} accounts)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              {selectedAccounts.length} selected
            </span>
            <button
              onClick={() => selectAccounts(zeroPaymentOrNmsrAccounts)}
              disabled={accounts.length === 0 || isMigrating || isScanning}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-100 px-3 text-[10px] font-black uppercase tracking-widest text-amber-800 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              title="Select clients with zero good payments or NMSR status"
            >
              Select 0 Pay/NMSR ({zeroPaymentOrNmsrAccounts.length})
            </button>
            <button
              onClick={toggleAllAccounts}
              disabled={accounts.length === 0 || isMigrating || isScanning}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              title={selectedAccounts.length === accounts.length ? 'Clear selected clients' : 'Select all clients in this cycle'}
            >
              {selectedAccounts.length === accounts.length ? 'Clear All' : 'Select All'}
            </button>
            <button
              onClick={() => setSelectedAccountKeys([])}
              disabled={selectedAccounts.length === 0 || isMigrating || isScanning}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
              title="Clear selected clients"
            >
              Clear
            </button>
          </div>
          <button
            onClick={migrateSelected}
            disabled={!selectedBatch || selectedAccounts.length === 0 || isMigrating || isScanning}
            className="group relative inline-flex h-11 items-center justify-center overflow-hidden rounded-xl bg-slate-900 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:shadow-emerald-900/20 dark:hover:bg-emerald-500"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isMigrating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                  Migrating Data...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                  Migrate Selected Clients
                </>
              )}
            </span>
            {!isMigrating && !isScanning && selectedBatch && (
              <div className="absolute inset-0 z-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            )}
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm font-bold text-slate-400">Loading pending migrations...</div>
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">No accounts ready for migration.</p>
          </div>
        ) : (
          <div className="overflow-hidden">
                <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[2.5%]" />
                <col className="w-[4%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[3.5%]" />
              </colgroup>
              <thead className="bg-slate-50/80 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/80 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-2 py-3 first:rounded-tl-2xl text-center">
                    <input
                      type="checkbox"
                      checked={accounts.length > 0 && selectedAccounts.length === accounts.length}
                      onChange={toggleAllAccounts}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      title="Select all clients in this cycle"
                    />
                  </th>
                  <th className="px-2 py-3">Code</th>
                  <th 
                    className="px-2 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group select-none"
                    onClick={() => handleSort('borrowerName')}
                  >
                    <div className="flex items-center gap-2">
                      Borrower
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md ${sortConfig.key === 'borrowerName' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                        {sortConfig.key === 'borrowerName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-2 py-3">Date Release</th>
                  <th 
                    className="px-2 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group select-none"
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center gap-2">
                      Due Date
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md ${sortConfig.key === 'dueDate' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                        {sortConfig.key === 'dueDate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-right">Principal</th>
                  <th className="px-2 py-3 text-right">Total Loan</th>
                  <th className="px-2 py-3">Collector</th>
                  <th className="px-2 py-3">Branch</th>
                  <th className="px-2 py-3">Address</th>
                  <th className="px-2 py-3">Contact No.</th>
                  <th className="px-2 py-3 text-right">Balance</th>
                  <th className="px-2 py-3 text-center">Status</th>
                  <th className="px-2 py-3 text-center">Good Pay</th>
                  <th className="px-2 py-3 text-center last:rounded-tr-2xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {sortedAccounts.map(account => {
                  const accountKey = getAccountKey(account);
                  const isSelected = selectedAccountKeySet.has(accountKey);

                  return (
                  <tr key={account.sourceLoanId} className={`group transition-all duration-200 ${isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'hover:bg-emerald-50/40 dark:hover:bg-slate-700/30'}`}>
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAccountSelection(account)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        title={`Select ${account.loan.borrowerName}`}
                      />
                    </td>
                    <td className="px-2 py-3 text-xs font-black text-slate-700 dark:text-slate-200 relative truncate">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-emerald-500 transition-colors"></div>
                      {account.loan.code}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100" title={account.loan.borrowerName}>{account.loan.borrowerName}</span>
                        {account.isEdited && (
                          <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-amber-100 px-1.5 text-[9px] font-black uppercase tracking-wider text-amber-700 shadow-sm dark:bg-amber-900/40 dark:text-amber-400" title="Manually Edited">
                            Edited
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">{account.loan.dateRelease ? formatDate(account.loan.dateRelease) : <span className="text-slate-300 dark:text-slate-600 italic">-</span>}</td>
                    <td className="px-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">{formatDate(account.loan.dueDate)}</td>
                    <td className="px-2 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400">{account.loan.principal ? formatCurrency(account.loan.principal) : <span className="text-slate-300 dark:text-slate-600 italic">-</span>}</td>
                    <td className="px-2 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400">{account.loan.totalLoan ? formatCurrency(account.loan.totalLoan) : <span className="text-slate-300 dark:text-slate-600 italic">-</span>}</td>
                    <td className="px-2 py-3">
                      <span className="inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={account.loan.collector}>{account.loan.collector}</span>
                    </td>
                    <td className="px-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 truncate" title={account.loan.branch}>{account.loan.branch}</td>
                    <td className="px-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 truncate" title={account.loan.fullAddress || ''}>{account.loan.fullAddress && account.loan.fullAddress !== 'N/A' ? account.loan.fullAddress : <span className="text-slate-300 dark:text-slate-600 italic">-</span>}</td>
                    <td className="px-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 truncate" title={account.loan.contactNumber || ''}>{account.loan.contactNumber && account.loan.contactNumber !== 'N/A' ? account.loan.contactNumber : <span className="text-slate-300 dark:text-slate-600 italic">-</span>}</td>
                    <td className="px-2 py-3 text-right text-xs font-black text-slate-800 dark:text-white">{formatCurrency(account.loan.runningBalance)}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-xs font-black ${
                        account.loan.status === 'NMSR'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : account.loan.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}>
                        {account.loan.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{account.payments.length}</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingLoan(account.loan as Loan)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-400"
                          title="Edit Client Information"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/50 dark:hover:text-rose-400"
                          title="Exclude Client from Migration"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 backdrop-blur-md dark:bg-slate-900/80 sticky bottom-0 z-20">
                <tr>
                  <td colSpan={11} className="px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400 first:rounded-bl-2xl">Selected Total ({selectedAccounts.length} accounts)</td>
                  <td className="px-5 py-4 text-right text-sm font-black text-slate-900 dark:text-white">{formatCurrency(selectedBalance)}</td>
                  <td></td>
                  <td className="px-5 py-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{selectedPayments.toLocaleString()} amount / {selectedPaymentCount} payments</span>
                  </td>
                  <td className="last:rounded-br-2xl"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {editingLoan && (
        <ClientFormModal
          loan={editingLoan}
          currentUser={currentUser}
          selectedBranch={Branch.ALL}
          onClose={() => setEditingLoan(null)}
          onSave={handleSaveAccount}
        />
      )}

      <SecureDeleteModal
        isOpen={!!deletingAccount}
        clientName={deletingAccount?.borrowerName || ''}
        clientCode={deletingAccount?.code || ''}
        outstandingBalance={deletingAccount?.balance || 0}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeletingAccount(null)}
      />

      <ConfirmationModal
        isOpen={successPopup.isOpen}
        title="Successfully Deleted"
        message={`${successPopup.name} has been excluded from migration and moved to the Recycle Bin.`}
        onConfirm={() => setSuccessPopup({ isOpen: false, name: '' })}
        onCancel={() => setSuccessPopup({ isOpen: false, name: '' })}
        type="success"
        confirmLabel="OK (Enter)"
        cancelLabel=""
      />
    </div>
  );
};

export default MigrationCenter;
