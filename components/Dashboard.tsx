
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { store } from '../services/dataStore.ts';
import { getLoanInsights } from '../services/geminiService.ts';
import { MovingStatus, Branch, Loan, PaymentStatus, DispositionType, DispositionStatus, ManagementDisposition } from '../types.ts';
import { getReportedStartDate, hasActiveReceivableBalance, isDeadWriteOffLoan, isReconstructedOutcomeLoan, isReconstructedPaymentRemark, isReportableCollectionPayment, isWriteOffOutcomeLoan } from '../services/loanUtils.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';

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

interface DashboardProps {
  selectedBranch: Branch;
}

const KpiCard: React.FC<{
  title: string;
  value?: string | number;
  subValue?: string;
  subValueEmphasis?: boolean;
  icon: string;
  statusIndicator?: {text: string, type: 'positive' | 'neutral' | 'critical' | 'info'};
  children?: React.ReactNode;
}> = ({ title, value, subValue, subValueEmphasis = false, icon, statusIndicator, children }) => {
  const statusStyles = {
    positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-3.5 md:p-4 rounded-xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-full transition-colors duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-2.5 relative z-10">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-sm shadow-inner border border-slate-100 dark:border-slate-700 group-hover:scale-105 transition-transform duration-300">
                    {icon}
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-extrabold uppercase tracking-wide ${statusIndicator ? statusStyles[statusIndicator.type] : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{title}</span>
            </div>
            {statusIndicator && (
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusStyles[statusIndicator.type]}`}>
                    {statusIndicator.text}
                </span>
            )}
        </div>
        <div className="flex justify-between items-end relative z-10 w-full">
            {children ? (
              children
            ) : (
              <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">{value}</span>
                  {subValue && (
                    <span className={`${subValueEmphasis ? 'text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300' : 'text-[11px] font-semibold text-slate-400 dark:text-slate-500'} mt-0.5`}>
                      {subValue}
                    </span>
                  )}
              </div>
            )}
        </div>
        <div className="absolute -bottom-4 -right-2 text-6xl opacity-[0.03] grayscale pointer-events-none group-hover:scale-105 transition-transform duration-500">{icon}</div>
    </div>
  );
};

const SecondaryMetricCard: React.FC<{
  title: string;
  count: number;
  reportedAmount: number;
  secondaryLabel: string;
  secondaryAmount: number;
  color?: string;
  accentBar?: string;
  footerNote?: string;
}> = ({
  title,
  count,
  reportedAmount,
  secondaryLabel,
  secondaryAmount,
  color = 'text-slate-800 dark:text-white',
  accentBar,
  footerNote
}) => (
  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between shadow-xs relative overflow-hidden transition-colors duration-300">
    <div className="flex items-center justify-between gap-1 mb-2 z-10">
      <span className={`inline-flex min-w-0 items-center rounded-md border px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
        title === 'Moving' ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-900/30 dark:text-sky-300' :
        title === 'Not Moving' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300' :
        title === 'NM Since Release' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300' :
        title === 'Reconstructed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300' :
        title === 'Paid' ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-900/30 dark:text-teal-300' :
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-900/30 dark:text-violet-300'
      }`}>
        {title}
      </span>
      <span className="shrink-0 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700 whitespace-nowrap">
        {count} {count === 1 ? 'Client' : 'Clients'}
      </span>
    </div>

    <div className="space-y-1 z-10">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Amt. Reported:</span>
        <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">₱{reportedAmount.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{secondaryLabel}:</span>
        <span className={`font-black tabular-nums ${color}`}>₱{secondaryAmount.toLocaleString()}</span>
      </div>
      {footerNote && (
        <div className="text-[8px] font-medium text-slate-400 italic text-right pt-0.5">
          {footerNote}
        </div>
      )}
    </div>

    {accentBar && <div className={`absolute top-0 right-0 w-1 h-full ${accentBar}`}></div>}
  </div>
);

const getRecordedLoanAmount = (loan: Loan) =>
  loan.totalLoan != null && loan.totalLoan > 0 ? loan.totalLoan : loan.outstandingBalance;

const getLedgerLoanAmount = (loan: Loan) =>
  Math.max(getRecordedLoanAmount(loan), loan.amountCollected + loan.runningBalance);

const formatDateForExport = (date?: string | null) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

const getLoanAddress = (loan: Loan) =>
  loan.fullAddress || [loan.area, loan.barangay, loan.city].filter(Boolean).join(', ');

const sanitizeFilePart = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') || 'All';

const getReportableCollectedAmount = (loan: Loan) =>
  Math.max(Number(loan.amountCollected || 0), (loan.payments || [])
    .filter(isReportableCollectionPayment)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0));

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const performanceYearlyPeriods = [
  { id: '2016-2024', from: 2016, to: 2024 },
  { id: '2025', from: 2025, to: 2025 },
  { id: '2026', from: 2026, to: 2026 }
];

const Dashboard: React.FC<DashboardProps> = ({ selectedBranch }) => {
  const [allLoans, setAllLoans] = useState(store.getLoans(selectedBranch));
  const [allCollectors, setAllCollectors] = useState(store.getCollectors(Branch.ALL));
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [collectorViewMode, setCollectorViewMode] = useState<'Balance View' | 'Performance View'>('Balance View');
  const [nearFullCollectorFilter, setNearFullCollectorFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'last30' | 'custom'>('all');
  const [dateRangeFrom, setDateRangeFrom] = useState('');
  const [dateRangeTo, setDateRangeTo] = useState('');
  const [performanceBasis, setPerformanceBasis] = useState<'reported' | 'maturity'>('reported');
  const [reportedPerformancePeriod, setReportedPerformancePeriod] = useState('overall');
  const [maturityPerformancePeriod, setMaturityPerformancePeriod] = useState('overall');
  const selectedPerformancePeriod = performanceBasis === 'reported' ? reportedPerformancePeriod : maturityPerformancePeriod;
  const activePerformanceYear = performanceYearlyPeriods.find(period => period.id === selectedPerformancePeriod);

  useEffect(() => {
    const refreshData = () => {
      setAllLoans(store.getLoans(selectedBranch));
      setAllCollectors(store.getCollectors(Branch.ALL));
    };

    refreshData();

    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  // --- Filtered accounts based on report month / collection activity ---
  const loans = useMemo(() => {
    if (dateFilter === 'all') return allLoans;
    const cutoff = new Date();
    if (dateFilter === 'last30') cutoff.setDate(cutoff.getDate() - 30);
    const fromDate = dateFilter === 'custom' ? dateRangeFrom : toDateInputValue(cutoff);
    const toDate = dateFilter === 'custom' ? dateRangeTo : toDateInputValue(new Date());
    if (!fromDate || !toDate || fromDate > toDate) return [];
    return allLoans.filter(l => {
      const hasPaymentInRange = l.payments.some(p =>
        isReportableCollectionPayment(p) && p.date >= fromDate && p.date <= toDate
      );
      const reportedDate = getReportedStartDate(l.monthReported);
      const hasReportInRange = reportedDate >= fromDate && reportedDate <= toDate;
      return hasPaymentInRange || hasReportInRange;
    });
  }, [allLoans, dateFilter, dateRangeFrom, dateRangeTo]);

  // --- Compute stats from filtered loans ---
  // Total account counts keep every account; performance money excludes non-cash terminal outcomes.
  const { performanceLoans, deadWriteOffLoans } = useMemo(() => {
    const dead: Loan[] = [];
    const perf: Loan[] = [];
    loans.forEach(l => {
      if (isDeadWriteOffLoan(l)) {
        dead.push(l);
        return;
      }
      if (isReconstructedOutcomeLoan(l) || isWriteOffOutcomeLoan(l)) return;
      perf.push(l);
    });
    return { performanceLoans: perf, deadWriteOffLoans: dead };
  }, [loans]);

  const stats = useMemo(() => {
    const totalAccounts = loans.length;
    const activeAccounts = loans.filter(hasActiveReceivableBalance);
    const activeAccountCount = activeAccounts.length;

    const totalCollected = performanceLoans.reduce((sum, l) => sum + getReportableCollectedAmount(l), 0);
    const totalLoanAmount = performanceLoans.reduce((sum, l) => sum + getLedgerLoanAmount(l), 0);
    const totalReportedAmount = performanceLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
    const totalRunning = performanceLoans.reduce((sum, l) => sum + l.runningBalance, 0);
    const statusData: Record<string, { count: number; amount: number; reported: number; balance: number; collected: number }> = {
      Paid: { count: 0, amount: 0, reported: 0, balance: 0, collected: 0 },
      Moving: { count: 0, amount: 0, reported: 0, balance: 0, collected: 0 },
      NM: { count: 0, amount: 0, reported: 0, balance: 0, collected: 0 },
      NMSR: { count: 0, amount: 0, reported: 0, balance: 0, collected: 0 },
    };
    const statusKeyMap: Record<string, string> = {
      [MovingStatus.PAID]: 'Paid',
      [MovingStatus.MOVING]: 'Moving',
      [MovingStatus.NM]: 'NM',
      [MovingStatus.NMSR]: 'NMSR',
    };
    performanceLoans.forEach(l => {
      const key = statusKeyMap[l.status];
      if (key && statusData[key]) {
        const collected = getReportableCollectedAmount(l);
        statusData[key].count++;
        statusData[key].reported += Number(l.outstandingBalance || 0);
        statusData[key].balance += Number(l.runningBalance || 0);
        statusData[key].collected += collected;
        statusData[key].amount += (l.status === MovingStatus.PAID ? collected : l.runningBalance);
      }
    });
    const deadWriteOff = {
      count: deadWriteOffLoans.length,
      amount: deadWriteOffLoans.reduce((sum, l) => sum + getLedgerLoanAmount(l), 0),
      reported: deadWriteOffLoans.reduce((sum, l) => sum + Number(l.outstandingBalance || 0), 0)
    };
    let reconAmount = 0;
    let reconReportedAmount = 0;
    const uniqueReconLoans = new Set<string>();
    allLoans.forEach(loan => {
      let isRecon = false;
      (loan.payments || []).forEach(payment => {
        if (payment.status !== PaymentStatus.REVERSED && isReconstructedPaymentRemark(payment.remarks)) {
          isRecon = true;
          reconAmount += Number(payment.amount || 0);
        }
      });
      if (loan.remarks?.some(r => isReconstructedPaymentRemark(r.text))) {
        isRecon = true;
      }
      if (isRecon) {
        uniqueReconLoans.add(loan.id);
        reconReportedAmount += Number(loan.outstandingBalance || 0);
      }
    });
    const reconstructedStats = { count: uniqueReconLoans.size, amount: reconAmount, reported: reconReportedAmount };

    return { totalAccounts, activeAccountCount, totalCollected, totalLoanAmount, totalReportedAmount, totalRunning, statusData, deadWriteOff, reconstructedStats };
  }, [loans, performanceLoans, deadWriteOffLoans, allLoans]);

  // --- Compute Write-Off Module Reports stats ---
  const writeOffStats = useMemo(() => {
    const loansById = new Map<string, Loan>(allLoans.map(l => [l.id, l]));
    const dispositions = store.getAllDispositions ? store.getAllDispositions() : [];
    const deadLoans = store.getDeadWriteOffs ? store.getDeadWriteOffs(selectedBranch) : [];

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

    const summary = {
      located: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
      unlocated: { count: 0, amount: 0, pending: { count: 0, amount: 0 }, official: { count: 0, amount: 0 } },
      deceased: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 }
    };

    latestProspectByLoan.forEach((disposition, loanId) => {
      if (disposition.status === DispositionStatus.REJECTED) return;
      const loan = loansById.get(loanId);
      if (!loan) return;

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
        summary.deceased.count += 1;
        summary.deceased.amount += fin.amountWriteOffOrDeceased;
      } else if (isUnlocated) {
        summary.unlocated.count += 1;
        summary.unlocated.amount += fin.amountWriteOffOrDeceased;
        if (isOfficial) {
          summary.unlocated.official.count += 1;
          summary.unlocated.official.amount += fin.amountWriteOffOrDeceased;
        } else {
          summary.unlocated.pending.count += 1;
          summary.unlocated.pending.amount += fin.amountWriteOffOrDeceased;
        }
      } else if (isLocated) {
        summary.located.count += 1;
        summary.located.amount += fin.amountWriteOffOrDeceased;
        if (isOfficial) {
          summary.located.official.count += 1;
          summary.located.official.amount += fin.amountWriteOffOrDeceased;
        } else {
          summary.located.pending.count += 1;
          summary.located.pending.amount += fin.amountWriteOffOrDeceased;
        }
      }

      summary.total.count += 1;
      summary.total.amount += fin.amountWriteOffOrDeceased;
    });

    return summary;
  }, [allLoans, selectedBranch]);

  // Use the same collector report source and period as the Reports matrix.
  const collectionPerformanceGrandTotal = useMemo(() => {
    const yearRange = performanceBasis === 'reported' && activePerformanceYear
      ? { from: activePerformanceYear.from, to: activePerformanceYear.to } : undefined;
    const maturityRange = performanceBasis === 'maturity' && activePerformanceYear
      ? { from: `${activePerformanceYear.from}-01-01`, to: `${activePerformanceYear.to}-12-31` } : undefined;
    const performance = performanceBasis === 'maturity'
      ? store.getCollectorPerformance(selectedBranch, undefined, undefined, maturityRange)
      : yearRange
        ? store.getCollectorPerformance(selectedBranch, yearRange)
        : store.getCollectorPerformance(selectedBranch);
    const totals = performance.reduce((acc, curr) => ({
      totalAccounts: acc.totalAccounts + (curr.totalAccounts || 0),
      activeAccounts: acc.activeAccounts + (curr.activeAccountCount || 0),
      reportedAmount: acc.reportedAmount + (curr.reportedAmount || 0),
      actualCollectedAmount: acc.actualCollectedAmount + (curr.actualCollectedAmount || 0),
      excessCollection: acc.excessCollection + (curr.excessCollection || 0),
      writeOffValidCollections: acc.writeOffValidCollections + (curr.writeOffValidCollections || 0),
      runningBalance: acc.runningBalance + (curr.runningBalance || 0),
      collectedAmount: acc.collectedAmount + (curr.collectedAmount || 0),
    }), {
      totalAccounts: 0,
      activeAccounts: 0,
      reportedAmount: 0,
      actualCollectedAmount: 0,
      excessCollection: 0,
      writeOffValidCollections: 0,
      runningBalance: 0,
      collectedAmount: 0,
    });

    return {
      ...totals,
      efficiencyRate: totals.reportedAmount > 0
        ? (totals.actualCollectedAmount / totals.reportedAmount) * 100
        : 0
    };
  }, [selectedBranch, allLoans, allCollectors, performanceBasis, selectedPerformancePeriod]);

  // --- Compute collector performance from filtered loans ---
  const collectorData = useMemo(() => {
    const collectors: Record<string, { collector: string; totalAccounts: number; reportedAmount: number; collectedAmount: number; runningBalance: number; collectionRate: number; paidCount: number }> = {};
    loans.forEach(loan => {
      const coll = getCollectorDisplayName(loan.collector, allCollectors);
      if (!coll || coll === 'N/A' || coll === 'UNDEFINED' || coll === 'UNASSIGNED') return;
      if (!collectors[coll]) {
        collectors[coll] = { collector: coll, totalAccounts: 0, reportedAmount: 0, collectedAmount: 0, runningBalance: 0, collectionRate: 0, paidCount: 0 };
      }
      collectors[coll].totalAccounts++;
    });

    performanceLoans.forEach(loan => {
      const coll = getCollectorDisplayName(loan.collector, allCollectors);
      if (!coll || coll === 'N/A' || coll === 'UNDEFINED' || coll === 'UNASSIGNED') return;
      if (!collectors[coll]) {
        collectors[coll] = { collector: coll, totalAccounts: 0, reportedAmount: 0, collectedAmount: 0, runningBalance: 0, collectionRate: 0, paidCount: 0 };
      }
      const p = collectors[coll];
      const reportableCollected = getReportableCollectedAmount(loan);
      p.reportedAmount += loan.outstandingBalance;
      p.collectedAmount += reportableCollected;
      p.runningBalance += Math.max(0, loan.outstandingBalance - reportableCollected);
      if (loan.status === MovingStatus.PAID) p.paidCount++;
    });
    return Object.values(collectors).map(p => ({ ...p, collectionRate: p.reportedAmount > 0 ? (p.collectedAmount / p.reportedAmount) * 100 : 0 }));
  }, [performanceLoans, allCollectors]);

  // --- Compute collector distribution from filtered loans ---
  const collectorDistribution = useMemo(() => {
    const distribution: Record<string, { total: number, active: number }> = {};
    performanceLoans.forEach(loan => {
      const coll = loan.collector?.trim();
      if (!coll || coll === 'N/A' || coll === 'undefined' || coll === 'UNASSIGNED') return;
      if (!distribution[coll]) distribution[coll] = { total: 0, active: 0 };
      distribution[coll].total += 1;
      if (loan.status !== MovingStatus.PAID) distribution[coll].active += 1;
    });
    return Object.entries(distribution)
      .map(([name, counts]) => ({ name, value: counts.active, total: counts.total }))
      .sort((a, b) => b.value - a.value);
  }, [performanceLoans]);

  // --- Compute Today's Action Summary ---
  const todayActions = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let ptpDue = 0;
    let followUpDue = 0;
    let missed = 0;

    allLoans.forEach(loan => {
      if (loan.status === MovingStatus.PAID) return;
      const isPtpToday = loan.promiseToPayDate === today;
      const isFuToday = loan.followUpDate === today;
      const isMissed = (loan.promiseToPayDate && loan.promiseToPayDate < today) || (loan.followUpDate && loan.followUpDate < today);

      if (isPtpToday) ptpDue++;
      if (isFuToday) followUpDue++;
      if (isMissed) missed++;
    });

    return { ptpDue, followUpDue, missed };
  }, [allLoans]);

  const nearFullPaymentClients = useMemo(() => {
    return loans
      .filter(l => l.runningBalance > 0 && l.runningBalance <= 1000 && l.status !== MovingStatus.PAID)
      .filter(l => nearFullCollectorFilter === '' || getCollectorDisplayName(l.collector, allCollectors) === nearFullCollectorFilter)
      .sort((a, b) => a.runningBalance - b.runningBalance);
  }, [loans, nearFullCollectorFilter, allCollectors]);

  const nearFullTotalAmount = useMemo(() => {
    return nearFullPaymentClients.reduce((sum, l) => sum + l.runningBalance, 0);
  }, [nearFullPaymentClients]);

  const sortedCollectorData = useMemo(() => [...collectorData].sort((a, b) => {
    if (collectorViewMode === 'Performance View') {
      const aPerf = a.reportedAmount > 0 ? (a.collectedAmount / a.reportedAmount) : 0;
      const bPerf = b.reportedAmount > 0 ? (b.collectedAmount / b.reportedAmount) : 0;
      return bPerf - aPerf;
    } else {
      return b.reportedAmount - a.reportedAmount;
    }
  }), [collectorData, collectorViewMode]);

  const collectionTrend = useMemo(() => {
    const now = new Date();
    const days30Ago = new Date();
    days30Ago.setDate(now.getDate() - 29);

    const dailyMap: Record<string, { amount: number; count: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(days30Ago);
      d.setDate(days30Ago.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { amount: 0, count: 0 };
    }

    loans.forEach(loan => {
      loan.payments.forEach(p => {
        if (p.status === PaymentStatus.GOOD && dailyMap[p.date] !== undefined) {
          dailyMap[p.date].amount += p.amount;
          dailyMap[p.date].count += 1;
        }
      });
    });

    let cumulative = 0;
    const trendData = Object.keys(dailyMap).sort().map(date => {
      cumulative += dailyMap[date].amount;
      const d = new Date(`${date}T00:00:00`);
      return {
        date,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: dailyMap[date].amount,
        cumulative,
        count: dailyMap[date].count,
      };
    });

    const totalCollected30 = trendData.reduce((s, d) => s + d.amount, 0);
    const totalTransactions30 = trendData.reduce((s, d) => s + d.count, 0);
    const peakDay = trendData.reduce((best, d) => d.amount > best.amount ? d : best, trendData[0]);

    return {
      avgDaily: totalCollected30 / 30,
      peakDay,
      totalCollected30,
      totalTransactions30,
      trendData,
    };
  }, [loans]);

  const COLORS = ['#3b82f6', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f43f5e', '#6366f1'];

  const fetchAiInsight = async () => {
    setIsAiLoading(true);
    const insight = await getLoanInsights(store.getLoans(selectedBranch));
    setAiInsight(insight || "No insights available.");
    setIsAiLoading(false);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData: any[][] = [
      ['Melann Lending — Dashboard Export'],
      ['Branch', selectedBranch],
      ['Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
      [],
      ['Metric', 'Value'],
      ['Total Accounts', stats.totalAccounts],
      ['Active Accounts', stats.activeAccountCount],
      ['Total Collected (All-Time Remitted)', stats.totalCollected],
      ['Performance Report', `${performanceBasis === 'reported' ? 'Monthly Reported' : 'Maturity Date'} · ${activePerformanceYear?.id || 'Overall Report'}`],
      ['Actual Collection', collectionPerformanceGrandTotal.actualCollectedAmount],
      ['Excess Collection', collectionPerformanceGrandTotal.excessCollection],
      ['Write-off Valid Collections', collectionPerformanceGrandTotal.writeOffValidCollections],
      ['Total Collected (Performance)', collectionPerformanceGrandTotal.collectedAmount],
      ['Performance Balance', collectionPerformanceGrandTotal.runningBalance],
      ['Total Loan', stats.totalLoanAmount],
      ['Total Reported (Target)', stats.totalReportedAmount],
      ['Running Balance', stats.totalRunning],
      ['Collection Efficiency Rate (%)', `${collectionPerformanceGrandTotal.efficiencyRate.toFixed(1)}%`],
      ['Reconstructed Amount', stats.reconstructedStats.amount],
      ['Reconstructed Clients', stats.reconstructedStats.count],
      [],
      ['Status Breakdown', 'Amount', 'Count'],
      ['Not Moving', stats.statusData.NM.amount, stats.statusData.NM.count],
      ['Moving', stats.statusData.Moving.amount, stats.statusData.Moving.count],
      ['Paid', stats.statusData.Paid.amount, stats.statusData.Paid.count],
      ['NM Since Release', stats.statusData.NMSR.amount, stats.statusData.NMSR.count],
      [],
      ['WRITE-OFF MODULE REPORTS', 'Amount', 'Accounts', 'Pending Review', 'Approved'],
      ['Located Write-Off', writeOffStats.located.amount, writeOffStats.located.count, `₱${writeOffStats.located.pending.amount.toLocaleString()} (${writeOffStats.located.pending.count})`, `₱${writeOffStats.located.official.amount.toLocaleString()} (${writeOffStats.located.official.count})`],
      ['Unlocated Write-Off', writeOffStats.unlocated.amount, writeOffStats.unlocated.count, `₱${writeOffStats.unlocated.pending.amount.toLocaleString()} (${writeOffStats.unlocated.pending.count})`, `₱${writeOffStats.unlocated.official.amount.toLocaleString()} (${writeOffStats.unlocated.official.count})`],
      ['Deceased Accounts', writeOffStats.deceased.amount, writeOffStats.deceased.count, '—', '—'],
      ['Total Write-Off Portfolio', writeOffStats.total.amount, writeOffStats.total.count, '—', '—'],
      [],
      ['COLLECTOR PERFORMANCE MATRIX'],
      ['Collector', 'Total Accounts', 'Reported Amount', 'Collected Amount', 'Running Balance', 'Collection Rate (%)', 'Paid Count'],
      ...sortedCollectorData.map(cd => [
        cd.collector,
        cd.totalAccounts,
        cd.reportedAmount,
        cd.collectedAmount,
        cd.runningBalance,
        cd.reportedAmount > 0 ? Math.round((cd.collectedAmount / cd.reportedAmount) * 10000) / 100 : 0,
        cd.paidCount
      ]),
      [],
      ['NEAR FULL PAYMENT (≤₱1,000)'],
      ['Borrower Name', 'Collector', 'Running Balance']
    ];

    const nearFullClients = loans
      .filter(l => l.runningBalance > 0 && l.runningBalance <= 1000 && l.status !== MovingStatus.PAID)
      .sort((a, b) => a.runningBalance - b.runningBalance);

    if (nearFullClients.length > 0) {
      nearFullClients.forEach(loan => {
        exportData.push([
          loan.borrowerName,
          getCollectorDisplayName(loan.collector, allCollectors),
          loan.runningBalance
        ]);
      });
    } else {
      exportData.push(['No clients with ≤₱1,000 balance']);
    }

    exportData.push([]);
    exportData.push(['ACCOUNT DISTRIBUTION']);
    exportData.push(['Collector', 'Accounts']);

    if (collectorDistribution.length > 0) {
      collectorDistribution.forEach(item => {
        exportData.push([item.name, item.value]);
      });
    } else {
      exportData.push(['No data']);
    }

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    // Set column widths based on the widest fields
    ws['!cols'] = [
      { wch: 28 }, // Collector / Borrower Name
      { wch: 20 }, // Total Accounts / Collector
      { wch: 18 }, // Reported Amount
      { wch: 18 }, // Collected Amount
      { wch: 18 }, // Running Balance
      { wch: 18 }, // Collection Rate
      { wch: 12 }  // Paid Count
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Report');

    const branchTag = selectedBranch.replace(/\s+/g, '_');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Dashboard_${branchTag}_${today}.xlsx`);
  };

  const handleExportNearFullPayment = async () => {
    const XLSX = await import('xlsx');
    const collectorGroups = nearFullPaymentClients.reduce<Record<string, Loan[]>>((groups, loan) => {
      const collectorName = getCollectorDisplayName(loan.collector, allCollectors);
      if (!groups[collectorName]) groups[collectorName] = [];
      groups[collectorName].push(loan);
      return groups;
    }, {});

    const collectorNames = Object.keys(collectorGroups).sort();
    const filterLabel = nearFullCollectorFilter || 'All Collectors';
    const exportData: (string | number)[][] = [
      ['Melann Lending - Near Full Payment Export'],
      ['Branch', selectedBranch],
      ['Collector Filter', filterLabel],
      ['Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
      ['Total Clients', nearFullPaymentClients.length],
      ['Total Running Balance', nearFullTotalAmount],
      []
    ];

    if (collectorNames.length === 0) {
      exportData.push(['No near full payment clients found']);
    } else {
      collectorNames.forEach((collectorName, collectorIndex) => {
        const collectorLoans = collectorGroups[collectorName].sort((a, b) =>
          a.borrowerName.localeCompare(b.borrowerName) || a.runningBalance - b.runningBalance
        );
        const collectorTotal = collectorLoans.reduce((sum, loan) => sum + loan.runningBalance, 0);

        if (collectorIndex > 0) exportData.push([]);
        exportData.push([`Collector: ${collectorName}`]);
        exportData.push(['Clients', collectorLoans.length, 'Total Running Balance', collectorTotal]);
        exportData.push([
          'Code',
          'Client Name',
          'Address',
          'Moving Status',
          'Running Balance',
          'Date Release',
          'Maturity Date'
        ]);

        collectorLoans.forEach(loan => {
          exportData.push([
            loan.code,
            loan.borrowerName,
            getLoanAddress(loan),
            loan.status,
            loan.runningBalance,
            formatDateForExport(loan.dateRelease),
            formatDateForExport(loan.dueDate)
          ]);
        });
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 44 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Near Full Payment');

    const branchTag = sanitizeFilePart(selectedBranch);
    const collectorTag = sanitizeFilePart(filterLabel);
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Near_Full_Payment_${branchTag}_${collectorTag}_${today}.xlsx`);
  };

  return (
    <div className="space-y-3.5 animate-fadeIn max-w-[1600px] mx-auto pb-10">

      {/* Header SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl shadow-[0_2px_12px_-3px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
        <div className="min-w-0">
           <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Institutional Performance Matrix</h1>
           <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {dateFilter === 'custom' && dateRangeFrom && dateRangeTo
                ? `Activity filter: ${new Date(`${dateRangeFrom}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${dateRangeTo}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · current balances, lifetime totals`
                : `Daily Settlement & Portfolio Overview — As of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
           </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto md:justify-end">
           <button
              onClick={() => setDateFilter(f => f === 'last30' ? 'all' : 'last30')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                dateFilter === 'last30'
                  ? 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700'
                  : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              }`}
           >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Last 30 Days
           </button>
           <button
              onClick={() => {
                if (dateFilter === 'custom') {
                  setDateFilter('all');
                  return;
                }
                const today = new Date();
                const from = new Date();
                from.setDate(today.getDate() - 29);
                setDateRangeFrom(toDateInputValue(from));
                setDateRangeTo(toDateInputValue(today));
                setDateFilter('custom');
              }}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                dateFilter === 'custom'
                  ? 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700'
                  : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              }`}
           >
              Date Range
           </button>
           {dateFilter === 'custom' && (
             <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-1.5">
               <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                 From
                 <input
                   aria-label="Date range start"
                   type="date"
                   value={dateRangeFrom}
                   max={dateRangeTo || undefined}
                   onChange={event => setDateRangeFrom(event.target.value)}
                   className="w-[125px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                 />
               </label>
               <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                 To
                 <input
                   aria-label="Date range end"
                   type="date"
                   value={dateRangeTo}
                   min={dateRangeFrom || undefined}
                   max={toDateInputValue(new Date())}
                   onChange={event => setDateRangeTo(event.target.value)}
                   className="w-[125px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                 />
               </label>
             </div>
           )}
           <button onClick={handleExportExcel} className="flex-1 md:flex-none bg-[#064e3b] hover:bg-[#043326] text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Export Excel
           </button>
        </div>
      </div>

      {/* KPI Cards (Top Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          title="Total Accounts"
          value={stats.totalAccounts}
          subValue={`${stats.activeAccountCount.toLocaleString()} Active as of now`}
          subValueEmphasis
          icon="👥"
          statusIndicator={{text: 'Stable', type: 'positive'}}
        />
        <KpiCard title="Total Loan" value={`₱${stats.totalLoanAmount.toLocaleString()}`} icon="🏦" statusIndicator={{text: 'Principal + Interest', type: 'neutral'}} />
        <KpiCard title="Total Reported" value={`₱${stats.totalReportedAmount.toLocaleString()}`} icon="📋" statusIndicator={{text: 'When Reported', type: 'info'}} />
        <KpiCard title="Total Collected" value={`₱${stats.totalCollected.toLocaleString()}`} icon="💳" statusIndicator={{text: 'Remitted', type: 'positive'}} />
        <KpiCard title="Running Balance" value={`₱${stats.totalRunning.toLocaleString()}`} icon="📉" statusIndicator={{text: 'Exposure', type: 'critical'}} />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <SecondaryMetricCard
          title="Moving"
          count={stats.statusData.Moving.count}
          reportedAmount={stats.statusData.Moving.reported}
          secondaryLabel="Total Balance"
          secondaryAmount={stats.statusData.Moving.balance}
          color="text-slate-800 dark:text-white"
        />
        <SecondaryMetricCard
          title="Not Moving"
          count={stats.statusData.NM.count}
          reportedAmount={stats.statusData.NM.reported}
          secondaryLabel="Total Balance"
          secondaryAmount={stats.statusData.NM.balance}
          color="text-slate-800 dark:text-white"
        />
        <SecondaryMetricCard
          title="NM Since Release"
          count={stats.statusData.NMSR.count}
          reportedAmount={stats.statusData.NMSR.reported}
          secondaryLabel="Total Balance"
          secondaryAmount={stats.statusData.NMSR.balance}
          color="text-red-500 dark:text-red-400"
        />
        <SecondaryMetricCard
          title="Reconstructed"
          count={stats.reconstructedStats.count}
          reportedAmount={stats.reconstructedStats.reported}
          secondaryLabel="Amt. Reconstructed"
          secondaryAmount={stats.reconstructedStats.amount}
          color="text-emerald-600 dark:text-emerald-400"
          accentBar="bg-emerald-400 dark:bg-emerald-600"
        />
        <SecondaryMetricCard
          title="Paid"
          count={stats.statusData.Paid.count}
          reportedAmount={stats.statusData.Paid.reported}
          secondaryLabel="Amt. Paid"
          secondaryAmount={stats.statusData.Paid.collected}
          color="text-emerald-600 dark:text-emerald-400"
          accentBar="bg-emerald-500"
        />
        <SecondaryMetricCard
          title="Deceased Clients"
          count={stats.deadWriteOff.count}
          reportedAmount={stats.deadWriteOff.reported}
          secondaryLabel="Total Loan"
          secondaryAmount={stats.deadWriteOff.amount}
          color="text-slate-400 dark:text-slate-500"
          accentBar="bg-slate-300 dark:bg-slate-600"
          footerNote="Excluded from stats"
        />
      </div>

      {/* Performance & Terminal Modules: Overall Performance (Left) & Write-Off Module Reports (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 items-stretch">

        {/* LEFT: Overall Performance */}
        <div className="bg-white dark:bg-slate-800 p-4 md:p-4.5 rounded-2xl shadow-[0_2px_12px_-3px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 transition-colors duration-300 flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3.5 gap-2.5 border-b border-slate-100 dark:border-slate-700/50 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shadow-xs">
                    🎯
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Overall Performance</h2>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Based on {performanceBasis === 'reported' ? 'monthly reported' : 'maturity date'} · {activePerformanceYear?.id || 'Overall'} · {selectedBranch}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-1 rounded-lg">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                  ⚡ Efficiency: {collectionPerformanceGrandTotal.efficiencyRate.toFixed(1)}%
                </span>
                <span className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                  {collectionPerformanceGrandTotal.totalAccounts.toLocaleString()} Accts
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2" aria-label="Performance report view">
              <div role="tablist" aria-label="Performance date basis" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-0.5 shadow-xs">
                {(['reported', 'maturity'] as const).map(basis => (
                  <button
                    key={basis}
                    type="button"
                    role="tab"
                    onClick={() => setPerformanceBasis(basis)}
                    aria-selected={performanceBasis === basis}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${performanceBasis === basis ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {basis === 'reported' ? 'Monthly Reported' : 'Maturity Date'}
                  </button>
                ))}
              </div>
              <div role="tablist" aria-label={`${performanceBasis === 'reported' ? 'Monthly Reported' : 'Maturity Date'} period`} className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-0.5 shadow-xs">
                  {[{ id: 'overall' }, ...performanceYearlyPeriods].map(period => (
                    <button
                      key={period.id}
                      type="button"
                      role="tab"
                      onClick={() => performanceBasis === 'reported' ? setReportedPerformancePeriod(period.id) : setMaturityPerformancePeriod(period.id)}
                      aria-selected={selectedPerformancePeriod === period.id}
                      className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors ${selectedPerformancePeriod === period.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      {period.id === 'overall' ? 'Overall Report' : period.id}
                    </button>
                  ))}
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-3.5">
              {performanceBasis === 'reported'
                ? `Date basis: Monthly Reported. ${activePerformanceYear ? `Includes accounts reported in ${activePerformanceYear.id}.` : 'Includes all reported periods.'}`
                : `Date basis: Maturity Date. ${activePerformanceYear ? `Includes loans maturing in ${activePerformanceYear.id}, regardless of month reported.` : 'Includes all maturity dates.'}`}
              {' '}Collection performance uses the same calculations as the Reports matrix.
            </p>
            {dateFilter !== 'all' && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-2 mb-3">
                Performance totals follow the report tab and are not changed by the Dashboard activity date filter.
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Row 1, Card 1: Target (Reported) */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      🎯 Target
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                      {collectionPerformanceGrandTotal.totalAccounts.toLocaleString()} Accts
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.reportedAmount.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Active</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold">{collectionPerformanceGrandTotal.activeAccounts.toLocaleString()} Accts</span>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
              </div>

              {/* Row 1, Card 2: Actual Collection */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      💳 Actual Collection
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                      Post-Report
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.actualCollectedAmount.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Reported Base</span>
                  <span className="text-slate-700 dark:text-slate-300 font-extrabold">Excl. excess</span>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
              </div>

              {/* Row 1, Card 3: Balance */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-amber-200 dark:hover:border-amber-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      📉 Balance
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                      Remaining
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.runningBalance.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Exposure</span>
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">{collectionPerformanceGrandTotal.activeAccounts.toLocaleString()} Unsettled</span>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>
              </div>

              {/* Row 2, Card 1: Excess Collection */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                      ⚡ Excess Collection
                    </span>
                    <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-1 py-0.5 rounded border border-orange-200/60 dark:border-orange-800/60">
                      Overpayment
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400 tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.excessCollection.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  Beyond reported balance
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-orange-500"></div>
              </div>

              {/* Row 2, Card 2: Write-Off Valid Collections */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                      📋 Write-Off Valid Collection
                    </span>
                    <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60 px-1 py-0.5 rounded border border-violet-200/60 dark:border-violet-800/60">
                      Terminal
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.writeOffValidCollections.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  Valid on terminal accts
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-violet-500"></div>
              </div>

              {/* Row 2, Card 3: Overall Total Collected */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      💰 Overall Total Collected
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                      All Inflow
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">
                    ₱{collectionPerformanceGrandTotal.collectedAmount.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Total Inflow</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">All valid</span>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
              </div>
            </div>

            {/* Overall Efficiency Rate Bar */}
            <div className="mt-2.5 bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-teal-200 dark:hover:border-teal-900/50 transition-all shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                    ⚡ Efficiency Rate:
                  </span>
                  <span className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400 tabular-nums">
                    {collectionPerformanceGrandTotal.efficiencyRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-left sm:text-right text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Target Recovery: <span className="text-teal-600 dark:text-teal-400 font-extrabold tabular-nums">₱{collectionPerformanceGrandTotal.actualCollectedAmount.toLocaleString()}</span> <span className="text-slate-400">/</span> ₱{collectionPerformanceGrandTotal.reportedAmount.toLocaleString()}
                </div>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, collectionPerformanceGrandTotal.efficiencyRate))}%` }}
                ></div>
              </div>
              <div className="absolute top-0 right-0 w-1 h-full bg-teal-500"></div>
            </div>
          </div>
        </div>

        {/* RIGHT: Write-Off Module Reports */}
        <div className="bg-white dark:bg-slate-800 p-4 md:p-4.5 rounded-2xl shadow-[0_2px_12px_-3px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 transition-colors duration-300 flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm shadow-xs">
                    📋
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Write-Off Reports</h2>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Terminal accounts & write-off portfolio summary for {selectedBranch}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 px-2.5 py-1 rounded-lg">
                <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                  📊 Total: ₱{writeOffStats.total.amount.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-purple-600/80 dark:text-purple-400/80 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded">
                  {writeOffStats.total.count} Accts
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3" aria-label="Write-off classification overview">
              <div className="inline-flex items-center gap-2 rounded-lg border border-purple-200/60 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/30 px-2.5 py-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 shadow-xs">
                <span className="uppercase tracking-wider">Classification:</span>
                <span className="font-extrabold text-purple-900 dark:text-purple-200">
                  Located ({writeOffStats.located.count}) · Unlocated ({writeOffStats.unlocated.count}) · Deceased ({writeOffStats.deceased.count})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Located Write-Off */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      📍 Located Write-Off
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-xs border border-slate-200/60 dark:border-slate-700">
                      {writeOffStats.located.count} Acct{writeOffStats.located.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                    ₱{writeOffStats.located.amount.toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-[9px] font-bold">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/40 dark:border-amber-800/40">
                    <span className="flex items-center gap-1">⏳ Pending Review</span>
                    <span>{writeOffStats.located.pending.count} (₱{writeOffStats.located.pending.amount.toLocaleString()})</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/40 dark:border-emerald-800/40">
                    <span className="flex items-center gap-1">✓ Officially Approved</span>
                    <span>{writeOffStats.located.official.count} (₱{writeOffStats.located.official.amount.toLocaleString()})</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
              </div>

              {/* Unlocated Write-Off */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-amber-200 dark:hover:border-amber-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      🔍 Unlocated Write-Off
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-xs border border-slate-200/60 dark:border-slate-700">
                      {writeOffStats.unlocated.count} Acct{writeOffStats.unlocated.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                    ₱{writeOffStats.unlocated.amount.toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-[9px] font-bold">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/40 dark:border-amber-800/40">
                    <span className="flex items-center gap-1">⏳ Pending Review</span>
                    <span>{writeOffStats.unlocated.pending.count} (₱{writeOffStats.unlocated.pending.amount.toLocaleString()})</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/40 dark:border-emerald-800/40">
                    <span className="flex items-center gap-1">✓ Officially Approved</span>
                    <span>{writeOffStats.unlocated.official.count} (₱{writeOffStats.unlocated.official.amount.toLocaleString()})</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>
              </div>

              {/* Deceased Clients */}
              <div className="bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col justify-between relative overflow-hidden group hover:border-purple-200 dark:hover:border-purple-900/50 transition-all shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                      🕊️ Deceased Accounts
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                      {writeOffStats.deceased.count} Acct{writeOffStats.deceased.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                    ₱{writeOffStats.deceased.amount.toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-[9px] font-bold">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 bg-purple-50/50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded border border-purple-200/30 dark:border-purple-800/30">
                    <span>Direct Settlement</span>
                    <span className="font-extrabold text-purple-700 dark:text-purple-300">Terminal</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[8px] italic">
                    <span>Active Excluded</span>
                    <span>Non-recoverable</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>
              </div>

              {/* Total Write-Off Portfolio */}
              <div className="bg-purple-50/60 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-200/70 dark:border-purple-800/60 flex flex-col justify-between relative overflow-hidden group shadow-xs min-h-[108px]">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1">
                      📊 Total Write-Off
                    </span>
                    <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-700">
                      {writeOffStats.total.count} Accts
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-950 dark:text-purple-100 tabular-nums leading-tight">
                    ₱{writeOffStats.total.amount.toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-purple-200/70 dark:border-purple-800/60 flex flex-col gap-1 text-[9px] font-bold">
                  <div className="flex items-center justify-between text-purple-800 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-900/40 px-1.5 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40">
                    <span>Full Portfolio</span>
                    <span>Located + Unlocated + Deceased</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 text-[8px]">
                    <span>Quarantined Sum</span>
                    <span className="font-extrabold">{writeOffStats.total.count} Accounts</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-1 h-full bg-purple-600"></div>
              </div>
            </div>

            {/* Quarantined Portfolio Notice */}
            <div className="mt-2.5 bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  Terminal Quarantined Portfolio: <strong className="text-purple-800 dark:text-purple-300">{writeOffStats.total.count} Accounts</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Write-Off Exposure:</span>
                <span className="font-black text-purple-700 dark:text-purple-300 tabular-nums">₱{writeOffStats.total.amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch mt-6">
        {/* Collection Trend Chart */}
      <>
          <div className="xl:col-span-5 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 transition-colors duration-300 flex flex-col h-[500px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#064e3b] dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                  Collection Trend
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Daily collection activity over the last 30 days</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">30-Day Total</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">₱{collectionTrend.totalCollected30.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg / Day</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">₱{Math.round(collectionTrend.avgDaily).toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transactions</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">{collectionTrend.totalTransactions30.toLocaleString()}</div>
                </div>
                {collectionTrend.peakDay && collectionTrend.peakDay.amount > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Day</div>
                    <div className="text-sm font-black text-blue-600 dark:text-blue-400">{collectionTrend.peakDay.label} — ₱{collectionTrend.peakDay.amount.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 mt-4 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={collectionTrend.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#064e3b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#064e3b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(collectionTrend.trendData.length / 7)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: '12px 16px',
                    }}
                    formatter={(value: number, name: string) => [
                      `₱${value.toLocaleString()}`,
                      name === 'amount' ? 'Daily Collection' : 'Cumulative'
                    ]}
                    labelFormatter={(label: string) => `📅 ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#064e3b"
                    strokeWidth={2.5}
                    fill="url(#gradientAmount)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: '#064e3b' }}
                    name="amount"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
      </>

        {/* CENTER: Collector Performance Matrix */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[500px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
               <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Collector Performance Matrix</h3>
               <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Handled balance distribution per field personnel</span>
            </div>
            <select 
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 py-2 px-4 rounded-xl outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                value={collectorViewMode}
                onChange={(e) => setCollectorViewMode(e.target.value as 'Balance View' | 'Performance View')}
            >
                <option value="Balance View">Balance View</option>
                <option value="Performance View">Performance View</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-2 custom-scrollbar space-y-6 mt-2">
             {sortedCollectorData.map(cd => {
                 const percentage = cd.reportedAmount > 0 ? (cd.collectedAmount / cd.reportedAmount) * 100 : 0;
                 return (
                     <div key={cd.collector} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 group">
                         <div className="w-full sm:w-32 shrink-0 font-bold text-sm text-slate-700 dark:text-slate-300 truncate">
                             {cd.collector}
                         </div>
                         <div className="flex-1 h-3.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative shadow-inner">
                             <div className="absolute top-0 left-0 h-full bg-[#064e3b] dark:bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.max(Math.min(percentage, 100), 1)}%` }}></div>
                         </div>
                         <div className="w-full sm:w-32 shrink-0 text-left sm:text-right flex flex-row sm:flex-col justify-between sm:justify-start">
                             <div className="font-bold text-sm text-slate-800 dark:text-white">₱{cd.collectedAmount.toLocaleString()}</div>
                             <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">/ ₱{cd.reportedAmount.toLocaleString()}</div>
                         </div>
                     </div>
                 )
             })}
             {collectorData.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No data available for the chosen branch.</div>
             )}
          </div>
        </div>

        {/* RIGHT SIDE: Account Distribution */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[500px]">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Account Distribution</h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Client load by personnel</span>
          </div>

          <div className="relative h-56 flex items-center justify-center shrink-0 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={collectorDistribution} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                  {collectorDistribution.map((_, index) => {
                     const chartColors = ['#064e3b', '#047857', '#10b981', '#34d399', '#6ee7b7', '#94a3b8', '#cbd5e1'];
                     return <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
               <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{stats.totalAccounts}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Clients</span>
            </div>
          </div>

          <div className="space-y-1.5 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {collectorDistribution.map((item, index) => {
              const listColors = ['#064e3b', '#047857', '#10b981', '#34d399', '#6ee7b7', '#94a3b8', '#cbd5e1'];
              const color = listColors[index % listColors.length];
              return (
              <div key={item.name} className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-200">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-md shadow-sm" style={{ backgroundColor: color }}></div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                 </div>
                 <div className="text-right whitespace-nowrap">
                   <span className="font-bold text-slate-800 dark:text-white">{item.total.toLocaleString()}</span> <span className="text-[9px] text-slate-400 uppercase tracking-wider">Total</span> / <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.value.toLocaleString()}</span> <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Active</span>
                 </div>
              </div>
            )})}
            {collectorDistribution.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-sm">No clients assigned.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch mt-6">
        {/* Today's Action Summary */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[400px]">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#064e3b] dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Today's Action Summary
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tasks requiring immediate attention</p>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex items-center justify-between">
               <div>
                  <div className="text-blue-800 dark:text-blue-300 font-bold">Promises to Pay</div>
                  <div className="text-blue-600/70 dark:text-blue-400/70 text-xs font-semibold mt-0.5">Due today</div>
               </div>
               <div className="text-2xl font-black text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm">{todayActions.ptpDue}</div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex items-center justify-between">
               <div>
                  <div className="text-amber-800 dark:text-amber-300 font-bold">Follow-ups</div>
                  <div className="text-amber-600/70 dark:text-amber-400/70 text-xs font-semibold mt-0.5">Scheduled today</div>
               </div>
               <div className="text-2xl font-black text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm">{todayActions.followUpDue}</div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800/30 flex items-center justify-between">
               <div>
                  <div className="text-red-800 dark:text-red-300 font-bold">Overdue / Missed</div>
                  <div className="text-red-600/70 dark:text-red-400/70 text-xs font-semibold mt-0.5">Past due promises & follow-ups</div>
               </div>
               <div className="text-2xl font-black text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm">{todayActions.missed}</div>
            </div>
          </div>
        </div>

        {/* Near Full Payment */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[400px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#064e3b] dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Near Full Payment
                </h3>
                {nearFullPaymentClients.length > 0 && (
                  <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-black px-2 py-0.5 rounded-full">
                    {nearFullPaymentClients.length} Clients
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Clients with ₱1,000 or less remaining balance
                {nearFullPaymentClients.length > 0 && (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-bold">
                    (Total: ₱{nearFullTotalAmount.toLocaleString()})
                  </span>
                )}
              </p>
            </div>
            <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
              <select
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 py-2 px-4 rounded-xl outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                value={nearFullCollectorFilter}
                onChange={(e) => setNearFullCollectorFilter(e.target.value)}
              >
                <option value="">All Collectors</option>
                {Array.from(new Set(loans.map(l => getCollectorDisplayName(l.collector, allCollectors)))).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={handleExportNearFullPayment}
                disabled={nearFullPaymentClients.length === 0}
                className="bg-[#064e3b] hover:bg-[#043326] disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-500 px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                title="Export Near Full Payment clients"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export
              </button>
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {(() => {
              if (nearFullPaymentClients.length === 0) {
                return <p className="text-center py-8 text-slate-400 italic text-sm">No clients with ₱1,000 or less balance in this branch.</p>;
              }

              return nearFullPaymentClients.map((loan) => {
                const collectorName = getCollectorDisplayName(loan.collector, allCollectors);
                return (
                  <div key={loan.id} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:shadow-sm transition-all duration-300 border border-transparent hover:border-emerald-100 dark:hover:border-slate-600">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shadow-sm text-lg">✅</div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white text-sm">{loan.borrowerName}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Collector: {collectorName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600 dark:text-emerald-400">₱{loan.runningBalance.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Remaining</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="bg-[#064e3b] text-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-emerald-900/20 relative overflow-hidden flex flex-col justify-center h-[400px]">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <span className="text-3xl animate-pulse">✨</span> AI Collection Advisor
              </h3>
              <button
                onClick={fetchAiInsight}
                disabled={isAiLoading}
                className="bg-white/10 backdrop-blur hover:bg-white/20 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 border border-white/10"
              >
                {isAiLoading ? 'Analyzing...' : 'Refresh Insights'}
              </button>
            </div>
            <div className="flex-1 bg-black/20 backdrop-blur-md p-6 rounded-2xl border border-white/10 overflow-y-auto custom-scrollbar">
              {aiInsight ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="leading-relaxed text-emerald-50 font-medium whitespace-pre-wrap">{aiInsight}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-6">
                  <div className="w-14 h-14 bg-emerald-800/80 rounded-2xl flex items-center justify-center mb-4 text-2xl shadow-inner border border-white/5">🤖</div>
                  <p className="italic text-emerald-300 font-medium text-sm">Click "Refresh Insights" to let Gemini scan branch data for collection strategies.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
