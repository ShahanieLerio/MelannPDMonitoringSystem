import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, Collector, User, Branch, MovingStatus, LocationStatus } from '../types.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';
import { STATUS_COLORS, formatMMDDYYYY } from '../constants.tsx';
import logo from '../assets/no bg.png';

interface LoansMaturityCheckerProps {
  currentUser?: User | null;
  selectedBranch: Branch;
}

interface CollectorMaturitySummary {
  collector: string;
  totalAccounts: number;
  activeAccounts: number;
  paidAccounts: number;
  totalPrincipal: number;
  totalCollected: number;
  totalRunningBalance: number;
  collectionRate: number;
}

const LoansMaturityChecker: React.FC<LoansMaturityCheckerProps> = ({ selectedBranch }) => {
  const [loans, setLoans] = useState<Loan[]>(store.getLoans(selectedBranch));
  const [collectors, setCollectors] = useState<Collector[]>(store.getCollectors(selectedBranch));

  // Filter States
  const [filterPreset, setFilterPreset] = useState<string>('all');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [selectedCollector, setSelectedCollector] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Pagination & Sorting
  const [sortField, setSortField] = useState<string>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sync with dataStore
  useEffect(() => {
    const refreshData = () => {
      setLoans(store.getLoans(selectedBranch));
      setCollectors(store.getCollectors(selectedBranch));
    };

    refreshData();
    const unsubscribe = store.subscribe(refreshData);
    return () => unsubscribe();
  }, [selectedBranch]);

  // Handle Preset Date Buttons
  const applyPreset = (preset: string) => {
    setFilterPreset(preset);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setFilterFromDate('');
      setFilterToDate('');
    } else if (preset === 'this-month') {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      setFilterFromDate(formatYMD(start));
      setFilterToDate(formatYMD(end));
    } else if (preset === 'next-month') {
      const start = new Date(currentYear, currentMonth + 1, 1);
      const end = new Date(currentYear, currentMonth + 2, 0);
      setFilterFromDate(formatYMD(start));
      setFilterToDate(formatYMD(end));
    } else if (preset === 'this-year') {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      setFilterFromDate(formatYMD(start));
      setFilterToDate(formatYMD(end));
    } else if (preset === 'past-due') {
      // All matured up to today
      setFilterFromDate('');
      setFilterToDate(formatYMD(today));
    } else if (preset === 'due-30-days') {
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      setFilterFromDate(formatYMD(today));
      setFilterToDate(formatYMD(end));
    } else if (preset === 'due-60-days') {
      const end = new Date(today);
      end.setDate(today.getDate() + 60);
      setFilterFromDate(formatYMD(today));
      setFilterToDate(formatYMD(end));
    }
    setCurrentPage(1);
  };

  // Collector normalized names list
  const collectorOptions = useMemo(() => {
    const list = Array.from(new Set(loans.map(l => getCollectorDisplayName(l.collector, collectors)))).filter(Boolean).sort();
    return list;
  }, [loans, collectors]);

  // Primary filtering based on Maturity Date (dueDate), Branch, Status, and Location
  const dateFilteredLoans = useMemo(() => {
    let list = [...loans];

    // Maturity Date Range Filter
    if (filterFromDate) {
      list = list.filter(l => l.dueDate && l.dueDate >= filterFromDate);
    }
    if (filterToDate) {
      list = list.filter(l => l.dueDate && l.dueDate <= filterToDate);
    }

    // Status Filter
    if (statusFilter === 'ACTIVE') {
      list = list.filter(l => l.status !== MovingStatus.PAID && (l.runningBalance || 0) > 0);
    } else if (statusFilter === 'PAID') {
      list = list.filter(l => l.status === MovingStatus.PAID || (l.runningBalance || 0) <= 0);
    } else if (statusFilter !== 'ALL') {
      list = list.filter(l => l.status === statusFilter);
    }

    // Location Filter
    if (locationFilter !== 'ALL') {
      list = list.filter(l => l.location === locationFilter);
    }

    return list;
  }, [loans, filterFromDate, filterToDate, statusFilter, locationFilter]);

  // Grouped Summary by Collector (Calculated on the date/status-filtered data)
  const collectorSummaries: CollectorMaturitySummary[] = useMemo(() => {
    const map = new Map<string, {
      totalAccounts: number;
      activeAccounts: number;
      paidAccounts: number;
      totalPrincipal: number;
      totalCollected: number;
      totalRunningBalance: number;
    }>();

    dateFilteredLoans.forEach(loan => {
      const coll = getCollectorDisplayName(loan.collector, collectors);
      const isPaid = loan.status === MovingStatus.PAID || (loan.runningBalance || 0) <= 0;
      const principal = Number(loan.totalLoan ?? loan.principal ?? 0);
      const collected = Number(loan.amountCollected || 0);
      const balance = Number(loan.runningBalance || 0);

      const current = map.get(coll) || {
        totalAccounts: 0,
        activeAccounts: 0,
        paidAccounts: 0,
        totalPrincipal: 0,
        totalCollected: 0,
        totalRunningBalance: 0,
      };

      current.totalAccounts += 1;
      if (isPaid) {
        current.paidAccounts += 1;
      } else {
        current.activeAccounts += 1;
      }
      current.totalPrincipal += principal;
      current.totalCollected += collected;
      current.totalRunningBalance += balance;

      map.set(coll, current);
    });

    const result: CollectorMaturitySummary[] = [];
    map.forEach((data, coll) => {
      const collectionRate = data.totalPrincipal > 0 ? (data.totalCollected / data.totalPrincipal) * 100 : 0;
      result.push({
        collector: coll,
        ...data,
        collectionRate,
      });
    });

    // Sort by Total Running Balance descending by default, then collector name
    return result.sort((a, b) => b.totalRunningBalance - a.totalRunningBalance || a.collector.localeCompare(b.collector));
  }, [dateFilteredLoans, collectors]);

  // Grand Totals for summary cards and table footers
  const grandTotals = useMemo(() => {
    return dateFilteredLoans.reduce((acc, l) => {
      const isPaid = l.status === MovingStatus.PAID || (l.runningBalance || 0) <= 0;
      const principal = Number(l.totalLoan ?? l.principal ?? 0);
      const collected = Number(l.amountCollected || 0);
      const balance = Number(l.runningBalance || 0);

      acc.totalAccounts += 1;
      if (isPaid) acc.paidAccounts += 1;
      else acc.activeAccounts += 1;
      acc.totalPrincipal += principal;
      acc.totalCollected += collected;
      acc.totalRunningBalance += balance;
      return acc;
    }, {
      totalAccounts: 0,
      activeAccounts: 0,
      paidAccounts: 0,
      totalPrincipal: 0,
      totalCollected: 0,
      totalRunningBalance: 0,
    });
  }, [dateFilteredLoans]);

  const grandCollectionRate = grandTotals.totalPrincipal > 0
    ? (grandTotals.totalCollected / grandTotals.totalPrincipal) * 100
    : 0;

  // Final filtered list for the Client Details Table (includes Collector Selection & Search Query)
  const finalClientList = useMemo(() => {
    let list = dateFilteredLoans;

    // Filter by specific collector if chosen
    if (selectedCollector !== 'ALL') {
      list = list.filter(l => getCollectorDisplayName(l.collector, collectors) === selectedCollector);
    }

    // Search Query (Borrower name, code, barangay, city, area)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(l =>
        (l.borrowerName && l.borrowerName.toLowerCase().includes(query)) ||
        (l.code && l.code.toLowerCase().includes(query)) ||
        (l.barangay && l.barangay.toLowerCase().includes(query)) ||
        (l.city && l.city.toLowerCase().includes(query)) ||
        (l.area && l.area.toLowerCase().includes(query)) ||
        (l.contactNumber && l.contactNumber.includes(query))
      );
    }

    // Sorting
    list.sort((a, b) => {
      let aVal: any = a[sortField as keyof Loan] ?? '';
      let bVal: any = b[sortField as keyof Loan] ?? '';

      if (sortField === 'principal') {
        aVal = Number(a.totalLoan ?? a.principal ?? 0);
        bVal = Number(b.totalLoan ?? b.principal ?? 0);
      } else if (sortField === 'collector') {
        aVal = getCollectorDisplayName(a.collector, collectors);
        bVal = getCollectorDisplayName(b.collector, collectors);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return list;
  }, [dateFilteredLoans, selectedCollector, collectors, searchQuery, sortField, sortDirection]);

  // Client Details Section Totals (for the specific list currently displayed)
  const displayedTotals = useMemo(() => {
    return finalClientList.reduce((acc, l) => {
      const principal = Number(l.totalLoan ?? l.principal ?? 0);
      const collected = Number(l.amountCollected || 0);
      const balance = Number(l.runningBalance || 0);

      acc.totalAccounts += 1;
      acc.totalPrincipal += principal;
      acc.totalCollected += collected;
      acc.totalRunningBalance += balance;
      return acc;
    }, {
      totalAccounts: 0,
      totalPrincipal: 0,
      totalCollected: 0,
      totalRunningBalance: 0,
    });
  }, [finalClientList]);

  // Pagination slice
  const paginatedClients = useMemo(() => {
    if (pageSize === -1) return finalClientList;
    const start = (currentPage - 1) * pageSize;
    return finalClientList.slice(start, start + pageSize);
  }, [finalClientList, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(finalClientList.length / pageSize));

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Maturity status helper
  const getMaturityBadge = (dueDateStr?: string | null) => {
    if (!dueDateStr) return <span className="text-slate-400 italic text-xs">No Date</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
          Matured ({absDays}d ago)
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
          Matures Today
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          In {diffDays} days
        </span>
      );
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      '#',
      'Account Code',
      'Borrower Name',
      'Collector',
      'Date Released',
      'Maturity Date (Due Date)',
      'Principal / Total Loan',
      'Amount Collected',
      'Running Balance',
      'Status',
      'Location',
      'Barangay',
      'City / Municipality',
      'Contact Number'
    ];

    const rows = finalClientList.map((l, index) => [
      index + 1,
      `"${l.code || ''}"`,
      `"${l.borrowerName || ''}"`,
      `"${getCollectorDisplayName(l.collector, collectors)}"`,
      `"${l.dateRelease || ''}"`,
      `"${l.dueDate || ''}"`,
      Number(l.totalLoan ?? l.principal ?? 0),
      Number(l.amountCollected || 0),
      Number(l.runningBalance || 0),
      `"${l.status || ''}"`,
      `"${l.location || ''}"`,
      `"${l.barangay || ''}"`,
      `"${l.city || ''}"`,
      `"${l.contactNumber || ''}"`
    ]);

    const grandTotalRow = [
      '',
      '"TOTAL"',
      `"${finalClientList.length} Accounts"`,
      '',
      '',
      '',
      displayedTotals.totalPrincipal,
      displayedTotals.totalCollected,
      displayedTotals.totalRunningBalance,
      '',
      '',
      '',
      '',
      ''
    ];

    const csvContent = [
      `"MELANN LENDING - LOANS MATURITY CHECKER REPORT"`,
      `"Branch: ${selectedBranch} | Maturity Range: ${filterFromDate || 'Any'} to ${filterToDate || 'Any'} | Collector: ${selectedCollector}"`,
      `"Generated: ${new Date().toLocaleString()}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
      grandTotalRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Loans_Maturity_Checker_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Scoped Print Styles ── */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      {/* ── Print Header (visible only when printing) ── */}
      <div className="print-only mb-6 text-center border-b-2 border-slate-800 pb-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src={logo} alt="Melann Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">MELANN LENDING INVESTOR</h1>
            <p className="text-xs font-bold text-slate-700">Past Due & Report Monitoring System</p>
          </div>
        </div>
        <h2 className="text-base font-black uppercase tracking-wide text-emerald-800 mt-2">
          LOANS MATURITY CHECKER REPORT
        </h2>
        <div className="flex justify-between items-center text-xs text-slate-600 mt-2 px-4">
          <span><strong>Branch:</strong> {selectedBranch}</span>
          <span><strong>Maturity Period:</strong> {filterFromDate || 'Beginning'} &rarr; {filterToDate || 'Present'}</span>
          <span><strong>Collector:</strong> {selectedCollector === 'ALL' ? 'All Collectors' : selectedCollector}</span>
          <span><strong>Generated On:</strong> {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
        </div>
      </div>

      {/* ── Screen Header & Top Controls ── */}
      <div className="no-print flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xl font-black">
              📅
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Loans Maturity Checker
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Monitor client accounts based on Loan Maturity Dates, group by collector, and view full client breakdowns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-900/20 transition-all"
            title="Export full list to CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all"
            title="Print Report"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="no-print bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 space-y-4">
        {/* Date Presets */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Maturity Date Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'past-due', label: 'Past Due / Matured' },
              { id: 'this-month', label: 'This Month' },
              { id: 'next-month', label: 'Next Month' },
              { id: 'due-30-days', label: 'Due in 30 Days' },
              { id: 'due-60-days', label: 'Due in 60 Days' },
              { id: 'this-year', label: 'This Year' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterPreset === p.id
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Date Range and Dropdown Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Maturity Date From
            </label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => {
                setFilterFromDate(e.target.value);
                setFilterPreset('custom');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Maturity Date To
            </label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => {
                setFilterToDate(e.target.value);
                setFilterPreset('custom');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Filter By Collector
            </label>
            <select
              value={selectedCollector}
              onChange={(e) => {
                setSelectedCollector(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Collectors ({collectorOptions.length})</option>
              {collectorOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Account Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only (With Balance)</option>
              <option value="PAID">Paid Accounts</option>
              <option value={MovingStatus.MOVING}>Moving (M)</option>
              <option value={MovingStatus.NM}>Not Moving (NM)</option>
              <option value={MovingStatus.NMSR}>NMSR</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Location Status
            </label>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Locations</option>
              <option value={LocationStatus.LOCATED}>Located (L)</option>
              <option value={LocationStatus.NOT_LOCATED}>Not Located (NL)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Accounts */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Accounts ({filterFromDate || filterToDate ? 'Filtered Period' : 'Overall'})
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              {grandTotals.totalAccounts.toLocaleString()}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">{grandTotals.activeAccounts} Active</span> &bull; <span className="text-slate-400">{grandTotals.paidAccounts} Paid</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-black">
            👥
          </div>
        </div>

        {/* Total Principal / Target */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Principal / Loan Target
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              ₱{grandTotals.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              Total released loan value
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-black">
            📊
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Collected
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₱{grandTotals.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              Efficiency: {grandCollectionRate.toFixed(1)}%
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-black">
            💰
          </div>
        </div>

        {/* Total Running Balance */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Running Balance (Due)
            </p>
            <h3 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              ₱{grandTotals.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              Outstanding collectible balance
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-xl font-black">
            ⏳
          </div>
        </div>
      </div>

      {/* ── Section 1: Summary By Collector (Kada Collector na may Total) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span>👤 Collector Maturity Summary Breakdown</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {collectorSummaries.length} Collectors
              </span>
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Summary of accounts, collections, and total running balances grouped by collector for the selected period. Click any collector to filter the client details below.
            </p>
          </div>
          {selectedCollector !== 'ALL' && (
            <button
              onClick={() => setSelectedCollector('ALL')}
              className="self-start sm:self-auto text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>✕ Clear Collector Filter (Showing: {selectedCollector})</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Collector</th>
                <th className="py-3 px-4 text-center">Total Accounts</th>
                <th className="py-3 px-4 text-center">Active (Due)</th>
                <th className="py-3 px-4 text-center">Paid</th>
                <th className="py-3 px-4 text-right">Total Principal</th>
                <th className="py-3 px-4 text-right">Collected Amount</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-4 text-center">Efficiency</th>
                <th className="py-3 px-4 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {collectorSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    No accounts found for the specified maturity date range and filters.
                  </td>
                </tr>
              ) : (
                collectorSummaries.map((summary) => {
                  const isSelected = selectedCollector === summary.collector;
                  return (
                    <tr
                      key={summary.collector}
                      onClick={() => setSelectedCollector(isSelected ? 'ALL' : summary.collector)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <td className="py-3 px-4 font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                        {summary.collector}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {summary.totalAccounts}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                        {summary.activeAccounts}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {summary.paidAccounts}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                        ₱{summary.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        ₱{summary.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600 dark:text-red-400">
                        ₱{summary.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-black">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          summary.collectionRate >= 75
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : summary.collectionRate >= 40
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        }`}>
                          {summary.collectionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center no-print">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCollector(isSelected ? 'ALL' : summary.collector);
                          }}
                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'View Clients'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Grand Total Footer */}
            {collectorSummaries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 dark:bg-slate-900/80 border-t-2 border-slate-300 dark:border-slate-600 font-black text-xs text-slate-900 dark:text-white">
                  <td className="py-3.5 px-4 uppercase tracking-wider">GRAND TOTAL</td>
                  <td className="py-3.5 px-4 text-center">{grandTotals.totalAccounts}</td>
                  <td className="py-3.5 px-4 text-center text-amber-600 dark:text-amber-400">{grandTotals.activeAccounts}</td>
                  <td className="py-3.5 px-4 text-center text-slate-500">{grandTotals.paidAccounts}</td>
                  <td className="py-3.5 px-4 text-right">
                    ₱{grandTotals.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    ₱{grandTotals.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-600 dark:text-red-400">
                    ₱{grandTotals.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">
                    {grandCollectionRate.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 text-center no-print">
                    <span className="text-[10px] text-slate-400">All Total</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Section 2: Client Details List (Sa Baba ang mga Client Details ng Kabuuang Total Nito) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span>📋 Client Accounts Detailed Breakdown</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                {finalClientList.length} Accounts
              </span>
              {selectedCollector !== 'ALL' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  Collector: {selectedCollector}
                </span>
              )}
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Showing client accounts matching the maturity period. Total Balance: <strong className="text-red-600 dark:text-red-400">₱{displayedTotals.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search borrower, code, area..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-64"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
              <option value={-1}>Show All</option>
            </select>
          </div>
        </div>

        {/* Client Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 select-none">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 cursor-pointer hover:text-emerald-600" onClick={() => handleSort('code')}>
                  Code {sortField === 'code' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-emerald-600" onClick={() => handleSort('borrowerName')}>
                  Borrower Name {sortField === 'borrowerName' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-emerald-600" onClick={() => handleSort('collector')}>
                  Collector {sortField === 'collector' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-emerald-600 text-center" onClick={() => handleSort('dateRelease')}>
                  Released {sortField === 'dateRelease' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-emerald-600 text-center" onClick={() => handleSort('dueDate')}>
                  Maturity (Due Date) {sortField === 'dueDate' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-emerald-600" onClick={() => handleSort('principal')}>
                  Total Loan {sortField === 'principal' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-emerald-600" onClick={() => handleSort('amountCollected')}>
                  Collected {sortField === 'amountCollected' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600" onClick={() => handleSort('runningBalance')}>
                  Running Balance {sortField === 'runningBalance' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-emerald-600" onClick={() => handleSort('status')}>
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3 text-center">Loc</th>
                <th className="py-3 px-4">Address / Area</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 italic">
                    No client accounts match the chosen maturity filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((loan, idx) => {
                  const globalIndex = pageSize === -1 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const collName = getCollectorDisplayName(loan.collector, collectors);
                  const principal = Number(loan.totalLoan ?? loan.principal ?? 0);
                  const collected = Number(loan.amountCollected || 0);
                  const balance = Number(loan.runningBalance || 0);

                  return (
                    <tr
                      key={loan.id || idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400 text-[11px]">
                        {globalIndex}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                        {loan.code || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-black text-slate-800 dark:text-slate-100">
                        <div>
                          <span>{loan.borrowerName}</span>
                          {loan.contactNumber && (
                            <span className="block text-[10px] font-normal text-slate-400">
                              📞 {loan.contactNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        {collName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                        {loan.dateRelease ? formatMMDDYYYY(loan.dateRelease) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {loan.dueDate ? formatMMDDYYYY(loan.dueDate) : '—'}
                          </span>
                          <span className="mt-0.5">
                            {getMaturityBadge(loan.dueDate)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        ₱{principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₱{collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-red-600 dark:text-red-400">
                        ₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${STATUS_COLORS[loan.status] || 'bg-slate-100 text-slate-800'}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                          loan.location === LocationStatus.LOCATED
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {loan.location || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        <span className="truncate max-w-[180px] block" title={`${loan.barangay || ''} ${loan.city || ''} ${loan.area || ''}`}>
                          {[loan.barangay, loan.city, loan.area].filter(Boolean).join(', ') || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer with Summary */}
            {finalClientList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 dark:bg-slate-900/80 border-t-2 border-slate-300 dark:border-slate-600 font-black text-xs text-slate-900 dark:text-white">
                  <td colSpan={6} className="py-3.5 px-4 uppercase tracking-wider text-right">
                    TOTAL FOR DISPLAYED CLIENTS ({finalClientList.length} ACCOUNTS):
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    ₱{displayedTotals.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                    ₱{displayedTotals.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-600 dark:text-red-400">
                    ₱{displayedTotals.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="no-print p-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              Page {currentPage} of {totalPages} ({finalClientList.length} accounts total)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                &laquo;
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-xs font-black bg-emerald-600 text-white rounded-lg">
                {currentPage}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Next
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoansMaturityChecker;
