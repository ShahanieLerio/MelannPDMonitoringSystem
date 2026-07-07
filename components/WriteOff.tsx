import React, { useEffect, useMemo, useState } from 'react';
import { store } from '../services/dataStore.ts';
import { Branch, DispositionStatus, DispositionType, Loan, ManagementDisposition, User, canApproveWriteOff } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface WriteOffProps {
  currentUser: User;
  selectedBranch: Branch;
}

type WriteOffRow = {
  loan: Loan;
  disposition: ManagementDisposition;
};

type SortKey = 'client' | 'maturityDate' | 'decisionDate' | 'runningBalance';
type SortDirection = 'asc' | 'desc';

const currency = (value: number) => `PHP ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactCurrency = (value: number) => `PHP ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const WriteOff: React.FC<WriteOffProps> = ({ currentUser, selectedBranch }) => {
  const [loans, setLoans] = useState<Loan[]>(() => store.getLoans(selectedBranch));
  const [dispositions, setDispositions] = useState<ManagementDisposition[]>(() => store.getAllDispositions());
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

  const writeOffRows = useMemo(() => {
    const loansById = new Map(loans.map(loan => [loan.id, loan]));
    const latestProspectByLoan = new Map<string, ManagementDisposition>();

    dispositions
      .filter(disposition => disposition.type === DispositionType.PROSPECT_WRITE_OFF)
      .forEach(disposition => {
        if (!latestProspectByLoan.has(disposition.loanId)) {
          latestProspectByLoan.set(disposition.loanId, disposition);
        }
      });

    const rows: WriteOffRow[] = [];
    latestProspectByLoan.forEach(disposition => {
      const loan = loansById.get(disposition.loanId);
      if (loan) rows.push({ loan, disposition });
    });

    return rows;
  }, [loans, dispositions]);

  const pendingRows = writeOffRows.filter(row => row.disposition.status === DispositionStatus.PENDING_REVIEW);
  const officialRows = writeOffRows.filter(row =>
    row.disposition.status === DispositionStatus.APPROVED ||
    row.disposition.status === DispositionStatus.EXECUTED
  );

  const activeRows = activeTab === 'pending' ? pendingRows : officialRows;

  const collectorOptions = useMemo(() => {
    return Array.from(new Set(activeRows.map(row => row.loan.collector).filter(Boolean))).sort();
  }, [activeRows]);

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
        return row.loan.runningBalance;
      default:
        return 0;
    }
  };

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

  const totalPendingAmount = pendingRows.reduce((sum, row) => sum + row.loan.runningBalance, 0);
  const totalOfficialAmount = officialRows.reduce((sum, row) => sum + row.loan.runningBalance, 0);
  const canApprove = canApproveWriteOff(currentUser.role);
  const getTotalLoanAmount = (loan: Loan) => Number(loan.totalLoan || loan.outstandingBalance || loan.runningBalance || 0);
  const getTotalCollected = (loan: Loan) => {
    const paymentTotal = (loan.payments || [])
      .filter(payment => payment.status !== 'REVERSED')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return paymentTotal || Number(loan.amountCollected || 0);
  };
  const activeTotalLoanAmount = activeRows.reduce((sum, row) => sum + getTotalLoanAmount(row.loan), 0);
  const activeTotalCollected = activeRows.reduce((sum, row) => sum + getTotalCollected(row.loan), 0);

  const approveWriteOff = async (row: WriteOffRow) => {
    if (!canApprove) {
      setApprovalWarningOpen(true);
      return;
    }

    setApprovingId(row.disposition.id);
    setFeedback(null);

    try {
      await store.updateDispositionStatus(row.disposition.id, DispositionStatus.APPROVED, currentUser.username, currentUser.role);
      await store.updateLoan(
        row.loan.id,
        {
          ...row.loan,
          actionStage: 'For Write-Off',
          actionNote: `Officially Approved Write-Off by ${currentUser.fullName || currentUser.username} on ${formatDate(new Date().toISOString())}`
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
      className={`group inline-flex w-full items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'} transition-colors hover:text-slate-900 dark:hover:text-white`}
    >
      <span>{label}</span>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/50 text-[10px] transition-colors group-hover:bg-slate-200 dark:bg-slate-800 dark:group-hover:bg-slate-700 ${sortKey === columnKey ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50' : 'text-slate-400'}`}>
        {sortKey === columnKey ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );

  const RowTable = ({ rows }: { rows: WriteOffRow[] }) => (
    <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-xl shadow-slate-200/20 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-none">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left">
          <thead className="bg-slate-50/80 text-[8px] font-black uppercase tracking-[0.08em] text-slate-500 backdrop-blur-md dark:bg-slate-950/50 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
            <tr>
              <th className="w-[17%] px-2 py-3"><SortButton columnKey="client" label="Client" /></th>
              <th className="w-[8%] px-2 py-3">Collector</th>
              <th className="w-[8%] px-2 py-3"><SortButton columnKey="maturityDate" label="Maturity" /></th>
              <th className="w-[8%] px-2 py-3"><SortButton columnKey="decisionDate" label="Decision" /></th>
              <th className="w-[15%] px-2 py-3">Reason</th>
              <th className="w-[10%] px-2 py-3">Officer</th>
              <th className="w-[9%] px-2 py-3 text-right">Total Loan</th>
              <th className="w-[9%] px-2 py-3 text-right">Collected</th>
              <th className="w-[9%] px-2 py-3 text-right"><SortButton columnKey="runningBalance" label="Balance" align="right" /></th>
              <th className="w-[7%] px-2 py-3 text-center">Status</th>
              {activeTab === 'pending' && <th className="w-[8%] px-2 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(row => (
              <tr key={row.disposition.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/20 ring-1 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black text-xs">
                      {row.loan.borrowerName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black text-slate-900 dark:text-white transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400" title={row.loan.borrowerName}>{row.loan.borrowerName}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">ID: {row.loan.code}</span>
                        {row.disposition.status === DispositionStatus.APPROVED && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <span className="mr-1 h-1 w-1 rounded-full bg-emerald-500"></span> Approved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <svg className="h-3 w-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{row.loan.collector}</span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatDate(row.loan.dueDate)}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Maturity</span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatDate(row.disposition.decisionDate)}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Decision</span>
                  </div>
                </td>
                <td className="px-2 py-3 whitespace-normal">
                  <div className="line-clamp-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200" title={row.disposition.reason}>
                    {row.disposition.reason}
                  </div>
                  {row.disposition.evidence.length > 0 && (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700 border border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {row.disposition.evidence.length} Evidence Item{row.disposition.evidence.length !== 1 && 's'}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="inline-flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {row.disposition.decidedBy.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200" title={row.disposition.decidedBy}>{row.disposition.decidedBy}</span>
                  </div>
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-slate-700 dark:text-slate-200">{compactCurrency(getTotalLoanAmount(row.loan))}</div>
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="text-[11px] font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">{compactCurrency(getTotalCollected(row.loan))}</div>
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="text-[11px] font-black text-slate-900 dark:text-white tabular-nums tracking-tight">{compactCurrency(row.loan.runningBalance)}</div>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${
                    row.disposition.status === DispositionStatus.PENDING_REVIEW
                      ? 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${row.disposition.status === DispositionStatus.PENDING_REVIEW ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                    {row.disposition.status === DispositionStatus.PENDING_REVIEW ? 'Pending' : 'Approved'}
                  </span>
                </td>
                {activeTab === 'pending' && (
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      disabled={approvingId === row.disposition.id}
                      onClick={() => approveWriteOff(row)}
                      className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-slate-900 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
                            Processing...
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
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={activeTab === 'pending' ? 11 : 10} className="px-4 py-24 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                      No records found
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      There are no clients in the current view that match your criteria.
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Management Approval
            </div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">Write-Off Center</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Review and finalize prospects for write-off. Clients escalated from the Action Tracker are securely queued here for your executive decision.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4 xl:shrink-0">
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-amber-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
              <div className="relative z-10 flex items-center justify-between gap-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">Pending Review</div>
                  <div className="mt-1 text-3xl font-black tracking-tight text-white">{pendingRows.length}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Value</div>
                  <div className="mt-1 text-sm font-black text-amber-200">{currency(totalPendingAmount)}</div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
               <div className="relative z-10 flex items-center justify-between gap-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300/80">Official</div>
                  <div className="mt-1 text-3xl font-black tracking-tight text-white">{officialRows.length}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Value</div>
                  <div className="mt-1 text-sm font-black text-emerald-200">{currency(totalOfficialAmount)}</div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
              <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-300/80">Total Loan Amount</div>
                <div className="mt-2 text-base font-black text-blue-100 tabular-nums">{currency(activeTotalLoanAmount)}</div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">{activeTab === 'pending' ? 'Pending Review' : 'Official'} Set</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-teal-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
              <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-widest text-teal-300/80">Total Collected</div>
                <div className="mt-2 text-base font-black text-teal-100 tabular-nums">{currency(activeTotalCollected)}</div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">{activeTab === 'pending' ? 'Pending Review' : 'Official'} Set</div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/60 p-2 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`relative rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === 'pending' 
                ? 'bg-white text-amber-600 shadow-md dark:bg-slate-700 dark:text-amber-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Pending Review
            <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>{pendingRows.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('official')}
            className={`relative rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === 'official' 
                ? 'bg-white text-emerald-600 shadow-md dark:bg-slate-700 dark:text-emerald-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Officially Approved
            <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === 'official' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>{officialRows.length}</span>
          </button>
        </div>
        
        <div className="flex w-full flex-col gap-2 px-1 md:w-auto md:flex-row md:items-center">
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

      <RowTable rows={visibleRows} />

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
