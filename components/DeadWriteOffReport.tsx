import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Branch } from '../types.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';

interface DeadWriteOffReportProps {
  selectedBranch: Branch;
}

const DeadWriteOffReport: React.FC<DeadWriteOffReportProps> = ({ selectedBranch }) => {
  const [deadLoans, setDeadLoans] = useState(() => store.getDeadWriteOffs(selectedBranch));
  const [allCollectors, setAllCollectors] = useState(() => store.getCollectors(Branch.ALL));

  useEffect(() => {
    const refreshData = () => {
      setDeadLoans(store.getDeadWriteOffs(selectedBranch));
      setAllCollectors(store.getCollectors(Branch.ALL));
    };
    
    refreshData();
    const unsubscribe = store.subscribe(refreshData);
    return () => unsubscribe();
  }, [selectedBranch]);

  // Sort by highest outstanding balance
  const sortedLoans = [...deadLoans].sort((a, b) => (b.totalLoan != null && b.totalLoan > 0 ? b.totalLoan : b.outstandingBalance) - (a.totalLoan != null && a.totalLoan > 0 ? a.totalLoan : a.outstandingBalance));

  const totalAmount = sortedLoans.reduce((sum, l) => sum + (l.totalLoan != null && l.totalLoan > 0 ? l.totalLoan : l.outstandingBalance), 0);

  return (
    <div className="space-y-6 animate-fadeIn transition-colors duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-slate-500/20 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/50 shadow-inner border border-slate-700/50">
                <span className="text-2xl drop-shadow-md">🪦</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">Deceased Clients</h2>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-300/80">
              Accounts marked as fully paid due to death. These are excluded from collection performance.
            </p>
          </div>
          <div className="flex flex-row items-center gap-6 rounded-xl bg-white/10 p-4 backdrop-blur-md border border-white/10 shadow-inner">
            <div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total Accounts</div>
              <div className="text-2xl font-black text-white">{sortedLoans.length}</div>
            </div>
            <div className="w-px h-10 bg-white/20"></div>
            <div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total Amount</div>
              <div className="text-2xl font-black text-white">₱{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50/80 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/80 sticky top-0 z-20 shadow-sm border-b border-slate-200 dark:border-slate-700/50">
              <tr>
                <th className="px-6 py-4 first:rounded-tl-2xl">Borrower Name</th>
                <th className="px-6 py-4">Collector</th>
                <th className="px-6 py-4">Reported Date</th>
                <th className="px-6 py-4">Date Fully Paid</th>
                <th className="px-6 py-4 text-right">Outstanding Balance</th>
                <th className="px-6 py-4 last:rounded-tr-2xl">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sortedLoans.map(loan => {
                const collectorName = getCollectorDisplayName(loan.collector, allCollectors);
                let latestRemark = 'No remarks';
                
                // Find if the dead remark was in field intel
                const deadIntel = loan.remarks.find(r => /\bdead\b/i.test(r.text));
                // Find if the dead remark was in payments
                const deadPayment = loan.payments?.find(p => p.remarks && /\bdead\b/i.test(p.remarks));

                if (deadIntel) {
                  latestRemark = deadIntel.text;
                } else if (deadPayment && deadPayment.remarks) {
                  latestRemark = `[Payment] ${deadPayment.remarks}`;
                } else if (loan.remarks.length > 0) {
                  latestRemark = loan.remarks[loan.remarks.length - 1].text;
                }
                
                // Determine Date Fully Paid
                let rawDate = loan.lastPaidDate;
                if (deadPayment) {
                  rawDate = deadPayment.date;
                } else if (deadIntel) {
                  rawDate = deadIntel.timestamp;
                } else if (!rawDate && loan.payments?.length > 0) {
                  rawDate = loan.payments[loan.payments.length - 1].date;
                }
                
                const dateFullyPaid = rawDate 
                  ? new Date(rawDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
                  : 'N/A';
                
                return (
                  <tr key={loan.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
                    <td className="px-6 py-4 align-middle relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-slate-400 transition-colors"></div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {loan.borrowerName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Code: {loan.code}</div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {collectorName}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle text-sm font-bold text-slate-500 dark:text-slate-400">
                      {loan.monthReported}
                    </td>
                    <td className="px-6 py-4 align-middle text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {dateFullyPaid}
                    </td>
                    <td className="px-6 py-4 text-right align-middle">
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        ₱{(loan.totalLoan != null && loan.totalLoan > 0 ? loan.totalLoan : loan.outstandingBalance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="max-w-xs truncate text-sm font-medium text-slate-500 dark:text-slate-400" title={latestRemark}>
                        {latestRemark}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No dead write-off clients found for this branch.
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

export default DeadWriteOffReport;
