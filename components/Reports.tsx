import React, { useState, useEffect, useMemo } from 'react';
import { store } from '../services/dataStore';
import { Branch, CollectorPerformanceClientDetail, DispositionType, DispositionStatus, ManagementDisposition, Loan, PaymentStatus } from '../types';
import MonthlyPerformance from './MonthlyPerformance';
import AgingReport from './AgingReport';
import DeadWriteOffReport from './DeadWriteOffReport';
import ReconstructedReport from './ReconstructedReport';
import { isReportableCollectionPayment, isReconstructedPaymentRemark } from '../services/loanUtils';

interface ReportsProps {
  selectedBranch: Branch;
  activeView?: 'performance' | 'monthly-performance' | 'aging' | 'dead-write-off' | 'reconstructed';
}

interface CategoryStatusBreakdown {
  count: number;
  amount: number;
  pending: { count: number; amount: number };
  official: { count: number; amount: number };
}

interface CollectorModuleStats {
  located: CategoryStatusBreakdown;
  unlocated: CategoryStatusBreakdown;
  deceased: { count: number; amount: number };
  reconstructed: { count: number; amount: number };
  totalWriteOff: { count: number; amount: number };
}

interface CombinedCollectorEfficiencyRow {
  collector: string;
  totalAccounts: number;
  activeAccountCount: number;
  reportedAmount: number;
  collectedAmount: number;
  runningBalance: number;
  collectionRate: number;
  reconstructed: { count: number; amount: number };
  located: CategoryStatusBreakdown;
  unlocated: CategoryStatusBreakdown;
  deceased: { count: number; amount: number };
  totalWriteOff: { count: number; amount: number };
}

const isWriteOffOrDeceasedPaymentRemark = (remarks?: string) =>
  /\b(deceased|dead|write[-\s]?off)\b/i.test(remarks || '');

const calculateWriteOffFinancials = (loan: Loan) => {
  const totalLoan = Number(loan.totalLoan || loan.outstandingBalance || loan.runningBalance || 0);
  const activePayments = (loan.payments || []).filter(payment => payment.status !== PaymentStatus.REVERSED);
  const activePaymentTotal = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const sourceCollectedAdjustment = Math.max(0, Number(loan.amountCollected || 0) - activePaymentTotal);
  const cashPaymentTotal = activePayments
    .filter(isReportableCollectionPayment)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amountCollected = sourceCollectedAdjustment + cashPaymentTotal;
  const balanceBeforeWriteOff = Math.max(0, totalLoan - amountCollected);
  const recordedOutcomeAmount = activePayments
    .filter(payment => isWriteOffOrDeceasedPaymentRemark(payment.remarks))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amountWriteOffOrDeceased = recordedOutcomeAmount > 0
    ? Math.min(balanceBeforeWriteOff, recordedOutcomeAmount)
    : balanceBeforeWriteOff;

  return { totalLoan, amountCollected, amountWriteOffOrDeceased };
};

const getCollectorModuleStats = (
  branch: Branch,
  yearRange?: { from: number; to: number }
): Record<string, CollectorModuleStats> => {
  const loans = store.getLoans ? store.getLoans(branch) : [];
  const dispositions = store.getAllDispositions ? store.getAllDispositions() : [];
  const deadLoans = store.getDeadWriteOffs ? store.getDeadWriteOffs(branch) : [];

  const loansById = new Map<string, Loan>(loans.map(l => [l.id, l]));
  const latestProspectByLoan = new Map<string, ManagementDisposition>();

  dispositions
    .filter(d => d.type === DispositionType.PROSPECT_WRITE_OFF || d.type === DispositionType.DEAD_ACCOUNT)
    .forEach(d => {
      if (!latestProspectByLoan.has(d.loanId)) {
        latestProspectByLoan.set(d.loanId, d);
      }
    });

  deadLoans.forEach(deadLoan => {
    if (!latestProspectByLoan.has(deadLoan.id)) {
      const deadIntel = deadLoan.remarks?.find(r => /\b(dead|deceased)\b/i.test(r.text));
      const deadPayment = deadLoan.payments?.find(p => p.remarks && /\b(dead|deceased)\b/i.test(p.remarks));
      let reason = 'Deceased borrower (Full Settlement)';
      if (deadPayment?.remarks) reason = `[Payment] ${deadPayment.remarks}`;
      else if (deadIntel?.text) reason = deadIntel.text;
      else if (deadLoan.remarks?.length) reason = deadLoan.remarks[deadLoan.remarks.length - 1].text;

      const date = deadLoan.lastPaidDate ||
        (deadLoan.payments?.length ? deadLoan.payments[deadLoan.payments.length - 1].date : null) ||
        (deadIntel ? deadIntel.timestamp : new Date().toISOString());

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

  const stats: Record<string, CollectorModuleStats> = {};

  const initStats = (coll: string) => {
    if (!stats[coll]) {
      stats[coll] = {
        located: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
        unlocated: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
        deceased: { count: 0, amount: 0 },
        reconstructed: { count: 0, amount: 0 },
        totalWriteOff: { count: 0, amount: 0 }
      };
    }
  };

  // 1. Write-off statistics
  latestProspectByLoan.forEach((disposition, loanId) => {
    const loan = loansById.get(loanId);
    if (!loan) return;

    if (yearRange) {
      const reportedYear = Number((loan.monthReported || '').slice(0, 4));
      if (!reportedYear || reportedYear < yearRange.from || reportedYear > yearRange.to) return;
    }

    const collRaw = store.getCollectorDisplayName ? store.getCollectorDisplayName(loan.collector) : loan.collector;
    const coll = (collRaw || 'UNASSIGNED').toUpperCase().trim();
    if (!coll || coll === 'N/A' || coll === 'UNDEFINED') return;

    initStats(coll);

    const isDeceased =
      disposition.type === DispositionType.DEAD_ACCOUNT ||
      (disposition.evidence || []).includes('Deceased borrower') ||
      /\b(dead|deceased)\b/i.test(disposition.reason || '') ||
      loan.remarks?.some(r => /\b(dead|deceased)\b/i.test(r.text)) ||
      loan.payments?.some(p => p.remarks && /\b(dead|deceased)\b/i.test(p.remarks)) ||
      (store.isDeadWriteOff && store.isDeadWriteOff(loan));

    const isUnlocated = !isDeceased && (
      disposition.writeOffClassification === 'Unlocated' ||
      (disposition.evidence || []).includes('Relocated/Not located')
    );

    const isLocated = !isDeceased && !isUnlocated;
    const isOfficial = disposition.status === DispositionStatus.APPROVED || disposition.status === DispositionStatus.EXECUTED;

    const fin = calculateWriteOffFinancials(loan);

    if (isDeceased) {
      stats[coll].deceased.count += 1;
      stats[coll].deceased.amount += fin.amountWriteOffOrDeceased;
    } else if (isUnlocated) {
      stats[coll].unlocated.count += 1;
      stats[coll].unlocated.amount += fin.amountWriteOffOrDeceased;
      if (isOfficial) {
        stats[coll].unlocated.official.count += 1;
        stats[coll].unlocated.official.amount += fin.amountWriteOffOrDeceased;
      } else {
        stats[coll].unlocated.pending.count += 1;
        stats[coll].unlocated.pending.amount += fin.amountWriteOffOrDeceased;
      }
    } else if (isLocated) {
      stats[coll].located.count += 1;
      stats[coll].located.amount += fin.amountWriteOffOrDeceased;
      if (isOfficial) {
        stats[coll].located.official.count += 1;
        stats[coll].located.official.amount += fin.amountWriteOffOrDeceased;
      } else {
        stats[coll].located.pending.count += 1;
        stats[coll].located.pending.amount += fin.amountWriteOffOrDeceased;
      }
    }

    stats[coll].totalWriteOff.count += 1;
    stats[coll].totalWriteOff.amount += fin.amountWriteOffOrDeceased;
  });

  // 2. Reconstructed statistics from loans
  loans.forEach(loan => {
    if (yearRange) {
      const reportedYear = Number((loan.monthReported || '').slice(0, 4));
      if (!reportedYear || reportedYear < yearRange.from || reportedYear > yearRange.to) return;
    }

    const collRaw = store.getCollectorDisplayName ? store.getCollectorDisplayName(loan.collector) : loan.collector;
    const coll = (collRaw || 'UNASSIGNED').toUpperCase().trim();
    if (!coll || coll === 'N/A' || coll === 'UNDEFINED') return;

    let reconLoanTotal = 0;
    let hasReconPayment = false;

    (loan.payments || []).forEach(p => {
      if (p.status !== PaymentStatus.REVERSED && isReconstructedPaymentRemark(p.remarks)) {
        reconLoanTotal += Number(p.amount || 0);
        hasReconPayment = true;
      }
    });

    if (hasReconPayment || reconLoanTotal > 0) {
      initStats(coll);
      stats[coll].reconstructed.count += 1;
      stats[coll].reconstructed.amount += reconLoanTotal;
    }
  });

  return stats;
};

const Reports: React.FC<ReportsProps> = ({ selectedBranch, activeView }) => {
  const yearlyPeriods = [
    { id: '2016-2024', label: '2016-2024', from: 2016, to: 2024 },
    { id: '2025', label: '2025', from: 2025, to: 2025 },
    { id: '2026', label: '2026', from: 2026, to: 2026 }
  ];
  const [performanceScope, setPerformanceScope] = useState<'overall' | 'yearly'>('overall');
  const [selectedYearlyPeriod, setSelectedYearlyPeriod] = useState(yearlyPeriods[0].id);
  const [selectedYearlyCollector, setSelectedYearlyCollector] = useState<string | null>(null);
  const [collectorData, setCollectorData] = useState(store.getCollectorPerformance(selectedBranch));
  const activeReport = activeView || 'performance';
  const activeYearlyPeriod = yearlyPeriods.find(period => period.id === selectedYearlyPeriod) || yearlyPeriods[0];
  const [yearlyCollectorData, setYearlyCollectorData] = useState(
    store.getCollectorPerformance(selectedBranch, { from: activeYearlyPeriod.from, to: activeYearlyPeriod.to })
  );
  const getActiveAccountCount = (p: { totalAccounts: number; activeAccountCount?: number; paidCount?: number }) =>
    p.activeAccountCount ?? Math.max(0, p.totalAccounts - (p.paidCount || 0));

  useEffect(() => {
    setCollectorData(store.getCollectorPerformance(selectedBranch));
    setYearlyCollectorData(store.getCollectorPerformance(selectedBranch, { from: activeYearlyPeriod.from, to: activeYearlyPeriod.to }));
    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      setCollectorData(store.getCollectorPerformance(selectedBranch));
      setYearlyCollectorData(store.getCollectorPerformance(selectedBranch, { from: activeYearlyPeriod.from, to: activeYearlyPeriod.to }));
    });
    return () => unsubscribe();
  }, [selectedBranch, activeYearlyPeriod.from, activeYearlyPeriod.to]);

  const activeCollectorData = performanceScope === 'yearly' ? yearlyCollectorData : collectorData;
  const matrixTitle = performanceScope === 'yearly' ? 'Yearly Collector Efficiency Matrix' : 'Collector Efficiency Matrix';
  const matrixSubtitle = performanceScope === 'yearly'
    ? `Reported accounts for ${activeYearlyPeriod.label}: ${selectedBranch}`
    : `Real-time stats for: ${selectedBranch}`;
  const exportScopeLabel = performanceScope === 'yearly' ? activeYearlyPeriod.label : 'Overall';
  const selectedCollectorSummary = selectedYearlyCollector
    ? yearlyCollectorData.find(p => p.collector === selectedYearlyCollector) || null
    : null;
  const selectedCollectorClients: CollectorPerformanceClientDetail[] = selectedYearlyCollector
    ? store.getCollectorPerformanceDetails(selectedBranch, selectedYearlyCollector, { from: activeYearlyPeriod.from, to: activeYearlyPeriod.to })
    : [];

  const activeModuleStats = useMemo(() => {
    return getCollectorModuleStats(
      selectedBranch,
      performanceScope === 'yearly' ? { from: activeYearlyPeriod.from, to: activeYearlyPeriod.to } : undefined
    );
  }, [selectedBranch, performanceScope, activeYearlyPeriod.from, activeYearlyPeriod.to]);

  const combinedData = useMemo<CombinedCollectorEfficiencyRow[]>(() => {
    const map = new Map<string, CombinedCollectorEfficiencyRow>();

    const emptyLocated: CategoryStatusBreakdown = { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } };
    const emptyUnlocated: CategoryStatusBreakdown = { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } };

    // 1. Add standard collector data
    activeCollectorData.forEach(p => {
      const key = p.collector.toUpperCase().trim();
      const mod = activeModuleStats[key] || {
        located: emptyLocated,
        unlocated: emptyUnlocated,
        deceased: { count: 0, amount: 0 },
        reconstructed: { count: 0, amount: 0 },
        totalWriteOff: { count: 0, amount: 0 }
      };
      map.set(key, {
        collector: p.collector,
        totalAccounts: p.totalAccounts,
        activeAccountCount: getActiveAccountCount(p),
        reportedAmount: p.reportedAmount,
        collectedAmount: p.collectedAmount,
        runningBalance: p.runningBalance,
        collectionRate: p.collectionRate,
        reconstructed: mod.reconstructed,
        located: mod.located,
        unlocated: mod.unlocated,
        deceased: mod.deceased,
        totalWriteOff: mod.totalWriteOff
      });
    });

    // 2. Add collectors that might only have module entries
    Object.keys(activeModuleStats).forEach(key => {
      if (!map.has(key)) {
        const mod = activeModuleStats[key];
        map.set(key, {
          collector: key,
          totalAccounts: mod.totalWriteOff.count + mod.reconstructed.count,
          activeAccountCount: 0,
          reportedAmount: 0,
          collectedAmount: 0,
          runningBalance: 0,
          collectionRate: 0,
          reconstructed: mod.reconstructed,
          located: mod.located,
          unlocated: mod.unlocated,
          deceased: mod.deceased,
          totalWriteOff: mod.totalWriteOff
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // 1. Efficiency Rate (Descending)
      if (b.collectionRate !== a.collectionRate) {
        return b.collectionRate - a.collectionRate;
      }
      // 2. Actual Collected (Descending)
      if (b.collectedAmount !== a.collectedAmount) {
        return b.collectedAmount - a.collectedAmount;
      }
      // 3. Reconstructed Amount (Descending)
      if (b.reconstructed.amount !== a.reconstructed.amount) {
        return b.reconstructed.amount - a.reconstructed.amount;
      }
      // 4. Total Write-Off Amount (Descending)
      if (b.totalWriteOff.amount !== a.totalWriteOff.amount) {
        return b.totalWriteOff.amount - a.totalWriteOff.amount;
      }
      // 5. Collector Name (Ascending)
      return a.collector.localeCompare(b.collector);
    });
  }, [activeCollectorData, activeModuleStats]);

  const grandTotals = useMemo(() => {
    return combinedData.reduce(
      (acc, row) => ({
        totalAccounts: acc.totalAccounts + row.totalAccounts,
        activeAccounts: acc.activeAccounts + row.activeAccountCount,
        reportedAmount: acc.reportedAmount + row.reportedAmount,
        collectedAmount: acc.collectedAmount + row.collectedAmount,
        runningBalance: acc.runningBalance + row.runningBalance,
        reconstructed: {
          count: acc.reconstructed.count + row.reconstructed.count,
          amount: acc.reconstructed.amount + row.reconstructed.amount
        },
        located: {
          count: acc.located.count + row.located.count,
          amount: acc.located.amount + row.located.amount,
          pending: {
            count: acc.located.pending.count + row.located.pending.count,
            amount: acc.located.pending.amount + row.located.pending.amount
          },
          official: {
            count: acc.located.official.count + row.located.official.count,
            amount: acc.located.official.amount + row.located.official.amount
          }
        },
        unlocated: {
          count: acc.unlocated.count + row.unlocated.count,
          amount: acc.unlocated.amount + row.unlocated.amount,
          pending: {
            count: acc.unlocated.pending.count + row.unlocated.pending.count,
            amount: acc.unlocated.pending.amount + row.unlocated.pending.amount
          },
          official: {
            count: acc.unlocated.official.count + row.unlocated.official.count,
            amount: acc.unlocated.official.amount + row.unlocated.official.amount
          }
        },
        deceased: {
          count: acc.deceased.count + row.deceased.count,
          amount: acc.deceased.amount + row.deceased.amount
        },
        totalWriteOff: {
          count: acc.totalWriteOff.count + row.totalWriteOff.count,
          amount: acc.totalWriteOff.amount + row.totalWriteOff.amount
        }
      }),
      {
        totalAccounts: 0,
        activeAccounts: 0,
        reportedAmount: 0,
        collectedAmount: 0,
        runningBalance: 0,
        reconstructed: { count: 0, amount: 0 },
        located: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
        unlocated: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
        deceased: { count: 0, amount: 0 },
        totalWriteOff: { count: 0, amount: 0 }
      }
    );
  }, [combinedData]);

  const grandTotalEfficiency = grandTotals.reportedAmount > 0
    ? (grandTotals.collectedAmount / grandTotals.reportedAmount) * 100
    : 0;

  const handleExport = () => {
    const headers = [
      'Collector Identity',
      'Total Accounts',
      'Active Accounts',
      'Target',
      'Collected',
      'Balance',
      'Efficiency Rate (%)',
      'Reconstructed Accts',
      'Reconstructed Amt',
      'Located Pending Accts',
      'Located Pending Amt',
      'Located Approved Accts',
      'Located Approved Amt',
      'Located Total Accts',
      'Located Total Amt',
      'Unlocated Pending Accts',
      'Unlocated Pending Amt',
      'Unlocated Approved Accts',
      'Unlocated Approved Amt',
      'Unlocated Total Accts',
      'Unlocated Total Amt',
      'Deceased Accts',
      'Deceased Amt',
      'Total Write-Off Accts',
      'Total Write-Off Amt'
    ];
    
    const rows = combinedData.map(p => [
      `"${p.collector}"`,
      p.totalAccounts,
      p.activeAccountCount,
      p.reportedAmount,
      p.collectedAmount,
      p.runningBalance,
      p.collectionRate.toFixed(1),
      p.reconstructed.count,
      p.reconstructed.amount,
      p.located.pending.count,
      p.located.pending.amount,
      p.located.official.count,
      p.located.official.amount,
      p.located.count,
      p.located.amount,
      p.unlocated.pending.count,
      p.unlocated.pending.amount,
      p.unlocated.official.count,
      p.unlocated.official.amount,
      p.unlocated.count,
      p.unlocated.amount,
      p.deceased.count,
      p.deceased.amount,
      p.totalWriteOff.count,
      p.totalWriteOff.amount
    ]);

    const grandTotalRow = [
      '"GRAND TOTAL"',
      grandTotals.totalAccounts,
      grandTotals.activeAccounts,
      grandTotals.reportedAmount,
      grandTotals.collectedAmount,
      grandTotals.runningBalance,
      grandTotalEfficiency.toFixed(1),
      grandTotals.reconstructed.count,
      grandTotals.reconstructed.amount,
      grandTotals.located.pending.count,
      grandTotals.located.pending.amount,
      grandTotals.located.official.count,
      grandTotals.located.official.amount,
      grandTotals.located.count,
      grandTotals.located.amount,
      grandTotals.unlocated.pending.count,
      grandTotals.unlocated.pending.amount,
      grandTotals.unlocated.official.count,
      grandTotals.unlocated.official.amount,
      grandTotals.unlocated.count,
      grandTotals.unlocated.amount,
      grandTotals.deceased.count,
      grandTotals.deceased.amount,
      grandTotals.totalWriteOff.count,
      grandTotals.totalWriteOff.amount
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      grandTotalRow.join(',')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Collector_Efficiency_${exportScopeLabel.replace(/\s+/g, '_')}_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2.5 animate-fadeIn">
      {activeReport === 'performance' ? (
        <>
        {/* Full-Width Matrix Section with Integrated Reconstructed and Write-Off Module Reports */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col w-full">
          <div className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{matrixTitle}</h3>
              <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {matrixSubtitle.includes(':') ? (
                  <>
                    {matrixSubtitle.split(':')[0]}: <span className="font-semibold text-slate-700 dark:text-slate-300">{matrixSubtitle.split(':').slice(1).join(':').trim()}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{matrixSubtitle}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-0.5 shadow-xs">
                {[
                  { id: 'overall', label: 'Overall Report' },
                  { id: 'yearly', label: 'Yearly Report' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPerformanceScope(tab.id as 'overall' | 'yearly');
                      setSelectedYearlyCollector(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
                      performanceScope === tab.id
                        ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-900/20'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {performanceScope === 'yearly' && (
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-0.5 shadow-xs">
                  {yearlyPeriods.map(period => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => {
                        setSelectedYearlyPeriod(period.id);
                        setSelectedYearlyCollector(null);
                      }}
                      className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors ${
                        selectedYearlyPeriod === period.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              )}

              <button 
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors shrink-0 shadow-xs"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Report
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="sticky top-0 z-10 text-[9px] font-black uppercase tracking-wider">
                {/* Group Header Row */}
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300">
                  <th rowSpan={2} className="px-2.5 py-1 text-left min-w-[130px] border-r border-slate-200 dark:border-slate-700">
                    Collector Identity
                  </th>
                  <th colSpan={5} className="px-2 py-1 text-center border-r border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    📈 Collection Performance
                  </th>
                  <th colSpan={1} className="px-2 py-1 text-center border-r border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/80 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                    🔄 Reconstructed
                  </th>
                  <th colSpan={4} className="px-2 py-1 text-center bg-purple-50/80 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                    📋 Write-Off Module Reports
                  </th>
                </tr>
                {/* Sub Header Row */}
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400">
                  {/* Collection */}
                  <th className="px-2 py-1 text-center min-w-[85px]">Accounts</th>
                  <th className="px-2 py-1 text-center min-w-[75px]">Target</th>
                  <th className="px-2 py-1 text-center min-w-[75px] text-emerald-600 dark:text-emerald-400">Collected</th>
                  <th className="px-2 py-1 text-center min-w-[75px]">Balance</th>
                  <th className="px-2 py-1 text-center min-w-[85px] border-r border-slate-200 dark:border-slate-700">Efficiency</th>
                  {/* Reconstructed */}
                  <th className="px-2 py-1 text-center min-w-[90px] text-cyan-700 dark:text-cyan-400 border-r border-slate-200 dark:border-slate-700">Reconstructed</th>
                  {/* Write-Off */}
                  <th className="px-2 py-1 text-center min-w-[115px] text-blue-700 dark:text-blue-400">📍 Located</th>
                  <th className="px-2 py-1 text-center min-w-[115px] text-amber-700 dark:text-amber-400">🔍 Unlocated</th>
                  <th className="px-2 py-1 text-center min-w-[80px] text-purple-700 dark:text-purple-400">🕊️ Deceased</th>
                  <th className="px-2 py-1 text-center min-w-[95px] font-black text-purple-900 dark:text-purple-200">📊 Total Write-Off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
                {combinedData.map((p, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  const isHighEfficiency = p.collectionRate >= 75;
                  const isMediumEfficiency = p.collectionRate >= 25 && p.collectionRate < 75;
                  
                  return (
                    <tr
                      key={p.collector}
                      tabIndex={performanceScope === 'yearly' ? 0 : undefined}
                      onClick={() => {
                        if (performanceScope === 'yearly') setSelectedYearlyCollector(p.collector);
                      }}
                      onKeyDown={(event) => {
                        if (performanceScope !== 'yearly') return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedYearlyCollector(p.collector);
                        }
                      }}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${performanceScope === 'yearly' ? 'cursor-pointer focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20' : ''}`}
                    >
                      {/* Collector Identity */}
                      <td className="px-2.5 py-1 align-middle border-r border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[9px] shrink-0">
                            {p.collector.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1 truncate">
                              <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                {p.collector}
                              </span>
                              {isTopThree && (
                                <span className="px-1 py-0 rounded-full text-[7px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                                  {rank === 1 ? '#1' : `T${rank}`}
                                </span>
                              )}
                            </div>
                            <span className="text-[7px] font-semibold text-slate-400 leading-none">Field Agent</span>
                          </div>
                        </div>
                      </td>

                      {/* Accounts */}
                      <td className="px-2 py-1 text-center align-middle text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{p.totalAccounts}</span> <span className="text-[7px] text-slate-400 uppercase">Total</span>
                        <span className="mx-0.5 text-slate-300">/</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">{p.activeAccountCount}</span> <span className="text-[7px] text-emerald-600/70 dark:text-emerald-400/70 uppercase">Active</span>
                      </td>

                      {/* Target */}
                      <td className="px-2 py-1 text-center align-middle text-slate-500 dark:text-slate-400 font-semibold tabular-nums text-xs">
                        ₱{p.reportedAmount.toLocaleString()}
                      </td>

                      {/* Collected */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums text-xs">
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          ₱{p.collectedAmount.toLocaleString()}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums text-xs">
                        <span className="font-black text-slate-800 dark:text-slate-100">
                          ₱{p.runningBalance.toLocaleString()}
                        </span>
                      </td>

                      {/* Efficiency Rate */}
                      <td className="px-2 py-1 align-middle border-r border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-black text-[10px] text-slate-700 dark:text-slate-200 tabular-nums">
                            {p.collectionRate.toFixed(1)}%
                          </span>
                          <div className="w-8 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${isHighEfficiency ? 'bg-emerald-500' : isMediumEfficiency ? 'bg-orange-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, p.collectionRate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Reconstructed Module */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums border-r border-slate-100 dark:border-slate-700/50">
                        {p.reconstructed.count > 0 ? (
                          <div>
                            <div className="font-bold text-cyan-700 dark:text-cyan-400 text-[11px]">₱{p.reconstructed.amount.toLocaleString()}</div>
                            <div className="text-[7.5px] font-semibold text-slate-400 leading-none">{p.reconstructed.count} acct{p.reconstructed.count !== 1 ? 's' : ''}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Located Write-Off */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums">
                        {p.located.count > 0 ? (
                          <div>
                            <div className="font-bold text-blue-700 dark:text-blue-400 text-[11px]">₱{p.located.amount.toLocaleString()}</div>
                            <div className="text-[7.5px] font-semibold text-slate-400 leading-none">{p.located.count} acct{p.located.count !== 1 ? 's' : ''}</div>
                            <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5 text-[7px] font-bold">
                              {p.located.pending.count > 0 && (
                                <span className="px-1 py-0 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50" title={`Pending Review: ₱${p.located.pending.amount.toLocaleString()} (${p.located.pending.count} accts)`}>
                                  ⏳ {p.located.pending.count}p (₱{p.located.pending.amount.toLocaleString()})
                                </span>
                              )}
                              {p.located.official.count > 0 && (
                                <span className="px-1 py-0 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50" title={`Officially Approved: ₱${p.located.official.amount.toLocaleString()} (${p.located.official.count} accts)`}>
                                  ✓ {p.located.official.count}a (₱{p.located.official.amount.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Unlocated Write-Off */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums">
                        {p.unlocated.count > 0 ? (
                          <div>
                            <div className="font-bold text-amber-700 dark:text-amber-400 text-[11px]">₱{p.unlocated.amount.toLocaleString()}</div>
                            <div className="text-[7.5px] font-semibold text-slate-400 leading-none">{p.unlocated.count} acct{p.unlocated.count !== 1 ? 's' : ''}</div>
                            <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5 text-[7px] font-bold">
                              {p.unlocated.pending.count > 0 && (
                                <span className="px-1 py-0 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50" title={`Pending Review: ₱${p.unlocated.pending.amount.toLocaleString()} (${p.unlocated.pending.count} accts)`}>
                                  ⏳ {p.unlocated.pending.count}p (₱{p.unlocated.pending.amount.toLocaleString()})
                                </span>
                              )}
                              {p.unlocated.official.count > 0 && (
                                <span className="px-1 py-0 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50" title={`Officially Approved: ₱${p.unlocated.official.amount.toLocaleString()} (${p.unlocated.official.count} accts)`}>
                                  ✓ {p.unlocated.official.count}a (₱{p.unlocated.official.amount.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Deceased Clients */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums">
                        {p.deceased.count > 0 ? (
                          <div>
                            <div className="font-bold text-purple-700 dark:text-purple-400 text-[11px]">₱{p.deceased.amount.toLocaleString()}</div>
                            <div className="text-[7.5px] font-semibold text-slate-400 leading-none">{p.deceased.count} acct{p.deceased.count !== 1 ? 's' : ''}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Total Write-Off */}
                      <td className="px-2 py-1 text-center align-middle tabular-nums bg-purple-50/30 dark:bg-purple-950/20">
                        {p.totalWriteOff.count > 0 ? (
                          <div>
                            <div className="font-black text-purple-900 dark:text-purple-300 text-[11px]">₱{p.totalWriteOff.amount.toLocaleString()}</div>
                            <div className="text-[7.5px] font-black text-purple-600 dark:text-purple-400 leading-none">{p.totalWriteOff.count} total</div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {combinedData.length > 0 && (
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/40 border-t-2 border-emerald-200 dark:border-emerald-800 font-black">
                    <td className="px-2.5 py-1.5 align-middle border-r border-emerald-200 dark:border-emerald-800">
                      <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[9px]">Grand Total</span>
                    </td>
                    <td className="px-2 py-1.5 text-center align-middle text-xs">
                      <span className="text-slate-800 dark:text-slate-200">{grandTotals.totalAccounts}</span> <span className="text-[7px] text-slate-500 uppercase">Total</span>
                      <span className="mx-0.5 text-slate-300">/</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{grandTotals.activeAccounts}</span> <span className="text-[7px] text-emerald-600 uppercase">Active</span>
                    </td>
                    <td className="px-2 py-1.5 text-center align-middle text-slate-800 dark:text-slate-200 tabular-nums text-xs">
                      ₱{grandTotals.reportedAmount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-center align-middle text-emerald-700 dark:text-emerald-400 text-xs tabular-nums">
                      ₱{grandTotals.collectedAmount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-center align-middle text-slate-900 dark:text-white text-xs tabular-nums">
                      ₱{grandTotals.runningBalance.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 align-middle border-r border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[10px] text-slate-800 dark:text-slate-200 tabular-nums">
                          {grandTotalEfficiency.toFixed(1)}%
                        </span>
                        <div className="w-8 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${grandTotalEfficiency >= 75 ? 'bg-emerald-500' : grandTotalEfficiency >= 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, grandTotalEfficiency)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    {/* Reconstructed Total */}
                    <td className="px-2 py-1.5 text-center align-middle border-r border-slate-200 dark:border-slate-700">
                      <div className="font-black text-cyan-700 dark:text-cyan-400 text-xs">₱{grandTotals.reconstructed.amount.toLocaleString()}</div>
                      <div className="text-[7.5px] text-cyan-600 dark:text-cyan-400 font-bold leading-none">{grandTotals.reconstructed.count} accts</div>
                    </td>
                    {/* Located Total */}
                    <td className="px-2 py-1.5 text-center align-middle tabular-nums">
                      <div className="text-blue-800 dark:text-blue-300 font-bold text-xs">₱{grandTotals.located.amount.toLocaleString()}</div>
                      <div className="text-[7.5px] text-blue-600 dark:text-blue-400 font-bold leading-none">{grandTotals.located.count} accts</div>
                      <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5 text-[7px] font-bold">
                        {grandTotals.located.pending.count > 0 && (
                          <span className="text-amber-700 dark:text-amber-300">⏳ {grandTotals.located.pending.count}p (₱{grandTotals.located.pending.amount.toLocaleString()})</span>
                        )}
                        {grandTotals.located.official.count > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-300">✓ {grandTotals.located.official.count}a (₱{grandTotals.located.official.amount.toLocaleString()})</span>
                        )}
                      </div>
                    </td>
                    {/* Unlocated Total */}
                    <td className="px-2 py-1.5 text-center align-middle tabular-nums">
                      <div className="text-amber-800 dark:text-amber-300 font-bold text-xs">₱{grandTotals.unlocated.amount.toLocaleString()}</div>
                      <div className="text-[7.5px] text-amber-600 dark:text-amber-400 font-bold leading-none">{grandTotals.unlocated.count} accts</div>
                      <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5 text-[7px] font-bold">
                        {grandTotals.unlocated.pending.count > 0 && (
                          <span className="text-amber-700 dark:text-amber-300">⏳ {grandTotals.unlocated.pending.count}p (₱{grandTotals.unlocated.pending.amount.toLocaleString()})</span>
                        )}
                        {grandTotals.unlocated.official.count > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-300">✓ {grandTotals.unlocated.official.count}a (₱{grandTotals.unlocated.official.amount.toLocaleString()})</span>
                        )}
                      </div>
                    </td>
                    {/* Deceased Total */}
                    <td className="px-2 py-1.5 text-center align-middle tabular-nums">
                      <div className="text-purple-800 dark:text-purple-300 font-bold text-xs">₱{grandTotals.deceased.amount.toLocaleString()}</div>
                      <div className="text-[7.5px] text-purple-600 dark:text-purple-400 font-bold leading-none">{grandTotals.deceased.count} accts</div>
                    </td>
                    {/* Total Write-Off Total */}
                    <td className="px-2 py-1.5 text-center align-middle tabular-nums bg-purple-100/50 dark:bg-purple-950/40">
                      <div className="text-purple-950 dark:text-purple-200 text-xs font-black">₱{grandTotals.totalWriteOff.amount.toLocaleString()}</div>
                      <div className="text-[7.5px] text-purple-700 dark:text-purple-300 font-black leading-none">{grandTotals.totalWriteOff.count} total</div>
                    </td>
                  </tr>
                )}
                {combinedData.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold">
                      No field data available for this branch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {performanceScope === 'yearly' && selectedCollectorSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{activeYearlyPeriod.label} Yearly Report</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">{selectedCollectorSummary.collector}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedCollectorClients.length} clients under this collector</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedYearlyCollector(null)}
                  className="self-start px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Accounts</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{selectedCollectorSummary.totalAccounts}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">₱{selectedCollectorSummary.reportedAmount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Collected</p>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">₱{selectedCollectorSummary.collectedAmount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Balance</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">₱{selectedCollectorSummary.runningBalance.toLocaleString()}</p>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Client</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Reported</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Reported Amount</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Collected</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {selectedCollectorClients.map(client => (
                      <tr key={client.loanId} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="px-4 py-3">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{client.borrowerName}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">Code: {client.code || 'N/A'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">{client.monthReported || 'N/A'}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">{client.status}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-200">₱{client.reportedAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-black text-emerald-600 dark:text-emerald-400">₱{client.collectedAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-black text-slate-900 dark:text-white">₱{client.runningBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                    {selectedCollectorClients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs font-bold text-slate-400">No clients found for this collector and year period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </>
      ) : activeReport === 'aging' ? (
        <AgingReport selectedBranch={selectedBranch} />
      ) : activeReport === 'dead-write-off' ? (
        <DeadWriteOffReport selectedBranch={selectedBranch} />
      ) : activeReport === 'reconstructed' ? (
        <ReconstructedReport selectedBranch={selectedBranch} />
      ) : (
        <MonthlyPerformance selectedBranch={selectedBranch} />
      )}
    </div>
  );
};

export default Reports;
