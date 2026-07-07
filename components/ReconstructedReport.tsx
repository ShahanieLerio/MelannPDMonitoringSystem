import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/dataStore.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';
import { isReconstructedPaymentRemark } from '../services/loanUtils.ts';
import { Branch, Loan, Payment, PaymentStatus } from '../types.ts';

interface ReconstructedReportProps {
  selectedBranch: Branch;
}

interface ReconstructedEntry {
  id: string;
  collector: string;
  clientName: string;
  code: string;
  dueDate: string;
  amount: number;
  dateReconstructed: string;
  postedBy: string;
  remarks: string;
  loan: Loan;
  payment: Payment;
}

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const dateOnly = value.substring(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateOnly || 'N/A';
  return parsed.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

const ReconstructedReport: React.FC<ReconstructedReportProps> = ({ selectedBranch }) => {
  const [loans, setLoans] = useState(() => store.getLoans(selectedBranch));
  const [collectors, setCollectors] = useState(() => store.getCollectors(Branch.ALL));
  const [collectorFilter, setCollectorFilter] = useState('ALL');

  useEffect(() => {
    const refreshData = () => {
      setLoans(store.getLoans(selectedBranch));
      setCollectors(store.getCollectors(Branch.ALL));
    };

    refreshData();
    const unsubscribe = store.subscribe(refreshData);
    return () => unsubscribe();
  }, [selectedBranch]);

  useEffect(() => {
    setCollectorFilter('ALL');
  }, [selectedBranch]);

  const reconstructedEntries = useMemo<ReconstructedEntry[]>(() => {
    const entries: ReconstructedEntry[] = [];

    loans.forEach(loan => {
      const collector = getCollectorDisplayName(loan.collector, collectors);

      (loan.payments || []).forEach(payment => {
        if (payment.status === PaymentStatus.REVERSED) return;
        if (!isReconstructedPaymentRemark(payment.remarks)) return;

        entries.push({
          id: `${loan.id}-${payment.id}`,
          collector,
          clientName: loan.borrowerName,
          code: loan.code,
          dueDate: (loan.dueDate || '').substring(0, 10),
          amount: Number(payment.amount || 0),
          dateReconstructed: (payment.date || payment.createdAt || '').substring(0, 10),
          postedBy: payment.recorder || 'Unknown',
          remarks: payment.remarks || '',
          loan,
          payment
        });
      });
    });

    return entries.sort((a, b) =>
      b.dateReconstructed.localeCompare(a.dateReconstructed) ||
      a.collector.localeCompare(b.collector) ||
      a.clientName.localeCompare(b.clientName)
    );
  }, [loans, collectors]);

  const collectorOptions = useMemo(() => {
    return Array.from(new Set(reconstructedEntries.map(entry => entry.collector)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [reconstructedEntries]);

  const filteredEntries = useMemo(() => {
    if (collectorFilter === 'ALL') return reconstructedEntries;
    return reconstructedEntries.filter(entry => entry.collector === collectorFilter);
  }, [collectorFilter, reconstructedEntries]);

  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalCollectors = new Set(filteredEntries.map(entry => entry.collector)).size;

  const handleExport = () => {
    const headers = [
      'Collector',
      'Clients Name',
      'Code',
      'Due Date',
      'Amount Reconstructed',
      'Date Reconstructed',
      'Posted By',
      'Remarks'
    ];

    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = filteredEntries.map(entry => [
      entry.collector,
      entry.clientName,
      entry.code,
      entry.dueDate,
      entry.amount,
      entry.dateReconstructed,
      entry.postedBy,
      entry.remarks
    ].map(escapeCsv).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reconstructed_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">
              Reports Module
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Reconstructed
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Clients with posted collection remarks tagged as Recon or Reconstruct.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Collector
              </span>
              <select
                value={collectorFilter}
                onChange={(event) => setCollectorFilter(event.target.value)}
                className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-black uppercase tracking-wider text-slate-700 outline-none transition-colors focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All Collectors</option>
                {collectorOptions.map(collector => (
                  <option key={collector} value={collector}>{collector}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredEntries.length === 0}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recon Accounts</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{filteredEntries.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Amount Reconstructed</p>
          <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">&#8369;{totalAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Collectors</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{totalCollectors}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Collector</th>
                <th className="px-5 py-4">Clients Name</th>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Due Date</th>
                <th className="px-5 py-4 text-right">Amount Reconstructed</th>
                <th className="px-5 py-4">Date Reconstructed</th>
                <th className="px-5 py-4">User Account</th>
                <th className="px-5 py-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-4 align-middle">
                    <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {entry.collector || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{entry.clientName}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{entry.loan.barangay}, {entry.loan.city}</p>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm font-bold text-slate-600 dark:text-slate-300">{entry.code}</td>
                  <td className="px-5 py-4 align-middle text-sm font-bold text-slate-600 dark:text-slate-300">{formatDate(entry.dueDate)}</td>
                  <td className="px-5 py-4 align-middle text-right text-sm font-black text-emerald-700 dark:text-emerald-300">
                    &#8369;{entry.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 align-middle text-sm font-bold text-slate-600 dark:text-slate-300">{formatDate(entry.dateReconstructed)}</td>
                  <td className="px-5 py-4 align-middle text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{entry.postedBy}</td>
                  <td className="px-5 py-4 align-middle">
                    <div className="max-w-[260px] truncate text-sm font-semibold text-slate-500 dark:text-slate-400" title={entry.remarks}>
                      {entry.remarks}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      No reconstructed clients found.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Post a payment with Collection Remarks containing Recon or Reconstruct to show it here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReconstructedReport;
