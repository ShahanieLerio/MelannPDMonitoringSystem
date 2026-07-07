
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, Collector, User, Branch, MovingStatus } from '../types.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';
import { formatMMDDYYYY } from '../constants.tsx';
import * as XLSX from 'xlsx';

interface CollectionSheetProps {
  currentUser: User;
  selectedBranch: Branch;
}

const isCollectibleLoan = (loan: Loan) =>
  loan.status !== MovingStatus.PAID && loan.runningBalance > 0;

const CollectionSheet: React.FC<CollectionSheetProps> = ({ selectedBranch }) => {
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
    const selectedCollectorName = getCollectorDisplayName(selectedCollector.nickname || selectedCollector.name, collectors);
    let list = loans.filter(l =>
      getCollectorDisplayName(l.collector, collectors) === selectedCollectorName &&
      isCollectibleLoan(l)
    );
    if (filterFromDate) list = list.filter(l => l.dueDate >= filterFromDate);
    if (filterToDate) list = list.filter(l => l.dueDate <= filterToDate);
    return list;
  }, [selectedCollector, loans, collectors, filterFromDate, filterToDate]);

  const groupedLoans = useMemo(() => {
    return collectorLoans.reduce((acc, loan) => {
      if (!acc[loan.city]) acc[loan.city] = {};
      if (!acc[loan.city][loan.barangay]) acc[loan.city][loan.barangay] = [];
      acc[loan.city][loan.barangay].push(loan);
      return acc;
    }, {} as Record<string, Record<string, Loan[]>>);
  }, [collectorLoans]);

  const arrangedCollectors = useMemo(() => {
    return collectors
      .map((collector, index) => ({ collector, index }))
      .sort((a, b) => {
        const aHasPhoto = Boolean(a.collector.photoUrl);
        const bHasPhoto = Boolean(b.collector.photoUrl);
        if (aHasPhoto === bHasPhoto) return a.index - b.index;
        return aHasPhoto ? -1 : 1;
      })
      .map(({ collector }) => collector);
  }, [collectors]);

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
          margin: 6mm 10mm 10mm 10mm;

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
        #root > div > main {
          margin-left: 0 !important;
          position: static !important;
          transform: none !important;
        }
        #root > div > main > header,
        #root > div > main > div > .no-print {
          display: none !important;
          visibility: hidden !important;
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
          margin: -6mm 0 0 0 !important;
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
          break-inside: auto !important;
          page-break-inside: auto !important;
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
      <div className="animate-fadeIn no-print px-4 pb-8">
        <div className="mb-6 border-b border-emerald-100/80 dark:border-emerald-900/50 py-6 transition-colors duration-300">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                {selectedBranch} Branch
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 transition-colors duration-300 dark:text-white">Collection Sheets</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 transition-colors duration-300 dark:text-slate-400">
                Select a collector to generate and review the field collection sheet for the active branch.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Collectors</p>
                <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{collectors.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Accounts</p>
                <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-300">{loans.length}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {arrangedCollectors.map(c => {
            const accountCount = loans.filter(l =>
              getCollectorDisplayName(l.collector, collectors) === getCollectorDisplayName(c.nickname || c.name, collectors) &&
              isCollectibleLoan(l)
            ).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCollector(c)}
                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/10 active:translate-y-0 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:shadow-emerald-950/30"
              >
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 opacity-70 transition-opacity duration-300 group-hover:opacity-100"></span>
              <div className="flex items-start justify-between gap-4">
              {c.photoUrl ? (
                <img
                  src={c.photoUrl}
                  alt={c.nickname || c.name}
                  className="h-28 w-28 rounded-lg border border-emerald-100 object-cover object-top shadow-sm shadow-slate-900/10 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-emerald-300 dark:border-emerald-900/60 dark:group-hover:border-emerald-600"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-3xl font-black text-emerald-700 transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:group-hover:bg-emerald-500">
                  {(c.nickname || c.name).charAt(0)}
                </div>
              )}
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-right dark:bg-slate-900/60">
                  <p className="text-lg font-black leading-none text-slate-900 dark:text-white">{accountCount}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Accounts</p>
                </div>
              </div>
              <div className="mt-5">
                <h4 className="text-base font-black uppercase leading-tight tracking-tight text-slate-950 transition-colors duration-300 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">{c.nickname || c.name}</h4>
                <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors duration-300 dark:text-slate-500">Field Spreadsheet</p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 transition-colors duration-300 dark:border-slate-700/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Ready to open
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-900/30 dark:text-emerald-300 dark:group-hover:bg-emerald-500" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </span>
              </div>
              </button>
            );
          })}
          {collectors.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-14 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-2xl mb-3 transition-colors duration-300">👥</div>
              <p className="text-sm font-bold italic text-slate-400 transition-colors duration-300 dark:text-slate-500">No collectors found in this branch.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const cityCount = Object.keys(groupedLoans).length;
  const barangayCount = Object.values(groupedLoans as Record<string, Record<string, Loan[]>>).reduce((total, barangays) => total + Object.keys(barangays).length, 0);
  const totalRunningBalance = collectorLoans.reduce((total, loan) => total + loan.runningBalance, 0);

  const getExportFileBaseName = () => {
    const collectorName = (selectedCollector.nickname || selectedCollector.name)
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const branchTag = selectedBranch.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    const today = new Date().toISOString().split('T')[0];
    return `Collection_Sheet_${collectorName || 'Collector'}_${branchTag || 'Branch'}_${today}`;
  };

  const handleExportExcel = () => {
    const exportData: (string | number)[][] = [
      ['MELANN LENDING CORPORATION'],
      ['Past Due & Report Monitoring System'],
      ['FIELD COLLECTION FORM'],
      ['Collector', (selectedCollector.nickname || selectedCollector.name).toUpperCase()],
      ['Branch', selectedBranch],
      ['Generated', new Date().toLocaleString('en-PH')],
      ['Due Date Range', `${filterFromDate ? formatDateForDisplay(filterFromDate) : 'Any'} to ${filterToDate ? formatDateForDisplay(filterToDate) : 'Any'}`],
      ['Accounts', collectorLoans.length],
      ['Cities', cityCount],
      ['Barangays', barangayCount],
      ['Running Balance', totalRunningBalance],
      [],
      ['Code', 'Borrower Name', 'Full Address', 'Due Date', 'Running Balance', 'Payment']
    ];

    Object.entries(groupedLoans).forEach(([city, barangays]) => {
      exportData.push([`CITY: ${city}`, '', '', '', '', '']);
      Object.entries(barangays).forEach(([barangay, items]) => {
        exportData.push([`BARANGAY: ${barangay}`, '', '', '', '', '']);
        items.forEach(loan => {
          exportData.push([
            loan.code,
            `${loan.lastName.toUpperCase()}, ${loan.firstName.toUpperCase()}`,
            loan.fullAddress || '',
            formatMMDDYYYY(loan.dueDate),
            loan.runningBalance,
            ''
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 46 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Collection Sheet');
    XLSX.writeFile(wb, `${getExportFileBaseName()}.xlsx`);
  };

  return (
    <>
      <div className="animate-fadeIn no-print min-h-screen bg-slate-50/70 transition-colors duration-300 dark:bg-slate-950">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedCollector(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                title="Back to Selection"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </button>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 transition-colors duration-300 dark:text-emerald-300">Collection sheet encoding</p>
                <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-slate-950 transition-colors duration-300 dark:text-white">{selectedCollector.nickname || selectedCollector.name}</h2>
                <p className="mt-0.5 text-xs font-bold text-slate-500 transition-colors duration-300 dark:text-slate-400">{selectedBranch} Branch</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300 sm:block">
                {collectorLoans.length} Accounts
              </div>
              <button
                onClick={handleExportExcel}
                disabled={collectorLoans.length === 0}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm transition-all hover:border-emerald-600 hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
                title="Export to Microsoft Excel"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v8m0 0l-3-3m3 3l3-3m2 5H7a2 2 0 01-2-2V6a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z"></path></svg>
                Excel
              </button>
              <button
                onClick={handlePrint}
                disabled={collectorLoans.length === 0}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                title="Export to PDF"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.5L13.5 4H7a2 2 0 00-2 2v13a2 2 0 002 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 4v6h6M8 15h8M8 18h5"></path></svg>
                PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all hover:bg-emerald-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Print
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-6 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Accounts in View</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{collectorLoans.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Cities</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{cityCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Barangays</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{barangayCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-900/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/70 dark:text-emerald-300/70">Running Balance</p>
            <p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">PHP {totalRunningBalance.toLocaleString()}</p>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mx-6 mb-4 mt-4 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Filter by Due Date:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="date"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" 
                value={filterFromDate} 
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
              <span className="text-slate-400 font-medium text-sm">to</span>
              <input 
                type="date"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" 
                value={filterToDate} 
                onChange={(e) => setFilterToDate(e.target.value)}
              />
            </div>
            
            {(filterFromDate || filterToDate) && (
               <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-500 transition-all hover:border-red-500 hover:bg-red-500 hover:text-white">
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
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
               Showing: Due Date {filterFromDate ? formatDateForDisplay(filterFromDate) : 'Any'} – {filterToDate ? formatDateForDisplay(filterToDate) : 'Any'}
            </div>
          )}
        </div>

        {/* SpreadSheet Matrix View (Encoding) */}
        <div className="mx-6 mb-8 mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Spreadsheet Matrix</p>
              <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">Grouped by city and barangay</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">{collectorLoans.length} Rows</span>
          </div>
          <table className="w-full min-w-[820px] border-collapse text-left text-xs transition-colors duration-300">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-800/60">
                <th className="w-24 border-r border-slate-200 p-4 text-center text-[10px] font-black tracking-widest text-slate-500 transition-colors duration-300 dark:border-slate-700 dark:text-slate-400">CODE</th>
                <th className="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-500 transition-colors duration-300 dark:border-slate-700 dark:text-slate-400">BORROWER NAME</th>
                <th className="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-500 transition-colors duration-300 dark:border-slate-700 dark:text-slate-400">FULL ADDRESS</th>
                <th className="w-32 border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-500 transition-colors duration-300 dark:border-slate-700 dark:text-slate-400">DUE DATE</th>
                <th className="w-40 border-r border-slate-200 p-4 text-right text-[10px] font-black tracking-widest text-slate-500 transition-colors duration-300 dark:border-slate-700 dark:text-slate-400">BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedLoans).map(([city, barangays]) => (
                <React.Fragment key={city}>
                  <tr className="border-b border-slate-200 bg-slate-100/80 font-black transition-colors duration-300 dark:border-slate-800 dark:bg-slate-800">
                    <td colSpan={5} className="px-6 py-3 text-[10px] uppercase tracking-[0.3em] text-slate-500 transition-colors duration-300 dark:text-slate-400">CITY: {city}</td>
                  </tr>
                  {Object.entries(barangays).map(([barangay, items]) => (
                    <React.Fragment key={barangay}>
                       <tr className="border-b border-emerald-100 bg-emerald-50/80 font-bold transition-colors duration-300 dark:border-emerald-900/50 dark:bg-emerald-900/15">
                        <td colSpan={5} className="px-10 py-2 text-[10px] uppercase tracking-widest text-emerald-700/70 transition-colors duration-300 dark:text-emerald-300/70">BARANGAY: {barangay}</td>
                      </tr>
                      {items.map(l => (
                        <tr key={l.id} className="group border-b border-slate-100 transition-all duration-300 hover:bg-emerald-50/70 dark:border-slate-800 dark:hover:bg-slate-800/70">
                          <td className="border-r border-slate-100 p-4 text-center font-black text-slate-400 transition-colors duration-300 dark:border-slate-800 dark:text-slate-500">{l.code}</td>
                          <td className="border-r border-slate-100 p-4 font-bold text-slate-800 transition-all duration-300 group-hover:text-emerald-800 dark:border-slate-800 dark:text-slate-200 dark:group-hover:text-emerald-300">{l.lastName.toUpperCase()}, {l.firstName.toUpperCase()}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium italic transition-colors duration-300">{l.fullAddress || "—"}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 font-bold transition-colors duration-300">{formatMMDDYYYY(l.dueDate)}</td>
                          <td className="p-4 border-r border-slate-100 dark:border-slate-700/50 text-right font-black text-slate-800 dark:text-white transition-colors duration-300">₱{l.runningBalance.toLocaleString()}</td>
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

          {/* Summary Stats for Print */}
          <table className="cs-no-border" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt' }}>
                  <strong style={{ color: '#2563eb' }}>Accounts in View:</strong> <span style={{ fontWeight: '800' }}>{collectorLoans.length}</span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt' }}>
                  <strong style={{ color: '#2563eb' }}>Cities:</strong> <span style={{ fontWeight: '800' }}>{cityCount}</span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt' }}>
                  <strong style={{ color: '#2563eb' }}>Barangays:</strong> <span style={{ fontWeight: '800' }}>{barangayCount}</span>
                </td>
                <td style={{ border: 'none', padding: '1px 0', fontSize: '9pt', textAlign: 'right' }}>
                  <strong style={{ color: '#059669' }}>Running Balance:</strong> <span style={{ fontWeight: '800', color: '#047857' }}>₱{totalRunningBalance.toLocaleString()}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            COLLECTION TABLE — Block-Group Architecture
            ─────────────────────────────────────────────────────────────
            Barangay groups may continue onto the next page so each page can
            use the available space. Rows avoid splitting, and all nested
            tables share the same colgroup widths so columns align perfectly.
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
               * Let the group continue across pages; individual table rows
               * still avoid splitting so the page bottom is used better.
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
                        <td style={{ border: '0.5pt solid #000', padding: '3px 4px', fontSize: '8pt',     lineHeight: '1.2' }}>{formatMMDDYYYY(l.dueDate)}</td>
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
    </>
  );
};

export default CollectionSheet;
