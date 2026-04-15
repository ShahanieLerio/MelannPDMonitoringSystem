
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, Collector, User, Branch } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface CollectionSheetProps {
  currentUser: User;
  selectedBranch: Branch;
}

const CollectionSheet: React.FC<CollectionSheetProps> = ({ currentUser, selectedBranch }) => {
  const [selectedCollector, setSelectedCollector] = useState<Collector | null>(null);
  const [loans, setLoans] = useState(store.getLoans(selectedBranch));
  const [collectors, setCollectors] = useState(store.getCollectors(selectedBranch));

  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    try {
      const [year, month, day] = dateString.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch(e) { return dateString; }
  };

  const [payments, setPayments] = useState<Record<string, string>>({});
  const [expense, setExpense] = useState<string>('0');
  const [success, setSuccess] = useState('');

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'warning') => {
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

  useEffect(() => {
    const refreshData = () => {
      setLoans(store.getLoans(selectedBranch));
      setCollectors(store.getCollectors(selectedBranch));
    };

    refreshData();

    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  const collectorLoans = useMemo(() => {
    if (!selectedCollector) return [];
    let list = loans.filter(l => l.collector === (selectedCollector.nickname || selectedCollector.name));
    if (filterFromDate) list = list.filter(l => l.dueDate >= filterFromDate);
    if (filterToDate) list = list.filter(l => l.dueDate <= filterToDate);
    return list;
  }, [selectedCollector, loans, filterFromDate, filterToDate]);

  const groupedLoans = useMemo(() => {
    return collectorLoans.reduce((acc, loan) => {
      if (!acc[loan.city]) acc[loan.city] = {};
      if (!acc[loan.city][loan.barangay]) acc[loan.city][loan.barangay] = [];
      acc[loan.city][loan.barangay].push(loan);
      return acc;
    }, {} as Record<string, Record<string, Loan[]>>);
  }, [collectorLoans]);

  const totalCollected = useMemo(() => {
    return (Object.values(payments) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0);
  }, [payments]);

  const totalExpenseValue = parseFloat(expense) || 0;
  const grandTotalValue = totalCollected - totalExpenseValue;

  const handlePostAll = () => {
    const paymentList = (Object.entries(payments) as [string, string][]).filter(([_, val]) => (parseFloat(val) || 0) > 0);
    if (paymentList.length === 0) return;

    askConfirm(
      "Confirm Batch Posting",
      `Are you sure you want to post ${paymentList.length} payments for ${selectedCollector?.name}? This will affect multiple client portfolios.`,
      () => {
        paymentList.forEach(([loanId, val]) => {
          const amount = parseFloat(val);
          store.recordPayment(
            loanId,
            amount,
            new Date().toISOString().split('T')[0],
            'Batch post via Collection Sheet',
            currentUser.username,
            currentUser.role,
            `BATCH-${Date.now().toString().slice(-4)}`
          );
        });

        setSuccess(`Successfully posted ${paymentList.length} collections!`);
        setPayments({});
        setLoans(store.getLoans(selectedBranch));
        setTimeout(() => setSuccess(''), 5000);
      },
      'info'
    );
  };

  // ── Scoped print styles: injected on mount, removed on unmount ──────────────
  // Applies ONLY when Collection Sheet is active. No other module is affected.
  useEffect(() => {
    const styleId = 'collection-sheet-print-styles';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove(); // Always recreate so content is fresh

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media print {
        /* ── 1. Long Bond paper setup (8.5 × 13 inches) ───────── */
        @page {
          size: 8.5in 13in;
          margin: 12mm 10mm 15mm 10mm;

          /* Suppress browser auto-generated date/time, URL, title headers */
          @top-left   { content: '' !important; }
          @top-center { content: '' !important; }
          @top-right  { content: '' !important; }
          @bottom-left  { content: '' !important; }
          @bottom-right { content: '' !important; }
          /* Keep page numbers at the bottom center */
          @bottom-center {
            content: 'Page ' counter(page) ' of ' counter(pages);
            font-size: 8pt;
            color: #555;
          }
        }

        /* ── Footer naturally flows after content ──────────── */
        #cs-print-footer {
          display: block !important;
          margin-top: 30px; /* Clean gap between table and footer */
          border-top: 0.5pt solid #000;
          padding-top: 15px;
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          width: 100% !important;
        }

        /* Ensure full width and no compression */
        #printable-sheet {
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        /* ── 2. Reset body & root so content flows across pages ───── */
        html, body {
          height: auto !important;
          overflow: visible !important;
          background: white !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 9pt !important;
          color: #000 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #root,
        #root > div,
        #root > div > main,
        #root > div > main > div {
          height: auto !important;
          min-height: unset !important;
          max-height: unset !important;
          overflow: visible !important;
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* ── 3. Hide ALL web UI elements ──────────────────────────── */
        header,
        aside,
        nav,
        footer,
        .no-print,
        [class*="sidebar"],
        [class*="Sidebar"],
        [class*="sticky"],
        [class*="floating"],
        [class*="modal"],
        [class*="Modal"] {
          display: none !important;
          visibility: hidden !important;
        }

        /* Hide the on-screen encoding UI (the interactive table + toolbar) */
        #root > div > main > div > div.no-print {
          display: none !important;
        }

        /* ── 4. Show ONLY the printable document ──────────────────── */
        #printable-sheet {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        /* ── 5. Table rules ───────────────────────────────────────── */
        #printable-sheet table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          word-wrap: break-word !important;
        }
        #printable-sheet th,
        #printable-sheet td {
          border: 0.5pt solid #000 !important;
          padding: 3px 5px !important;
          font-size: 8pt !important;
          color: #000 !important;
          border-radius: 0 !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        #printable-sheet thead {
          display: table-header-group !important;
        }
        #printable-sheet thead th {
          background-color: #e5e7eb !important;
          font-weight: 800 !important;
          text-align: center !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Individual rows still must not split in half */
        #printable-sheet tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /*
         * BLOCK-LEVEL GROUP INTEGRITY
         * Each Barangay group is a <div class="cs-barangay-block">.
         * break-inside: avoid on a BLOCK ELEMENT (div) is reliably supported
         * by Chromium — the entire group moves to the next page if it doesn't fit.
         */
        .cs-barangay-block {
          display: block !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* City block: keep glued to the first barangay block below it */
        .cs-city-block {
          display: block !important;
          break-after: avoid !important;
          page-break-after: avoid !important;
        }

        /* Each group's nested table fills full width with same column proportions */
        .cs-group-table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          word-wrap: break-word !important;
          margin: 0 !important;
        }
        .cs-group-table td {
          border: 0.5pt solid #000 !important;
          padding: 3px 5px !important;
          font-size: 8pt !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }

        /* City / Barangay label rows — colors */
        .cs-city-row td {
          background-color: #dbeafe !important;
          color: #1a3a6b !important;
          font-weight: 800 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .cs-barangay-row td {
          background-color: #d1fae5 !important;
          color: #145a32 !important;
          font-weight: 700 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Borrower rows — plain black */
        .cs-data-row td {
          color: #000 !important;
        }

        /* ── 6. Prevent flex/grid layout from clipping content ────── */
        .flex, .grid, .inline-flex {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!selectedCollector) {
    return (
      <div className="space-y-6 animate-fadeIn no-print px-4">
        <div className="py-6 border-b border-emerald-100 dark:border-emerald-900/50 transition-colors duration-300">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors duration-300">Collection Sheets</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors duration-300">Select a collector for branch: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedBranch}</span></p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
          {collectors.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCollector(c)}
              className="bg-white dark:bg-slate-800 p-5 rounded-3xl border-b-4 border-slate-200 dark:border-slate-700 text-left hover:border-emerald-600 dark:hover:border-emerald-500 hover:-translate-y-1 transition-all group relative overflow-hidden shadow-md hover:shadow-xl hover:shadow-emerald-900/10 dark:hover:shadow-emerald-900/40 active:translate-y-0 active:border-b-0"
            >
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-all mb-3 rounded-xl text-base">
                {(c.nickname || c.name).charAt(0)}
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight transition-colors duration-300">{c.nickname || c.name}</h4>
              <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest mt-0.5 transition-colors duration-300">Field Spreadsheet</p>

              <div className="mt-6 border-t border-slate-50 dark:border-slate-700/50 pt-4 flex justify-between items-center transition-colors duration-300">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors duration-300">
                  {loans.filter(l => l.collector === (c.nickname || c.name)).length} Accounts
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">Generate</span>
              </div>
            </button>
          ))}
          {collectors.length === 0 && (
            <div className="col-span-full py-12 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center transition-colors duration-300">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-2xl mb-3 transition-colors duration-300">👥</div>
              <p className="font-bold text-slate-400 dark:text-slate-500 italic text-sm transition-colors duration-300">No collectors found in this branch.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-fadeIn no-print bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-30 transition-colors duration-300">
          <div className="flex justify-between items-center p-6 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSelectedCollector(null)}
                className="hover:bg-emerald-50 dark:hover:bg-slate-800 p-3 rounded-2xl transition-all text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Back to Selection"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </button>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors duration-300">ENCODING: {selectedCollector.nickname || selectedCollector.name}</h2>
                <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300">{selectedBranch}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-right px-4 flex flex-col justify-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[8px] transition-colors duration-300">Current Total</p>
                <p className="font-black text-emerald-600 dark:text-emerald-400 text-lg transition-colors duration-300">₱{totalCollected.toLocaleString()}</p>
              </div>
              <button
                onClick={handlePrint}
                className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-white transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Print
              </button>
              <button
                onClick={handlePostAll}
                disabled={totalCollected === 0}
                className="px-6 py-2 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/50"
              >
                Post All
              </button>
            </div>
          </div>

          <div className="px-6 pb-6 grid grid-cols-4 gap-4 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center transition-colors duration-300">
              <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors duration-300">Expense Adjustment</p>
              <input
                type="number"
                className="bg-transparent text-center font-black text-slate-800 dark:text-white text-lg w-full focus:outline-none transition-colors duration-300"
                value={expense}
                onChange={e => setExpense(e.target.value)}
              />
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 text-center transition-colors duration-300">
              <p className="text-[8px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest mb-1 transition-colors duration-300">Grand Total</p>
              <p className="font-black text-emerald-900 dark:text-emerald-400 text-lg transition-colors duration-300">₱{grandTotalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {success && (
          <div className="mx-6 mt-4 p-4 bg-emerald-600 dark:bg-emerald-500 text-white font-black text-center rounded-2xl animate-pulse text-xs uppercase tracking-widest transition-colors duration-300">
            {success}
          </div>
        )}

        {/* Filter Section */}
        <div className="mx-6 mb-4 mt-6 p-4 bg-slate-50 dark:bg-slate-800/20 rounded-[16px] border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Filter by Due Date:
            </span>
            <div className="flex items-center gap-2">
              <input 
                type="date"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" 
                value={filterFromDate} 
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
              <span className="text-slate-400 font-medium text-sm">to</span>
              <input 
                type="date"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" 
                value={filterToDate} 
                onChange={(e) => setFilterToDate(e.target.value)}
              />
            </div>
            
            {(filterFromDate || filterToDate) && (
               <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="text-[10px] text-red-500 hover:text-white border border-red-200 hover:bg-red-500 hover:border-red-500 bg-red-50 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all whitespace-nowrap">
                 Clear Filter
               </button>
            )}

            {filterFromDate && filterToDate && filterFromDate > filterToDate && (
               <span className="text-[10px] text-red-500 font-black uppercase tracking-widest animate-pulse whitespace-nowrap">
                 Invalid date range
               </span>
            )}
          </div>
          
          {(filterFromDate || filterToDate) && !(filterFromDate && filterToDate && filterFromDate > filterToDate) && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
               Showing: Due Date {filterFromDate ? formatDateForDisplay(filterFromDate) : 'Any'} – {filterToDate ? formatDateForDisplay(filterToDate) : 'Any'}
            </div>
          )}
        </div>

        {/* SpreadSheet Matrix View (Encoding) */}
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse border border-slate-200 dark:border-slate-700 min-w-[1000px] rounded-3xl overflow-hidden shadow-sm transition-colors duration-300">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-300 dark:border-slate-700 transition-colors duration-300">
                <th className="p-4 border-r border-slate-200 dark:border-slate-700 w-24 text-center font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest transition-colors duration-300">CODE</th>
                <th className="p-4 border-r border-slate-200 dark:border-slate-700 font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest transition-colors duration-300">BORROWER NAME</th>
                <th className="p-4 border-r border-slate-200 dark:border-slate-700 font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest transition-colors duration-300">FULL ADDRESS</th>
                <th className="p-4 border-r border-slate-200 dark:border-slate-700 w-32 font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest transition-colors duration-300">DUE DATE</th>
                <th className="p-4 border-r border-slate-200 dark:border-slate-700 text-right w-40 font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest transition-colors duration-300">BALANCE</th>
                <th className="p-4 w-48 text-center font-black text-slate-400 dark:text-slate-500 text-[10px] tracking-widest uppercase transition-colors duration-300">Payment Entry</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedLoans).map(([city, barangays]) => (
                <React.Fragment key={city}>
                  <tr className="bg-slate-100/50 dark:bg-slate-800 font-black border-b border-slate-200 dark:border-slate-700 transition-colors duration-300">
                    <td colSpan={6} className="p-3 px-6 uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 text-[10px] transition-colors duration-300">CITY: {city}</td>
                  </tr>
                  {Object.entries(barangays).map(([barangay, items]) => (
                    <React.Fragment key={barangay}>
                       <tr className="bg-emerald-50/20 dark:bg-emerald-900/10 font-bold border-b border-slate-200 dark:border-slate-700 transition-colors duration-300">
                        <td colSpan={6} className="p-2 px-10 uppercase tracking-widest text-emerald-600/50 dark:text-emerald-400/50 text-[10px] transition-colors duration-300">BARANGAY: {barangay}</td>
                      </tr>
                      {items.map(l => (
                        <tr key={l.id} className="group border-b border-slate-100 dark:border-slate-700/50 hover:bg-emerald-50 dark:hover:bg-slate-800/50 transition-all duration-300">
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-center font-black text-slate-400 dark:text-slate-500 transition-colors duration-300">{l.code}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 font-bold text-slate-700 dark:text-slate-300 transition-all duration-300 group-hover:font-black group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:underline decoration-emerald-500/30 underline-offset-4">{l.lastName.toUpperCase()}, {l.firstName.toUpperCase()}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium italic transition-colors duration-300">{l.fullAddress || "—"}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 font-bold transition-colors duration-300">{l.dueDate}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-right font-black text-slate-800 dark:text-white transition-colors duration-300">₱{l.runningBalance.toLocaleString()}</td>
                          <td className="p-2 px-6">
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 focus-within:border-emerald-600 dark:focus-within:border-emerald-500 rounded-xl bg-white dark:bg-slate-900 transition-all duration-300">
                              <span className="px-3 text-emerald-600 dark:text-emerald-400 font-black transition-colors duration-300">₱</span>
                              <input
                                type="number"
                                className="w-full py-2 bg-transparent focus:outline-none font-black text-center text-emerald-700 dark:text-emerald-400 transition-colors duration-300"
                                placeholder="0.00"
                                value={payments[l.id] || ''}
                                onChange={e => setPayments({ ...payments, [l.id]: e.target.value })}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          PRINTABLE DOCUMENT — hidden on screen, visible only when printing
          All layout uses inline styles (no Tailwind flex/grid) to ensure
          correct rendering in the browser print engine.
      ═══════════════════════════════════════════════════════════════ */}
      <div id="printable-sheet" style={{ display: 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9pt', color: '#000' }}>

        {/* ── Document Header ── */}
        <div style={{ borderBottom: '2pt solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
              MELANN LENDING CORPORATION
            </div>
            <div style={{ fontSize: '9pt', color: '#444', marginTop: '1px' }}>
              Past Due & Report Monitoring System
            </div>
            <div style={{
              fontSize: '11pt', fontWeight: '800', marginTop: '6px',
              letterSpacing: '3px', textTransform: 'uppercase', textDecoration: 'underline'
            }}>
              FIELD COLLECTION FORM
            </div>
            {(filterFromDate || filterToDate) && !(filterFromDate && filterToDate && filterFromDate > filterToDate) && (
              <div style={{ fontSize: '10pt', fontWeight: '800', marginTop: '6px' }}>
                Due Date Range: {filterFromDate ? formatDateForDisplay(filterFromDate) : 'Any'} – {filterToDate ? formatDateForDisplay(filterToDate) : 'Any'}
              </div>
            )}
          </div>

          {/* Two-column info row */}
          <table className="cs-no-border" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ border: 'none', padding: '1px 0', width: '60%', fontSize: '9pt' }}>
                  <strong>Collector:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '200px', paddingLeft: '4px' }}>
                    {(selectedCollector.nickname || selectedCollector.name).toUpperCase()}
                  </span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', textAlign: 'right', fontSize: '9pt' }}>
                  <strong>Total Collected:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '100px', textAlign: 'center' }}>&nbsp;</span>
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt' }}>
                  <strong>Area:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '200px', paddingLeft: '4px' }}>
                    {(selectedCollector.address || selectedBranch).toUpperCase()}
                  </span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', textAlign: 'right', fontSize: '9pt' }}>
                  <strong>Total Expense:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '100px', textAlign: 'center' }}>&nbsp;</span>
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt' }}>
                  <strong>Date:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '200px', paddingLeft: '4px' }}>
                    {new Date().toLocaleString('en-PH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', textAlign: 'right', fontSize: '9pt' }}>
                  <strong>Grand Total:</strong>&nbsp;
                  <span style={{ borderBottom: '0.5pt solid #000', display: 'inline-block', minWidth: '100px', textAlign: 'center' }}>&nbsp;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            COLLECTION TABLE — Block-Group Architecture
            ─────────────────────────────────────────────────────────────
            Each Barangay group is a <div class="cs-barangay-block"> with
            break-inside:avoid. Block-level divs are the ONLY container
            type that Chromium's print engine reliably moves to the next
            page as a whole unit. All nested tables share the same colgroup
            widths so columns align perfectly across groups.
        ══════════════════════════════════════════════════════════════ */}

        {/* Shared column-width reference (invisible, 0-height — just establishes widths) */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', margin: 0, padding: 0, lineHeight: 0, fontSize: 0, border: 'none' }} aria-hidden="true">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
        </table>

        {/* Column header row — standalone table, repeats via thead display:table-header-group */}
        <table className="cs-group-table" style={{ marginBottom: 0 }}>
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Code</th>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'left',   fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Borrower Name</th>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'left',   fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Full Address</th>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'left',   fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Due Date</th>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'right',  fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Running Balance</th>
              <th style={{ border: '0.5pt solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8pt', fontWeight: '800', backgroundColor: '#e5e7eb' }}>Payment</th>
            </tr>
          </thead>
        </table>

        {/* Group blocks */}
        {Object.entries(groupedLoans).map(([city, barangays]) => (
          <React.Fragment key={city}>

            {/* City label — break-after:avoid keeps it with the first barangay block */}
            <div className="cs-city-block">
              <table className="cs-group-table">
                <colgroup>
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <tbody>
                  <tr className="cs-city-row">
                    <td colSpan={6} style={{
                      border: '0.5pt solid #000', padding: '4px 6px',
                      fontWeight: '800', fontSize: '9pt',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: '#1a3a6b', backgroundColor: '#dbeafe',
                      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                    } as React.CSSProperties}>
                      🏙 City: {city}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {Object.entries(barangays).map(([barangay, items]) => (
              /*
               * cs-barangay-block is a BLOCK DIV with break-inside:avoid.
               * The browser will not split this div across pages.
               * If it doesn't fit on the current page, the entire div
               * (label + all borrower rows) moves to the next page.
               */
              <div key={barangay} className="cs-barangay-block">
                <table className="cs-group-table">
                  <colgroup>
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <tbody>
                    {/* Barangay label */}
                    <tr className="cs-barangay-row">
                      <td colSpan={6} style={{
                        border: '0.5pt solid #000', padding: '3px 6px 3px 20px',
                        fontWeight: '700', fontSize: '8.5pt', fontStyle: 'italic',
                        color: '#145a32', backgroundColor: '#d1fae5',
                        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                      } as React.CSSProperties}>
                        📍 Barangay: {barangay}
                      </td>
                    </tr>
                    {/* Borrower rows */}
                    {items.map(l => (
                      <tr key={l.id} className="cs-data-row">
                        <td style={{ border: '0.5pt solid #000', padding: '3px',     textAlign: 'center', fontWeight: '700', fontSize: '8pt' }}>{l.code}</td>
                        <td style={{ border: '0.5pt solid #000', padding: '3px 4px', fontWeight: '700',   fontSize: '8.5pt', textTransform: 'uppercase', lineHeight: '1.2' }}>{l.lastName}, {l.firstName}</td>
                        <td style={{ border: '0.5pt solid #000', padding: '3px 4px', fontSize: '7.5pt',   fontStyle: 'italic', lineHeight: '1.2' }}>{l.fullAddress || '—'}</td>
                        <td style={{ border: '0.5pt solid #000', padding: '3px 4px', fontSize: '8pt',     lineHeight: '1.2' }}>{l.dueDate}</td>
                        <td style={{ border: '0.5pt solid #000', padding: '3px 4px', textAlign: 'right',  fontWeight: '800', fontSize: '8.5pt' }}>₱{l.runningBalance.toLocaleString()}</td>
                        <td style={{ border: '0.5pt solid #000', padding: '3px',     backgroundColor: '#fff' }}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          </React.Fragment>
        ))}

        {/* ── Footer logically placed AFTER all groups ── */}
        <div id="cs-print-footer" style={{ display: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '8.5pt', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600' }}>
              Prepared by: <span style={{ borderBottom: '1pt solid #000', display: 'inline-block', minWidth: '160px' }}>&nbsp;</span>
            </span>
            <span style={{ fontWeight: '600', textAlign: 'center' }}>
              Collector Signature: <span style={{ borderBottom: '1pt solid #000', display: 'inline-block', minWidth: '160px' }}>&nbsp;</span>
            </span>
            <span style={{ fontWeight: '600', textAlign: 'right' }}>
              Date Submitted: <span style={{ borderBottom: '1pt solid #000', display: 'inline-block', minWidth: '130px' }}>&nbsp;</span>
            </span>
          </div>

          <div style={{ fontSize: '7pt', color: '#666', borderTop: '0.5pt solid #eee', paddingTop: '4px' }}>
            System Generated &nbsp;|&nbsp; {selectedBranch} &nbsp;|&nbsp; {new Date().toLocaleString()}
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={closeConfirm}
        type={confirmConfig.type}
      />
    </>
  );
};

export default CollectionSheet;