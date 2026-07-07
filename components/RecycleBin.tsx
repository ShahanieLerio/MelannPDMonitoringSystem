import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { DeletedLoan, Branch, User } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface RecycleBinProps {
  currentUser: User;
  selectedBranch: Branch;
}

const RecycleBin: React.FC<RecycleBinProps> = ({ currentUser, selectedBranch }) => {
  const [deletedLoans, setDeletedLoans] = useState<DeletedLoan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'danger'
  });

  const refreshData = () => {
    setDeletedLoans(store.getDeletedLoans(selectedBranch));
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  const closeConfirm = () => setConfirmConfig({ ...confirmConfig, isOpen: false });
  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'danger') => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeConfirm();
      },
      type
    });
  };

  const handleRestore = (loan: DeletedLoan) => {
    askConfirm(
      "Restore Client",
      `Are you sure you want to restore ${loan.originalLoanData.borrowerName}? This will return them to the active client portfolio.`,
      async () => {
        setRestoringId(loan.id);
        setFeedback(null);
        try {
          await store.restoreLoan(loan.id, currentUser.username, currentUser.role);
          setFeedback({ type: 'success', message: `${loan.originalLoanData.borrowerName} has been restored.` });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Restore failed. Please try again.';
          setFeedback({ type: 'error', message });
        } finally {
          setRestoringId(null);
        }
      },
      'warning'
    );
  };

  const handlePermanentDelete = (loan: DeletedLoan) => {
    askConfirm(
      "Permanently Delete",
      `Are you absolutely sure? This will permanently delete ${loan.originalLoanData.borrowerName} and all associated data. This action cannot be undone.`,
      () => {
        store.permanentlyDeleteLoan(loan.id);
      },
      'danger'
    );
  };

  const filteredLoans = deletedLoans.filter(l => {
    const term = searchTerm.toLowerCase();
    return l.originalLoanData.borrowerName.toLowerCase().includes(term) ||
           l.originalLoanData.code.toLowerCase().includes(term) ||
           l.deletedBy.toLowerCase().includes(term);
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700/50 overflow-hidden flex flex-col h-[calc(100vh-140px)] w-[1600px] max-w-[95vw] mx-auto animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shrink-0 rounded-t-[2.5rem]">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <span className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl shadow-sm">
              ♻️
            </span>
            Recycle Bin
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 ml-16 font-medium">Manage and restore deleted client records</p>
        </div>

        <div className="flex gap-4">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder="Search deleted clients..."
              className="pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/20 w-80 text-slate-800 dark:text-white font-medium transition-all shadow-sm outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      {feedback && (
        <div className={`mx-8 mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/20 p-8">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Client Name</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Code</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Branch</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Deleted By</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Deleted At</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <span className="text-6xl mb-4 opacity-50">🗑️</span>
                        <p className="text-lg font-bold">Recycle Bin is Empty</p>
                        <p className="text-sm mt-1">No deleted clients found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-red-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-white">
                          {loan.originalLoanData.lastName}, {loan.originalLoanData.firstName}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-red-600 dark:text-red-400">
                        {loan.originalLoanData.code}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
                        {loan.branch}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {loan.deletedBy}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(loan.deletedAt))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleRestore(loan)}
                            disabled={restoringId === loan.id}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl transition-all disabled:cursor-wait disabled:opacity-40"
                            title={restoringId === loan.id ? 'Restoring Client' : 'Restore Client'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(loan)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-all"
                            title="Permanently Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmationModal {...confirmConfig} onCancel={closeConfirm} />
    </div>
  );
};

export default RecycleBin;
