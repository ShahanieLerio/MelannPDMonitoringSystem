
import React, { useState, useEffect, useCallback } from 'react';
import { store } from '../services/dataStore';
import { Branch } from '../types';

interface DailyCollectionReportProps {
  selectedBranch: Branch;
}

const DailyCollectionReport: React.FC<DailyCollectionReportProps> = ({ selectedBranch }) => {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState(store.getDailyCollections(today, today, selectedBranch));
  const [filterCollector, setFilterCollector] = useState('');
  const [filterArea, setFilterArea] = useState('');

  const refresh = useCallback(() => {
    setData(store.getDailyCollections(fromDate, toDate, selectedBranch));
  }, [fromDate, toDate, selectedBranch]);

  useEffect(() => {
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => unsubscribe();
  }, [refresh]);

  // Derived filtered transaction list
  const filteredTransactions = data.transactions.filter(t => {
    const matchCollector = filterCollector ? t.collector.toLowerCase().includes(filterCollector.toLowerCase()) : true;
    const matchArea = filterArea ? t.area.toLowerCase().includes(filterArea.toLowerCase()) : true;
    return matchCollector && matchArea;
  });

  // Unique collector list for filter dropdown
  const collectorOptions = [...new Set(data.transactions.map(t => t.collector))].sort();
  const areaOptions = [...new Set(data.transactions.map(t => t.area))].sort();

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-6 items-center justify-between transition-colors duration-300">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Daily Collection Report</h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">
            Branch: <span className="text-emerald-600 dark:text-emerald-400">{selectedBranch}</span>
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">From Date</label>
            <input
              type="date"
              max={toDate || today}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-sm text-slate-700 dark:text-slate-300 transition-colors duration-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">To Date</label>
            <input
              type="date"
              min={fromDate}
              max={today}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-sm text-slate-700 dark:text-slate-300 transition-colors duration-300"
            />
          </div>
        </div>
      </div>

      {/* Grand Total Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-emerald-600 dark:bg-emerald-900/40 p-8 rounded-3xl shadow-xl shadow-emerald-900/20 dark:shadow-emerald-900/50 text-white flex items-center gap-6 transition-colors duration-300">
          <div className="bg-white/20 dark:bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
            <span className="text-3xl">💰</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 dark:text-emerald-200/70 mb-1 transition-colors duration-300">Grand Total Collected</p>
            <p className="text-3xl font-black transition-colors duration-300">{formatCurrency(data.grandTotal)}</p>
            <p className="text-[10px] text-emerald-200 dark:text-emerald-400/70 mt-1 font-bold transition-colors duration-300">
              {fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} – ${formatDate(toDate)}`}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-6 transition-colors duration-300">
          <div className="bg-slate-100 dark:bg-slate-700/50 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
            <span className="text-3xl">📋</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 transition-colors duration-300">Total Accounts Collected</p>
            <p className="text-3xl font-black text-slate-800 dark:text-white transition-colors duration-300">{data.grandTotalAccounts}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold transition-colors duration-300">transactions recorded</p>
          </div>
        </div>
      </div>

      {/* Collector Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 transition-colors duration-300">
          <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Summary by Collector</h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors duration-300">Grouped totals per collector</p>
        </div>
        <div className="overflow-x-auto">
          {data.collectorSummary.length > 0 ? (
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                <tr>
                  <th className="px-8 py-4">Collector Name</th>
                  <th className="px-8 py-4 text-center">Accounts Collected</th>
                  <th className="px-8 py-4 text-right">Amount Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors duration-300">
                {data.collectorSummary.map((row, i) => (
                  <tr key={row.collector} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-lg text-[9px] font-black flex items-center justify-center transition-colors duration-300 ${i === 0 ? 'bg-emerald-600 text-white group-hover:bg-emerald-700' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/40 group-hover:text-emerald-800 dark:group-hover:text-emerald-400'}`}>{i + 1}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight transition-all duration-300 group-hover:font-black group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:underline decoration-emerald-500/30 underline-offset-4">{row.collector}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center font-bold text-slate-600 dark:text-slate-400 transition-colors duration-300">{row.totalAccounts}</td>
                    <td className="px-8 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 transition-colors duration-300">{formatCurrency(row.totalAmount)}</td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700 transition-colors duration-300">
                  <td className="px-8 py-4 font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[11px] transition-colors duration-300">Grand Total</td>
                  <td className="px-8 py-4 text-center font-black text-slate-800 dark:text-white transition-colors duration-300">{data.grandTotalAccounts}</td>
                  <td className="px-8 py-4 text-right font-black text-emerald-700 dark:text-emerald-400 text-lg transition-colors duration-300">{formatCurrency(data.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 italic text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300">
              No collections recorded for the selected date range.
            </div>
          )}
        </div>
      </div>

      {/* Detailed Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap gap-4 items-center justify-between transition-colors duration-300">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Transaction Audit Log</h3>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors duration-300">All individual payments for selected date</p>
          </div>
          <div className="flex gap-3">
            {/* Collector filter */}
            <select
              value={filterCollector}
              onChange={e => setFilterCollector(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-300"
            >
              <option value="">All Collectors</option>
              {collectorOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Area filter */}
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-300"
            >
              <option value="">All Areas</option>
              {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredTransactions.length > 0 ? (
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                <tr>
                  <th className="px-8 py-4">#</th>
                  <th className="px-8 py-4">Borrower Name</th>
                  <th className="px-8 py-4">Collector</th>
                  <th className="px-8 py-4">Area</th>
                  <th className="px-8 py-4">OR Number</th>
                  <th className="px-8 py-4 text-right">Amount Collected</th>
                  <th className="px-8 py-4 text-center">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium transition-colors duration-300">
                {filteredTransactions.map((t, i) => (
                  <tr key={`${t.orNumber}-${i}`} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300">
                    <td className="px-8 py-4 text-slate-400 dark:text-slate-500 font-black text-[10px] transition-colors duration-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">{i + 1}</td>
                    <td className="px-8 py-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight text-sm transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-black group-hover:underline decoration-emerald-500/30 underline-offset-4">{t.borrowerName}</span>
                    </td>
                    <td className="px-8 py-4 text-slate-600 dark:text-slate-400 font-bold text-sm transition-colors duration-300">{t.collector}</td>
                    <td className="px-8 py-4">
                      <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-wider transition-colors duration-300">{t.area}</span>
                    </td>
                    <td className="px-8 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs transition-colors duration-300">{t.orNumber}</td>
                    <td className="px-8 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 transition-colors duration-300">{formatCurrency(t.amount)}</td>
                    <td className="px-8 py-4 text-center text-slate-500 dark:text-slate-400 font-bold text-xs transition-colors duration-300">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 italic text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300">
              {data.transactions.length > 0 ? 'No matches for applied filters.' : 'No transactions in the selected date range.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyCollectionReport;
