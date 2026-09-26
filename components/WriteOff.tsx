import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/dataStore.ts';
import { Branch, DispositionStatus, DispositionType, Loan, ManagementDisposition, User, canApproveWriteOff } from '../types.ts';
import { isReportableCollectionPayment } from '../services/loanUtils.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface WriteOffProps {
  currentUser: User;
  selectedBranch: Branch;
}

type ClassificationType = 'located' | 'unlocated' | 'deceased';
type ActiveTabType = 'dashboard' | ClassificationType;

type WriteOffRow = {
  loan: Loan;
  disposition: ManagementDisposition;
  classification: ClassificationType;
};

interface CollectorCategoryStats {
  count: number;
  principal: number;
  interest: number;
  totalLoan: number;
  amountCollected: number;
  balanceBeforeWriteOff: number;
  amountWriteOffOrDeceased: number;
}

interface CollectorComparisonRow {
  collector: string;
  located: CollectorCategoryStats;
  unlocated: CollectorCategoryStats;
  deceased: CollectorCategoryStats;
  total: CollectorCategoryStats;
}

type SortKey = 'client' | 'maturityDate' | 'decisionDate' | 'runningBalance';
type SortDirection = 'asc' | 'desc';

const currency = (value: number) => `PHP ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactCurrency = (value: number) => `PHP ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isWriteOffOrDeceasedPayment = (remarks?: string) =>
  /\b(deceased|dead|write[-\s]?off)\b/i.test(remarks || '');

const getLoanFinancials = (loan: Loan) => {
  const principal = Number(loan.principal ?? 0);
  const hasPrincipal = loan.principal != null;
  const totalLoan = Number(loan.totalLoan || loan.outstandingBalance || loan.runningBalance || 0);
  const interest = hasPrincipal ? Math.max(0, totalLoan - principal) : null;
  const activePayments = (loan.payments || []).filter(payment => payment.status !== 'REVERSED');
  const activePaymentTotal = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const sourceCollectedAdjustment = Math.max(0, Number(loan.amountCollected || 0) - activePaymentTotal);
  const cashPaymentTotal = activePayments
    .filter(isReportableCollectionPayment)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amountCollected = sourceCollectedAdjustment + cashPaymentTotal;
  const balanceBeforeWriteOff = Math.max(0, totalLoan - amountCollected);
  const recordedOutcomeAmount = activePayments
    .filter(payment => isWriteOffOrDeceasedPayment(payment.remarks))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amountWriteOffOrDeceased = recordedOutcomeAmount > 0
    ? Math.min(balanceBeforeWriteOff, recordedOutcomeAmount)
    : balanceBeforeWriteOff;

  return { principal, interest, totalLoan, amountCollected, balanceBeforeWriteOff, amountWriteOffOrDeceased };
};

const createEmptyStats = (): CollectorCategoryStats => ({
  count: 0,
  principal: 0,
  interest: 0,
  totalLoan: 0,
  amountCollected: 0,
  balanceBeforeWriteOff: 0,
  amountWriteOffOrDeceased: 0
});

const addLoanToStats = (target: CollectorCategoryStats, loan: Loan) => {
  const fin = getLoanFinancials(loan);
  target.count += 1;
  target.principal += fin.principal;
  target.interest += fin.interest || 0;
  target.totalLoan += fin.totalLoan;
  target.amountCollected += fin.amountCollected;
  target.balanceBeforeWriteOff += fin.balanceBeforeWriteOff;
  target.amountWriteOffOrDeceased += fin.amountWriteOffOrDeceased;
};

const WriteOff: React.FC<WriteOffProps> = ({ currentUser, selectedBranch }) => {
  const [loans, setLoans] = useState<Loan[]>(() => store.getLoans(selectedBranch));
  const [dispositions, setDispositions] = useState<ManagementDisposition[]>(() => store.getAllDispositions());
  const [activeClassification, setActiveClassification] = useState<ActiveTabType>('dashboard');
  const [activeTab, setActiveTab] = useState<'pending' | 'official'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [collectorFilter, setCollectorFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('decisionDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [approvalWarningOpen, setApprovalWarningOpen] = useState(false);

  useEffect(() => {
    const refreshData = () => {
      setLoans(store.getLoans(selectedBranch));
      setDispositions(store.getAllDispositions());
    };

    refreshData();
    const unsubscribe = store.subscribe(refreshData);
    return () => unsubscribe();
  }, [selectedBranch]);

  const classifyRow = (loan: Loan, disposition: ManagementDisposition): ClassificationType => {
    const evidence = disposition.evidence || [];
    const reason = (disposition.reason || '').toLowerCase();
    const isDeceased = 
      disposition.type === DispositionType.DEAD_ACCOUNT ||
      evidence.includes('Deceased borrower') ||
      /\b(dead|deceased)\b/i.test(reason) ||
      loan.remarks?.some(r => /\b(dead|deceased)\b/i.test(r.text)) ||
      loan.payments?.some(p => p.remarks && /\b(dead|deceased)\b/i.test(p.remarks)) ||
      store.isDeadWriteOff(loan);

    if (isDeceased) return 'deceased';

    if (
      disposition.writeOffClassification === 'Unlocated' ||
      evidence.includes('Relocated/Not located')
    ) {
      return 'unlocated';
    }

    return 'located';
  };

  const writeOffRows = useMemo(() => {
    const loansById = new Map<string, Loan>(loans.map(loan => [loan.id, loan]));
    const latestProspectByLoan = new Map<string, ManagementDisposition>();

    // 1. All management write-off dispositions
    dispositions
      .filter(disposition => disposition.type === DispositionType.PROSPECT_WRITE_OFF || disposition.type === DispositionType.DEAD_ACCOUNT)
      .forEach(disposition => {
        if (!latestProspectByLoan.has(disposition.loanId)) {
          latestProspectByLoan.set(disposition.loanId, disposition);
        }
      });

    // 2. Integrate all deceased clients from getDeadWriteOffs
    const deadLoans = store.getDeadWriteOffs(selectedBranch);
    deadLoans.forEach(deadLoan => {
      if (!latestProspectByLoan.has(deadLoan.id)) {
        const deadIntel = deadLoan.remarks?.find(r => /\b(dead|deceased)\b/i.test(r.text));
        const deadPayment = deadLoan.payments?.find(p => p.remarks && /\b(dead|deceased)\b/i.test(p.remarks));
        let reason = 'Deceased borrower (Full Settlement)';
        if (deadPayment?.remarks) reason = `[Payment] ${deadPayment.remarks}`;
        else if (deadIntel?.text) reason = deadIntel.text;
        else if (deadLoan.remarks?.length > 0) reason = deadLoan.remarks[deadLoan.remarks.length - 1].text;

        const date = deadLoan.lastPaidDate || (deadLoan.payments?.length ? deadLoan.payments[deadLoan.payments.length - 1].date : null) || (deadIntel ? deadIntel.timestamp : new Date().toISOString());

        const syntheticDisp: ManagementDisposition = {
          id: `dead-auto-${deadLoan.id}`,
          loanId: deadLoan.id,
          type: DispositionType.DEAD_ACCOUNT,
          reason,
          evidence: ['Deceased borrower'],
          writeOffClassification: undefined,
          status: DispositionStatus.PENDING_REVIEW,
          decidedBy: 'System / Field Intel',
          decisionDate: date || new Date().toISOString()
        };
        latestProspectByLoan.set(deadLoan.id, syntheticDisp);
        loansById.set(deadLoan.id, deadLoan);
      }
    });

    const rows: WriteOffRow[] = [];
    latestProspectByLoan.forEach((disposition, loanId) => {
      const loan = loansById.get(loanId);
      if (loan) {
        rows.push({
          loan,
          disposition,
          classification: classifyRow(loan, disposition)
        });
      }
    });

    return rows;
  }, [loans, dispositions, selectedBranch]);

  // Classification summary counts
  const classificationCounts = useMemo(() => {
    const located = writeOffRows.filter(r => r.classification === 'located');
    const unlocated = writeOffRows.filter(r => r.classification === 'unlocated');
    const deceased = writeOffRows.filter(r => r.classification === 'deceased');

    return {
      located: {
        total: located.length,
        pending: located.filter(r => r.disposition.status === DispositionStatus.PENDING_REVIEW).length,
        official: located.filter(r => r.disposition.status === DispositionStatus.APPROVED || r.disposition.status === DispositionStatus.EXECUTED).length,
      },
      unlocated: {
        total: unlocated.length,
        pending: unlocated.filter(r => r.disposition.status === DispositionStatus.PENDING_REVIEW).length,
        official: unlocated.filter(r => r.disposition.status === DispositionStatus.APPROVED || r.disposition.status === DispositionStatus.EXECUTED).length,
      },
      deceased: {
        total: deceased.length,
        pending: deceased.filter(r => r.disposition.status === DispositionStatus.PENDING_REVIEW).length,
        official: deceased.filter(r => r.disposition.status === DispositionStatus.APPROVED || r.disposition.status === DispositionStatus.EXECUTED).length,
      }
    };
  }, [writeOffRows]);

  // Active Classification Rows
  const classificationRows = useMemo(() => {
    if (activeClassification === 'dashboard') return writeOffRows;
    return writeOffRows.filter(r => r.classification === activeClassification);
  }, [writeOffRows, activeClassification]);

  const pendingRows = useMemo(() => {
    return classificationRows.filter(row => row.disposition.status === DispositionStatus.PENDING_REVIEW);
  }, [classificationRows]);

  const officialRows = useMemo(() => {
    return classificationRows.filter(row =>
      row.disposition.status === DispositionStatus.APPROVED ||
      row.disposition.status === DispositionStatus.EXECUTED
    );
  }, [classificationRows]);

  const activeRows = useMemo(() => {
    if (activeClassification === 'dashboard') {
      return writeOffRows;
    }
    if (activeClassification === 'deceased') {
      return classificationRows;
    }
    return activeTab === 'pending' ? pendingRows : officialRows;
  }, [activeClassification, writeOffRows, classificationRows, activeTab, pendingRows, officialRows]);

  // Cross-category Collector Comparison Data
  const collectorComparisonRows = useMemo<CollectorComparisonRow[]>(() => {
    const map = new Map<string, CollectorComparisonRow>();

    writeOffRows.forEach(row => {
      const collector = row.loan.collector || 'Unassigned';
      if (!map.has(collector)) {
        map.set(collector, {
          collector,
          located: createEmptyStats(),
          unlocated: createEmptyStats(),
          deceased: createEmptyStats(),
          total: createEmptyStats()
        });
      }
      const item = map.get(collector)!;
      if (row.classification === 'located') {
        addLoanToStats(item.located, row.loan);
      } else if (row.classification === 'unlocated') {
        addLoanToStats(item.unlocated, row.loan);
      } else if (row.classification === 'deceased') {
        addLoanToStats(item.deceased, row.loan);
      }
      addLoanToStats(item.total, row.loan);
    });

    return Array.from(map.values()).sort((a, b) => a.collector.localeCompare(b.collector));
  }, [writeOffRows]);

  const visibleCollectorRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return collectorComparisonRows.filter(row => {
      const matchesCollector = collectorFilter === 'All' || row.collector === collectorFilter;
      const matchesSearch = !term || row.collector.toLowerCase().includes(term);
      return matchesCollector && matchesSearch;
    });
  }, [collectorComparisonRows, collectorFilter, searchTerm]);

  const dashboardCategoryTotals = useMemo(() => {
    const initial = {
      located: createEmptyStats(),
      unlocated: createEmptyStats(),
      deceased: createEmptyStats(),
      total: createEmptyStats()
    };

    visibleCollectorRows.forEach(row => {
      (['located', 'unlocated', 'deceased', 'total'] as const).forEach(cat => {
        initial[cat].count += row[cat].count;
        initial[cat].principal += row[cat].principal;
        initial[cat].interest += row[cat].interest;
        initial[cat].totalLoan += row[cat].totalLoan;
        initial[cat].amountCollected += row[cat].amountCollected;
        initial[cat].balanceBeforeWriteOff += row[cat].balanceBeforeWriteOff;
        initial[cat].amountWriteOffOrDeceased += row[cat].amountWriteOffOrDeceased;
      });
    });

    return initial;
  }, [visibleCollectorRows]);

  const collectorOptions = useMemo(() => {
    const sourceRows = activeClassification === 'dashboard' ? writeOffRows : activeRows;
    return Array.from(new Set(sourceRows.map(row => row.loan.collector).filter(Boolean))).sort();
  }, [activeClassification, writeOffRows, activeRows]);

  useEffect(() => {
    if (collectorFilter !== 'All' && !collectorOptions.includes(collectorFilter)) {
      setCollectorFilter('All');
    }
  }, [collectorFilter, collectorOptions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'client' ? 'asc' : 'desc');
  };

  const getSortValue = (row: WriteOffRow) => {
    switch (sortKey) {
      case 'client':
        return row.loan.borrowerName.toLowerCase();
      case 'maturityDate':
        return new Date(row.loan.dueDate).getTime() || 0;
      case 'decisionDate':
        return new Date(row.disposition.decisionDate).getTime() || 0;
      case 'runningBalance':
        return row.loan.runningBalance || row.loan.outstandingBalance || 0;
      default:
        return 0;
    }
  };

  const filteredPendingRows = useMemo(() => {
    return pendingRows.filter(({ loan }) => collectorFilter === 'All' || loan.collector === collectorFilter);
  }, [pendingRows, collectorFilter]);

  const filteredOfficialRows = useMemo(() => {
    return officialRows.filter(({ loan }) => collectorFilter === 'All' || loan.collector === collectorFilter);
  }, [officialRows, collectorFilter]);

  const filteredDeceasedRows = useMemo(() => {
    return classificationRows.filter(({ loan }) => collectorFilter === 'All' || loan.collector === collectorFilter);
  }, [classificationRows, collectorFilter]);

  const visibleRows = activeRows.filter(({ loan }) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      loan.borrowerName.toLowerCase().includes(term) ||
      loan.code.toLowerCase().includes(term) ||
      loan.collector.toLowerCase().includes(term);
    const matchesCollector = collectorFilter === 'All' || loan.collector === collectorFilter;
    return matchesSearch && matchesCollector;
  }).sort((a, b) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return a.loan.borrowerName.localeCompare(b.loan.borrowerName);
  });

  const canApprove = canApproveWriteOff(currentUser.role);
  const activeFinancialTotals = useMemo(() => {
    return visibleRows.reduce((totals, row) => {
      const financials = getLoanFinancials(row.loan);
      totals.principal += financials.principal;
      totals.interest += financials.interest || 0;
      totals.totalLoan += financials.totalLoan;
      totals.amountCollected += financials.amountCollected;
      totals.balanceBeforeWriteOff += financials.balanceBeforeWriteOff;
      totals.amountWriteOffOrDeceased += financials.amountWriteOffOrDeceased;
      return totals;
    }, {
      principal: 0,
      interest: 0,
      totalLoan: 0,
      amountCollected: 0,
      balanceBeforeWriteOff: 0,
      amountWriteOffOrDeceased: 0
    });
  }, [visibleRows]);

  const approveWriteOff = async (row: WriteOffRow) => {
    if (!canApprove) {
      setApprovalWarningOpen(true);
      return;
    }

    setApprovingId(row.disposition.id);
    setFeedback(null);

    try {
      let dispositionId = row.disposition.id;
      if (row.disposition.id.startsWith('dead-auto-')) {
        const persistedDisposition = await store.addDisposition(
          row.loan.id,
          DispositionType.DEAD_ACCOUNT,
          row.disposition.reason,
          row.disposition.evidence || ['Deceased borrower'],
          row.disposition.decidedBy,
          currentUser.role
        );
        dispositionId = persistedDisposition.id;
      }
      await store.updateDispositionStatus(dispositionId, DispositionStatus.APPROVED, currentUser.username, currentUser.role);
      await store.updateLoan(
        row.loan.id,
        {
          ...row.loan,
          actionStage: 'For Write-Off',
          actionNote: `Officially Approved Write-Off (${row.classification.toUpperCase()}) by ${currentUser.fullName || currentUser.username} on ${formatDate(new Date().toISOString())}`
        },
        currentUser.username,
        currentUser.role
      );
      setFeedback({ type: 'success', message: `${row.loan.borrowerName} is now officially approved for write-off.` });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to approve write-off. Please try again.'
      });
    } finally {
      setApprovingId(null);
    }
  };

  const SortButton = ({ columnKey, label, align = 'left' }: { columnKey: SortKey; label: string; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => handleSort(columnKey)}
      className={`group inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'} transition-colors hover:text-slate-900 dark:hover:text-white`}
    >
      <span>{label}</span>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/50 text-[10px] transition-colors group-hover:bg-slate-200 dark:bg-slate-800 dark:group-hover:bg-slate-700 ${sortKey === columnKey ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50' : 'text-slate-400'}`}>
        {sortKey === columnKey ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );

  const getClassificationBadge = (classification: ClassificationType) => {
    switch (classification) {
      case 'located':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <span className="h-1 w-1 rounded-full bg-blue-500"></span> Located
          </span>
        );
      case 'unlocated':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <span className="h-1 w-1 rounded-full bg-amber-500"></span> Unlocated
          </span>
        );
      case 'deceased':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            <span className="h-1 w-1 rounded-full bg-purple-500"></span> Deceased
          </span>
        );
    }
  };

  const isDashboardTab = activeClassification === 'dashboard';
  const isDeceasedTab = activeClassification === 'deceased';
  const showActionColumn = !isDashboardTab && !isDeceasedTab && activeTab === 'pending';

  const DashboardView = () => (
    <div className="space-y-6">
      {/* 4 Summary Category Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Located */}
        <div className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-lg shadow-blue-500/5 dark:border-blue-900/40 dark:from-slate-900 dark:to-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-base dark:bg-blue-900/50">📍</span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">Located Write-Offs</h4>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {classificationCounts.located.pending} Pending · {classificationCounts.located.official} Official
                </div>
              </div>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              {dashboardCategoryTotals.located.count} Accts
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-blue-100/80 pt-3 dark:border-blue-900/30">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Total Loan:</span>
              <span className="font-black text-slate-800 dark:text-white">{compactCurrency(dashboardCategoryTotals.located.totalLoan)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Collected:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.located.amountCollected)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Write-Off:</span>
              <span className="font-black text-blue-600 dark:text-blue-400">{compactCurrency(dashboardCategoryTotals.located.amountWriteOffOrDeceased)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Unlocated */}
        <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-lg shadow-amber-500/5 dark:border-amber-900/40 dark:from-slate-900 dark:to-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-base dark:bg-amber-900/50">🔍</span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Unlocated Write-Offs</h4>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {classificationCounts.unlocated.pending} Pending · {classificationCounts.unlocated.official} Official
                </div>
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              {dashboardCategoryTotals.unlocated.count} Accts
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-amber-100/80 pt-3 dark:border-amber-900/30">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Total Loan:</span>
              <span className="font-black text-slate-800 dark:text-white">{compactCurrency(dashboardCategoryTotals.unlocated.totalLoan)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Collected:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.unlocated.amountCollected)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Write-Off:</span>
              <span className="font-black text-amber-600 dark:text-amber-400">{compactCurrency(dashboardCategoryTotals.unlocated.amountWriteOffOrDeceased)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Deceased Clients */}
        <div className="rounded-3xl border border-purple-200/60 bg-gradient-to-br from-purple-50/80 to-white p-5 shadow-lg shadow-purple-500/5 dark:border-purple-900/40 dark:from-slate-900 dark:to-purple-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-base dark:bg-purple-900/50">🕊️</span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">Deceased Clients</h4>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Settled / Intel Accounts
                </div>
              </div>
            </div>
            <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
              {dashboardCategoryTotals.deceased.count} Accts
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-purple-100/80 pt-3 dark:border-purple-900/30">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Total Loan:</span>
              <span className="font-black text-slate-800 dark:text-white">{compactCurrency(dashboardCategoryTotals.deceased.totalLoan)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Collected:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.deceased.amountCollected)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Amt. Deceased:</span>
              <span className="font-black text-purple-600 dark:text-purple-400">{compactCurrency(dashboardCategoryTotals.deceased.amountWriteOffOrDeceased)}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Overall Grand Total */}
        <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-5 text-white shadow-xl shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-base">📊</span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">Overall Grand Total</h4>
                <div className="text-[10px] font-bold text-slate-400">
                  All 3 Categories Combined
                </div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300 border border-emerald-500/30">
              {dashboardCategoryTotals.total.count} Accts
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-400">Total Loan:</span>
              <span className="font-black text-white">{compactCurrency(dashboardCategoryTotals.total.totalLoan)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-400">Amt. Collected:</span>
              <span className="font-black text-emerald-300">{compactCurrency(dashboardCategoryTotals.total.amountCollected)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-400">Total Write-Off / Deceased:</span>
              <span className="font-black text-purple-300">{compactCurrency(dashboardCategoryTotals.total.amountWriteOffOrDeceased)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collector Comparison Breakdown Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-xl shadow-slate-200/20 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-none">
        <div className="border-b border-slate-200/60 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
              <span>📊</span> Collector Breakdown &amp; Comparison Report
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Cross-category comparison of Located, Unlocated, and Deceased accounts per collector.
            </p>
          </div>
          <div className="text-xs font-bold text-slate-400">
            {visibleCollectorRows.length} Active Collector{visibleCollectorRows.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-100/90 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-300">
                <th rowSpan={2} className="px-4 py-3.5 text-left min-w-[160px] border-r border-slate-200/80 dark:border-slate-700/80">Collector</th>
                <th colSpan={3} className="px-3 py-2 text-center border-r border-blue-200/80 bg-blue-50/80 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300">📍 Located</th>
                <th colSpan={3} className="px-3 py-2 text-center border-r border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300">🔍 Unlocated</th>
                <th colSpan={3} className="px-3 py-2 text-center border-r border-purple-200/80 bg-purple-50/80 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/50 dark:text-purple-300">🕊️ Deceased Clients</th>
                <th colSpan={4} className="px-3 py-2 text-center bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">📊 Overall Total</th>
              </tr>
              <tr className="border-b border-slate-200/60 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-400">
                {/* Located */}
                <th className="px-3 py-2 text-center">Accts</th>
                <th className="px-3 py-2 text-right">Amt. Collected</th>
                <th className="px-3 py-2 text-right border-r border-slate-200/60 dark:border-slate-700/60">Amt. Write-Off</th>
                {/* Unlocated */}
                <th className="px-3 py-2 text-center">Accts</th>
                <th className="px-3 py-2 text-right">Amt. Collected</th>
                <th className="px-3 py-2 text-right border-r border-slate-200/60 dark:border-slate-700/60">Amt. Write-Off</th>
                {/* Deceased */}
                <th className="px-3 py-2 text-center">Accts</th>
                <th className="px-3 py-2 text-right">Amt. Collected</th>
                <th className="px-3 py-2 text-right border-r border-slate-200/60 dark:border-slate-700/60">Amt. Deceased</th>
                {/* Overall */}
                <th className="px-3 py-2 text-center">Total Accts</th>
                <th className="px-3 py-2 text-right">Total Loan</th>
                <th className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">Amt. Collected</th>
                <th className="px-3 py-2 text-right text-purple-600 dark:text-purple-400">Amt. Write-Off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleCollectorRows.map(row => (
                <tr key={row.collector} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  {/* Collector */}
                  <td className="px-4 py-3 font-black text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {row.collector.charAt(0)}
                      </div>
                      <span className="truncate">{row.collector}</span>
                    </div>
                  </td>
                  {/* Located */}
                  <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.located.count || '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{row.located.amountCollected > 0 ? compactCurrency(row.located.amountCollected) : '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">{row.located.amountWriteOffOrDeceased > 0 ? compactCurrency(row.located.amountWriteOffOrDeceased) : '—'}</td>
                  {/* Unlocated */}
                  <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.unlocated.count || '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{row.unlocated.amountCollected > 0 ? compactCurrency(row.unlocated.amountCollected) : '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-amber-700 dark:text-amber-400 border-r border-slate-100 dark:border-slate-800">{row.unlocated.amountWriteOffOrDeceased > 0 ? compactCurrency(row.unlocated.amountWriteOffOrDeceased) : '—'}</td>
                  {/* Deceased */}
                  <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.deceased.count || '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{row.deceased.amountCollected > 0 ? compactCurrency(row.deceased.amountCollected) : '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-purple-700 dark:text-purple-400 border-r border-slate-100 dark:border-slate-800">{row.deceased.amountWriteOffOrDeceased > 0 ? compactCurrency(row.deceased.amountWriteOffOrDeceased) : '—'}</td>
                  {/* Overall */}
                  <td className="px-3 py-3 text-center font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-950/20">{row.total.count}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950/20">{compactCurrency(row.total.totalLoan)}</td>
                  <td className="px-3 py-3 text-right font-black text-emerald-700 dark:text-emerald-300 bg-slate-50/50 dark:bg-slate-950/20">{compactCurrency(row.total.amountCollected)}</td>
                  <td className="px-3 py-3 text-right font-black text-purple-700 dark:text-purple-300 bg-slate-50/50 dark:bg-slate-950/20">{compactCurrency(row.total.amountWriteOffOrDeceased)}</td>
                </tr>
              ))}
              {visibleCollectorRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                    No collectors found matching the current filter.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 text-slate-900 font-black dark:border-slate-700 dark:bg-slate-950/90 dark:text-white">
              <tr>
                <td className="px-4 py-3.5 uppercase tracking-wider text-xs border-r border-slate-300 dark:border-slate-700">
                  Overall Total
                </td>
                {/* Located */}
                <td className="px-3 py-3.5 text-center text-xs">{dashboardCategoryTotals.located.count}</td>
                <td className="px-3 py-3.5 text-right text-xs text-emerald-700 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.located.amountCollected)}</td>
                <td className="px-3 py-3.5 text-right text-xs text-blue-700 dark:text-blue-400 border-r border-slate-300 dark:border-slate-700">{compactCurrency(dashboardCategoryTotals.located.amountWriteOffOrDeceased)}</td>
                {/* Unlocated */}
                <td className="px-3 py-3.5 text-center text-xs">{dashboardCategoryTotals.unlocated.count}</td>
                <td className="px-3 py-3.5 text-right text-xs text-emerald-700 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.unlocated.amountCollected)}</td>
                <td className="px-3 py-3.5 text-right text-xs text-amber-700 dark:text-amber-400 border-r border-slate-300 dark:border-slate-700">{compactCurrency(dashboardCategoryTotals.unlocated.amountWriteOffOrDeceased)}</td>
                {/* Deceased */}
                <td className="px-3 py-3.5 text-center text-xs">{dashboardCategoryTotals.deceased.count}</td>
                <td className="px-3 py-3.5 text-right text-xs text-emerald-700 dark:text-emerald-400">{compactCurrency(dashboardCategoryTotals.deceased.amountCollected)}</td>
                <td className="px-3 py-3.5 text-right text-xs text-purple-700 dark:text-purple-400 border-r border-slate-300 dark:border-slate-700">{compactCurrency(dashboardCategoryTotals.deceased.amountWriteOffOrDeceased)}</td>
                {/* Overall */}
                <td className="px-3 py-3.5 text-center text-xs bg-slate-200/60 dark:bg-slate-900/60">{dashboardCategoryTotals.total.count}</td>
                <td className="px-3 py-3.5 text-right text-xs bg-slate-200/60 dark:bg-slate-900/60">{compactCurrency(dashboardCategoryTotals.total.totalLoan)}</td>
                <td className="px-3 py-3.5 text-right text-xs text-emerald-700 dark:text-emerald-300 bg-slate-200/60 dark:bg-slate-900/60">{compactCurrency(dashboardCategoryTotals.total.amountCollected)}</td>
                <td className="px-3 py-3.5 text-right text-xs text-purple-700 dark:text-purple-300 bg-slate-200/60 dark:bg-slate-900/60">{compactCurrency(dashboardCategoryTotals.total.amountWriteOffOrDeceased)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const RowTable = ({ rows }: { rows: WriteOffRow[] }) => (
    <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-xl shadow-slate-200/20 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-md dark:bg-slate-950/60 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
            <tr>
              <th className="px-4 py-3.5 whitespace-nowrap min-w-[200px]"><SortButton columnKey="client" label="Client" /></th>
              <th className="px-3 py-3.5 whitespace-nowrap min-w-[120px]">Collector</th>
              <th className="px-3 py-3.5 whitespace-nowrap min-w-[100px]"><SortButton columnKey="maturityDate" label="Maturity" /></th>
              <th className="px-3 py-3.5 whitespace-nowrap min-w-[100px]"><SortButton columnKey="decisionDate" label={isDeceasedTab ? 'Reported Date' : 'Decision'} /></th>
              <th className="px-3 py-3.5 min-w-[180px]">Reason / Intel</th>
              <th className="px-3 py-3.5 whitespace-nowrap min-w-[120px]">Officer</th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[100px]">Principal</th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[100px]">Interest</th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[100px]">Total Loan</th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[110px]">Amt. Collected</th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[110px]"><SortButton columnKey="runningBalance" label="Balance" align="right" /></th>
              <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[130px]">{isDeceasedTab ? 'Amt. Deceased' : 'Amt. Write-Off'}</th>
              <th className="px-3 py-3.5 text-center whitespace-nowrap min-w-[90px]">Status</th>
              {showActionColumn && <th className="px-3 py-3.5 text-right whitespace-nowrap min-w-[90px]">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(row => {
              const financials = getLoanFinancials(row.loan);
              return (
              <tr key={row.disposition.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/20 ring-1 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black text-xs">
                      {row.loan.borrowerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black text-slate-900 dark:text-white transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400" title={row.loan.borrowerName}>{row.loan.borrowerName}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">ID: {row.loan.code}</span>
                        {getClassificationBadge(row.classification)}
                        {row.disposition.status === DispositionStatus.APPROVED && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <span className="mr-1 h-1 w-1 rounded-full bg-emerald-500"></span> Approved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <svg className="h-3 w-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{row.loan.collector}</span>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatDate(row.loan.dueDate)}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Maturity</span>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatDate(row.disposition.decisionDate)}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{isDeceasedTab ? 'Reported' : 'Decision'}</span>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-normal">
                  <div className="line-clamp-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200" title={row.disposition.reason}>
                    {row.disposition.reason}
                  </div>
                  {row.disposition.evidence && row.disposition.evidence.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1" title={`Supporting evidence: ${row.disposition.evidence.join(', ')}`}>
                      {row.disposition.evidence.map((evidence, evidenceIndex) => (
                        <span key={`${evidence}-${evidenceIndex}`} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400">
                          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {evidence}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {(row.disposition.decidedBy || 'S').charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200" title={row.disposition.decidedBy}>{row.disposition.decidedBy}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-slate-600 dark:text-slate-300">{row.loan.principal == null ? '—' : compactCurrency(financials.principal)}</div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-cyan-700 dark:text-cyan-300">{financials.interest == null ? '—' : compactCurrency(financials.interest)}</div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-slate-700 dark:text-slate-200">{compactCurrency(financials.totalLoan)}</div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">{compactCurrency(financials.amountCollected)}</div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black text-slate-900 dark:text-white tabular-nums tracking-tight">{compactCurrency(financials.balanceBeforeWriteOff)}</div>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="text-[11px] font-black text-purple-700 dark:text-purple-300 tabular-nums tracking-tight">{compactCurrency(financials.amountWriteOffOrDeceased)}</div>
                </td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  {isDeceasedTab ? (
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-500/20 dark:bg-purple-900/20 dark:text-purple-300 dark:ring-purple-500/30 shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                      Deceased
                    </span>
                  ) : (
                    <span className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow-sm ring-1 ring-inset ${
                      row.disposition.status === DispositionStatus.PENDING_REVIEW
                        ? 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${row.disposition.status === DispositionStatus.PENDING_REVIEW ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                      {row.disposition.status === DispositionStatus.PENDING_REVIEW ? 'Pending' : 'Approved'}
                    </span>
                  )}
                </td>
                {showActionColumn && (
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={approvingId === row.disposition.id}
                      onClick={() => approveWriteOff(row)}
                      className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-slate-900 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                        <div className="relative h-full w-8 bg-white/20" />
                      </div>
                      <span className="relative z-10 flex items-center gap-1.5">
                        {approvingId === row.disposition.id ? (
                          <>
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </>
                        )}
                      </span>
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showActionColumn ? 14 : 13} className="px-4 py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No {isDeceasedTab ? 'deceased' : activeClassification} accounts found
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      There are no {isDeceasedTab ? 'deceased' : activeClassification} write-off records matching your selected filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {isDashboardTab ? 'Executive Overview' : 'Management Approval'}
            </div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
              {isDashboardTab ? 'Write-Off Dashboard' : 'Write-Off Center'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              {isDashboardTab
                ? 'Comprehensive summary and collector comparison across Located, Unlocated, and Deceased clients.'
                : <>Review and finalize write-offs categorized by <span className="text-blue-400 font-bold">Located</span>, <span className="text-amber-400 font-bold">Unlocated</span>, and <span className="text-purple-400 font-bold">Deceased Clients</span>.</>
              }
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
            {isDashboardTab ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-300/80">Located</div>
                  <div className="mt-1 text-xl font-black text-white">{classificationCounts.located.total}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300/80">Unlocated</div>
                  <div className="mt-1 text-xl font-black text-white">{classificationCounts.unlocated.total}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-purple-300/80">Deceased</div>
                  <div className="mt-1 text-xl font-black text-white">{classificationCounts.deceased.total}</div>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Total Accts</div>
                  <div className="mt-1 text-xl font-black text-emerald-300">{writeOffRows.length}</div>
                </div>
              </>
            ) : isDeceasedTab ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-300/80">Deceased Clients</div>
                <div className="mt-1 text-2xl font-black text-white">{filteredDeceasedRows.length}</div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300/80">Pending Review</div>
                  <div className="mt-1 text-2xl font-black text-white">{filteredPendingRows.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300/80">Official</div>
                  <div className="mt-1 text-2xl font-black text-white">{filteredOfficialRows.length}</div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Total Principal', value: activeFinancialTotals.principal, color: 'text-cyan-200' },
            { label: 'Total Interest', value: activeFinancialTotals.interest, color: 'text-sky-200' },
            { label: 'Total Loan', value: activeFinancialTotals.totalLoan, color: 'text-blue-200' },
            { label: 'Amt. Collected', value: activeFinancialTotals.amountCollected, color: 'text-emerald-200' },
            { label: 'Balance Before Write-Off', value: activeFinancialTotals.balanceBeforeWriteOff, color: 'text-amber-200' },
            { label: isDeceasedTab ? 'Amt. Deceased' : 'Amt. Write-Off', value: activeFinancialTotals.amountWriteOffOrDeceased, color: 'text-purple-200' }
          ].map(metric => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{metric.label}</div>
              <div className={`mt-2 text-base font-black tabular-nums ${metric.color}`}>{currency(metric.value)}</div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                {isDashboardTab
                  ? (collectorFilter !== 'All' ? `All Categories · ${collectorFilter}` : 'All Categories Combined')
                  : isDeceasedTab
                  ? (collectorFilter !== 'All' ? `Deceased Clients · ${collectorFilter}` : 'Deceased Clients')
                  : `${activeTab === 'pending' ? 'Pending Review' : 'Official'} · ${activeClassification}${collectorFilter !== 'All' ? ` · ${collectorFilter}` : ''}`}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CLASSIFICATION TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2 rounded-3xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1">
          <button
            type="button"
            onClick={() => setActiveClassification('dashboard')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
              activeClassification === 'dashboard'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 text-xs">
              📊
            </span>
            <span>Dashboard</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeClassification === 'dashboard'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {writeOffRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveClassification('located')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
              activeClassification === 'located'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs">
              📍
            </span>
            <span>Located</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeClassification === 'located'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {classificationCounts.located.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveClassification('unlocated')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
              activeClassification === 'unlocated'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 text-xs">
              🔍
            </span>
            <span>Unlocated</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeClassification === 'unlocated'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {classificationCounts.unlocated.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveClassification('deceased')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
              activeClassification === 'deceased'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-xs">
              🕊️
            </span>
            <span>Deceased Clients</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeClassification === 'deceased'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {classificationCounts.deceased.total}
            </span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-3 py-1">
          Viewing: <span className="font-black text-slate-800 dark:text-white capitalize">{isDashboardTab ? 'Executive Dashboard & Collector Comparison' : isDeceasedTab ? 'Deceased Clients' : `${activeClassification} Accounts`}</span>
        </div>
      </div>

      {feedback && (
        <div className={`flex animate-in fade-in slide-in-from-top-4 items-center gap-3 rounded-2xl border p-4 shadow-lg ${
          feedback.type === 'success'
            ? 'border-emerald-200/50 bg-emerald-50/80 text-emerald-800 backdrop-blur-sm dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-rose-200/50 bg-rose-50/80 text-rose-800 backdrop-blur-sm dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
             <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* SUB-BAR: Pending / Official Tabs & Filter Controls */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/60 p-2 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 md:flex-row md:items-center md:justify-between">
        {isDashboardTab ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Collector Comparison Summary ({visibleCollectorRows.length} Collector{visibleCollectorRows.length !== 1 ? 's' : ''})
            </span>
          </div>
        ) : isDeceasedTab ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-purple-500"></span>
            <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Deceased Accounts ({filteredDeceasedRows.length})
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`relative rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'pending' 
                  ? 'bg-white text-amber-600 shadow-md dark:bg-slate-700 dark:text-amber-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Pending Review
              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>{filteredPendingRows.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('official')}
              className={`relative rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'official' 
                  ? 'bg-white text-emerald-600 shadow-md dark:bg-slate-700 dark:text-emerald-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Officially Approved
              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${
                activeTab === 'official' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>{filteredOfficialRows.length}</span>
            </button>
          </div>
        )}
        
        <div className={`flex w-full flex-col gap-2 px-1 md:w-auto md:flex-row md:items-center ${isDeceasedTab || isDashboardTab ? 'md:ml-auto' : ''}`}>
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <select
              value={collectorFilter}
              onChange={event => setCollectorFilter(event.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white md:w-52 shadow-sm"
            >
              <option value="All">All Collectors</option>
              {collectorOptions.map(collector => (
                <option key={collector} value={collector}>{collector}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
            </div>
          </div>
          
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search client, code..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white md:w-64 shadow-sm placeholder:font-medium placeholder:text-slate-400"
            />
          </div>
          
          <button
            type="button"
            onClick={() => { setSortKey('decisionDate'); setSortDirection('desc'); }}
            className={`flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold transition-all shadow-sm
              ${(sortKey !== 'decisionDate' || sortDirection !== 'desc')
                ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:border-slate-700 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-slate-800'
                : 'text-slate-400 opacity-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600'}
            `}
            disabled={sortKey === 'decisionDate' && sortDirection === 'desc'}
            title="Clear sorting to default"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Sort
          </button>
        </div>
      </div>

      {isDashboardTab ? <DashboardView /> : <RowTable rows={visibleRows} />}

      <ConfirmationModal
        isOpen={approvalWarningOpen}
        title="Approval Restricted"
        message="Sorry! Only the Executive Vice President can Approve Clients"
        onConfirm={() => setApprovalWarningOpen(false)}
        onCancel={() => setApprovalWarningOpen(false)}
        type="warning"
        confirmLabel="OK"
        cancelLabel=""
      />
    </div>
  );
};

export default WriteOff;
