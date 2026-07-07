
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { PriorityLevel, Branch, User, Loan, Remark } from '../types.ts';
import ClientModal from './ClientModal.tsx';
import ClientFormModal from './ClientFormModal.tsx';
import RemarksModal from './RemarksModal.tsx';
import VisitLogModal from './VisitLogModal.tsx';
import { useClientUpdates } from '../hooks/useClientUpdates.ts';
import { hasActiveClientBalance } from '../services/loanUtils.ts';

interface ClientUpdateProps {
  selectedBranch: Branch;
  currentUser: User;
  activeView?: 'All' | 'Priority' | 'Monitoring' | 'No Commitments' | 'Follow-up' | 'Updates Log';
}

interface ReminderItem {
  loan: Loan;
  date: string; // ISO date or "Tomorrow"
  type: 'Payment' | 'Visit' | 'Callback' | 'Follow-up';
  context: string;
}

type CommitmentOutcome = 'Missed' | 'Rescheduled' | 'Visited' | 'No Contact';
type CriticalActionLoan = Loan & { latestRemark: Remark };
type ClientUpdatePrintMode = 'critical' | 'monitoring';

const COLLECTOR_ACCOUNTABILITY_ORDER = ['ALDIE', 'EDDIE', 'NOEL', 'LITO', 'MASOY', 'TATA'];

const getCollectorOrderRank = (collector?: string) => {
  const rank = COLLECTOR_ACCOUNTABILITY_ORDER.indexOf((collector || '').trim().toUpperCase());
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
};

const sortCollectors = (a: string, b: string) => {
  const aOrder = getCollectorOrderRank(a);
  const bOrder = getCollectorOrderRank(b);
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.localeCompare(b);
};

const getLoanAddress = (loan: Loan) => {
  const fullAddress = loan.fullAddress?.trim();
  if (fullAddress) return fullAddress;
  return [loan.barangay, loan.city, loan.area].filter(Boolean).join(', ');
};

const formatPrintDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const formatRecurringScheduleLabel = (loan: Loan, compact = false) => {
  const schedule = loan.recurringSchedule;
  if (!schedule?.enabled) return '';
  if (schedule.type === 'everyday') return compact ? 'Everyday' : 'Everyday, Mon-Sat';
  if (schedule.type === 'weekly') {
    return schedule.weekDays?.map(n => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(' & ') || '';
  }
  return schedule.days?.join(' & ') || '';
};

const ClientUpdate: React.FC<ClientUpdateProps> = ({ selectedBranch, currentUser, activeView }) => {
  const { loans, updateList, topPriorityList, reminderList, closeMonitoringList, filteredMainList } = useClientUpdates(selectedBranch);
  const activeFilter = activeView || 'All';
  const [collapsedSections, setCollapsedSections] = useState({
    priority: false,
    monitoring: false,
    reminders: false,
    noActivity: false,
    log: false
  });

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [remarksLoan, setRemarksLoan] = useState<Loan | null>(null);
  const [visitLogLoan, setVisitLogLoan] = useState<Loan | null>(null);
  const [printMode, setPrintMode] = useState<ClientUpdatePrintMode | null>(null);
  const currentRemarksLoan = useMemo(() => {
    if (!remarksLoan) return null;
    return loans.find(loan => loan.id === remarksLoan.id) || remarksLoan;
  }, [loans, remarksLoan]);

  const todayStr = new Date().toISOString().split('T')[0];

  const refreshData = () => {
    // Rely on the hook's subscription for updates
  };

  useEffect(() => {
    // Run Same-Day No-Payment Check
    // If a client in Top Priority (remark date != today) AND not paid -> Downgrade priority
    const checkExpiredPriority = async () => {
      const todayStr = new Date().toDateString();
      const currentLoans = store.getLoans(selectedBranch);

      currentLoans.forEach(async (loan) => {
        if (loan.aiPriority === PriorityLevel.TOP && loan.status !== 'Paid' && loan.remarks.length > 0) {
          const lastRemarkDate = new Date(loan.remarks[loan.remarks.length - 1].timestamp).toDateString();
          // If remark was NOT today (i.e. older commitment) and still top priority -> move to need attention
          if (lastRemarkDate !== todayStr) {
            await store.updateLoan(loan.id, { aiPriority: PriorityLevel.NEED_ATTENTION }, 'System', 'Auto-Detection');
          }
        }
      });
    };
    checkExpiredPriority();
  }, [selectedBranch]);

  const noActivityList = useMemo(() => {
    return loans.filter(l => l.remarks.length === 0 && hasActiveClientBalance(l));
  }, [loans]);

  const collectorSummary = useMemo(() => {
    const summary = new Map<string, {
      collector: string;
      critical: number;
      followUps: number;
      monitoring: number;
      noActivity: number;
      total: number;
    }>();

    const ensureCollector = (collector?: string) => {
      const name = collector?.trim() || 'UNASSIGNED';
      if (!summary.has(name)) {
        summary.set(name, { collector: name, critical: 0, followUps: 0, monitoring: 0, noActivity: 0, total: 0 });
      }
      return summary.get(name)!;
    };

    loans.filter(hasActiveClientBalance).forEach(loan => {
      ensureCollector(loan.collector).total += 1;
    });
    topPriorityList.forEach((loan: any) => {
      ensureCollector(loan.collector).critical += 1;
    });
    reminderList.forEach(item => {
      ensureCollector(item.loan.collector).followUps += 1;
    });
    closeMonitoringList.forEach((loan: any) => {
      ensureCollector(loan.collector).monitoring += 1;
    });
    noActivityList.forEach(loan => {
      ensureCollector(loan.collector).noActivity += 1;
    });

    return Array.from(summary.values())
      .filter(item => item.total > 0)
      .sort((a, b) => {
        const aOrder = getCollectorOrderRank(a.collector);
        const bOrder = getCollectorOrderRank(b.collector);
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aWork = a.critical + a.monitoring + a.followUps + a.noActivity;
        const bWork = b.critical + b.monitoring + b.followUps + b.noActivity;
        return bWork - aWork || a.collector.localeCompare(b.collector);
      });
  }, [loans, topPriorityList, reminderList, closeMonitoringList, noActivityList]);

  const criticalActionPrintGroups = useMemo(() => {
    const groups = new Map<string, CriticalActionLoan[]>();

    (topPriorityList as CriticalActionLoan[]).forEach(loan => {
      const collector = loan.collector?.trim() || 'UNASSIGNED';
      if (!groups.has(collector)) groups.set(collector, []);
      groups.get(collector)!.push(loan);
    });

    return Array.from(groups.entries())
      .map(([collector, items]) => ({
        collector,
        items: items
          .slice()
          .sort((a, b) => a.borrowerName.localeCompare(b.borrowerName) || a.code.localeCompare(b.code))
      }))
      .sort((a, b) => sortCollectors(a.collector, b.collector));
  }, [topPriorityList]);

  const closeMonitoringPrintGroups = useMemo(() => {
    const groups = new Map<string, Loan[]>();

    (closeMonitoringList as Loan[]).forEach(loan => {
      const collector = loan.collector?.trim() || 'UNASSIGNED';
      if (!groups.has(collector)) groups.set(collector, []);
      groups.get(collector)!.push(loan);
    });

    return Array.from(groups.entries())
      .map(([collector, items]) => ({
        collector,
        items: items
          .slice()
          .sort((a, b) => a.borrowerName.localeCompare(b.borrowerName) || a.code.localeCompare(b.code))
      }))
      .sort((a, b) => sortCollectors(a.collector, b.collector));
  }, [closeMonitoringList]);

  const printDateLabel = useMemo(() => formatPrintDate(new Date()), []);

  const handlePrintClientUpdate = (mode: ClientUpdatePrintMode) => {
    setPrintMode(mode);
    document.body.classList.add('client-update-printing');
    window.setTimeout(() => window.print(), 0);
  };

  useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('client-update-printing');
      setPrintMode(null);
    };

    window.addEventListener('afterprint', clearPrintMode);
    return () => {
      window.removeEventListener('afterprint', clearPrintMode);
      clearPrintMode();
    };
  }, []);



  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
    <div className="space-y-8 animate-fadeIn pb-20 no-print">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center transition-colors duration-300 bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight transition-colors duration-300 mb-1">Client Pulse & Updates</h2>
          <p className="text-slate-400 font-medium text-sm transition-colors duration-300">Real-time analysis of collector feedback for: <span className="text-emerald-600 font-bold">{selectedBranch}</span></p>
        </div>
        <div className="flex items-center gap-6">
        </div>
      </div>

      {/* QUICK FILTERS REMOVED (Now handled by Sidebar) */}

      {/* 1️⃣ CLOSE MONITORING — Highest Priority */}
      <CollectorAccountabilitySummary summary={collectorSummary} />

      {(activeFilter === 'All' || activeFilter === 'Monitoring') && (
        <section className="bg-rose-50/30 rounded-[1.5rem] p-6 shadow-sm border border-rose-200 space-y-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
              <h3 className="text-sm font-black text-rose-900 uppercase tracking-[0.2em]">Close Monitoring Queue</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintClientUpdate('monitoring')}
                disabled={closeMonitoringList.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Print Close Monitoring summary by collector"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                </svg>
                Print by Collector
              </button>
              <button onClick={() => toggleSection('monitoring')} className="p-2 hover:bg-rose-100 rounded-xl transition-colors group">
              <span className={`block text-md transition-transform duration-300 text-rose-500 group-hover:text-rose-700 ${collapsedSections.monitoring ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          </div>
          
          {!collapsedSections.monitoring && (
              <CloseMonitoringTable 
                data={closeMonitoringList} 
                onViewDetails={setSelectedLoan}
                onEdit={setEditLoan}
                onAddRemark={setRemarksLoan}
                onVisitLog={setVisitLogLoan}
              />
          )}
        </section>
      )}

      {/* 2️⃣ CRITICAL ACTION: PRIORITY CASES */}
      {(activeFilter === 'All' || activeFilter === 'Priority') && (
        <section className="bg-white rounded-[1.5rem] p-6 border border-red-200/60 shadow-[0_0_15px_rgba(239,68,68,0.1)] space-y-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Critical Action: Priority Cases</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintClientUpdate('critical')}
                disabled={topPriorityList.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Print Critical Action summary by collector"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                </svg>
                Print by Collector
              </button>
              <button onClick={() => toggleSection('priority')} className="p-2 hover:bg-red-50 rounded-xl transition-colors group">
              <span className={`block text-lg transition-transform duration-300 text-red-500 group-hover:text-red-700 ${collapsedSections.priority ? 'rotate-180' : ''}`}>▼</span>
              </button>
            </div>
          </div>
          
          {!collapsedSections.priority && (
            topPriorityList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slideIn">
                {topPriorityList.map(item => (
                  <div key={item.id} className="bg-white border border-red-200 p-6 rounded-[1.5rem] shadow-sm hover:shadow-lg hover:border-red-300 hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-600"></div>
                    <div>
                      <div className="flex justify-between items-start mb-4 mt-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">{item.code}</span>
                        {item.promiseToPayDate && item.promiseToPayDate === todayStr && item.runningBalance > 0 && item.status !== 'Paid' ? (
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm animate-pulse">
                             DUE TODAY
                          </span>
                        ) : item.promiseToPayDate && item.promiseToPayDate < todayStr && item.runningBalance > 0 && item.status !== 'Paid' ? (
                          <span className="text-[10px] font-black text-red-600 bg-red-100 px-3 py-1.5 rounded-full border border-red-300 shadow-sm flex items-center gap-1">
                            ⚠️ MISSED PTP
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            HIGH RISK
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-[#111827] text-lg mb-1">{item.borrowerName}</h4>
                      <p className="text-[#6B7280] text-xs mb-4 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="text-[10px]">👤</span> {item.collector}
                      </p>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 shadow-inner">
                        {item.latestRemark.text.includes('[DL_MARKER]') && (
                          <span className="self-start text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded uppercase tracking-widest shadow-lg">
                            DEMAND LETTER FILED
                          </span>
                        )}
                        <span className="text-xs text-[#374151] font-bold italic leading-relaxed">
                          "{item.latestRemark.text.replace('[DL_MARKER]', '').trim()}"
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-center px-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Exposure</div>
                        <div className="text-xl font-black text-[#111827]">₱{item.runningBalance.toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedLoan(item)}
                          className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                          Details
                        </button>
                        <button
                          onClick={() => setRemarksLoan(item)}
                          className="flex-1 py-2.5 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 hover:bg-emerald-50 hover:border-emerald-300 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-1.5 relative"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                          Remarks
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 bg-red-50 border-2 border-red-200 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm border border-red-100">🎉</div>
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase tracking-widest">You're all caught up!</h4>
                  <p className="text-[11px] font-bold text-red-600/60 uppercase tracking-widest mt-1">✅ No urgent cases right now.</p>
                </div>
              </div>
            )
          )}
        </section>
      )}

      {/* 3️⃣ ADVANCE REMINDERS & SCHEDULED FOLLOW-UPS */}
      {(activeFilter === 'All' || activeFilter === 'Follow-up') && (
        <section className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm space-y-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Advance Reminders & Scheduled Follow-ups</h3>
            </div>
            <button onClick={() => toggleSection('reminders')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors group">
              <span className={`block text-md transition-transform duration-300 text-slate-400 group-hover:text-amber-500 ${collapsedSections.reminders ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>
          
          {!collapsedSections.reminders && (
            reminderList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slideIn">
                {reminderList.map((item, idx) => (
                  <div key={`${item.loan.id}-rem-${idx}`} className="bg-white border border-amber-200 p-6 rounded-[1.5rem] shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col justify-between group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
                    <div>
                      <div className="flex justify-between items-start mb-4 mt-2">
                        <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${item.type === 'Payment' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          item.type === 'Visit' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                          {item.type}
                        </div>
                        <span className="text-[10px] font-black text-amber-700 flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                          ⏰ {item.date}
                        </span>
                      </div>
                      <h4 className="font-black text-[#111827] text-sm mb-0.5 truncate">{item.loan.borrowerName}</h4>
                      <p className="text-[10px] text-[#6B7280] font-black uppercase tracking-widest mb-4">{item.loan.code}</p>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 mb-4 shadow-inner">
                        {item.context.includes('[DL_MARKER]') && (
                          <span className="self-start text-[8px] font-black text-white bg-red-500 px-2 py-0.5 rounded uppercase tracking-widest shadow-md">
                            DL PRIORITY
                          </span>
                        )}
                        <span className="text-[11px] text-[#4B5563] font-bold line-clamp-3 italic leading-relaxed">
                          "{item.context.replace('[DL_MARKER]', '').trim()}"
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-[#6B7280] font-black uppercase tracking-[0.1em] border-t border-slate-100 pt-3 mt-auto">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-black text-[9px] shadow-sm group-hover:scale-110 transition-transform">
                          {item.loan.collector.charAt(0)}
                        </div>
                        <span className="text-[9px]">{item.loan.collector}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedLoan(item.loan as unknown as Loan)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Client Details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                        <button
                          onClick={() => setRemarksLoan(item.loan as unknown as Loan)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          title="Remarks"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 bg-slate-50 border-2 border-slate-200 border-dashed rounded-[2rem] flex items-center justify-center h-48">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex flex-col gap-4 items-center">
                  <span className="text-3xl opacity-50">🗓️</span>
                  No upcoming reminders in queue
                </p>
              </div>
            )
          )}
        </section>
      )}

      {/* 4️⃣ NO ACTIVITY QUEUE */}
      {activeFilter === 'No Commitments' && (
        <section className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm space-y-6 relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">No Commitment Queue</h3>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-lg border border-indigo-100">{noActivityList.length}</span>
            </div>
            <button onClick={() => toggleSection('noActivity')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors group">
              <span className={`block text-md transition-transform duration-300 text-slate-400 group-hover:text-indigo-600 ${collapsedSections.noActivity ? 'rotate-180' : ''}`}>v</span>
            </button>
          </div>

          {!collapsedSections.noActivity && (
            noActivityList.length === 0 ? (
              <div className="p-10 bg-slate-50 border-2 border-slate-200 border-dashed rounded-[2rem] flex items-center justify-center h-36">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All clients have at least one field update.</p>
              </div>
            ) : (
              <NoActivityTable
                data={noActivityList}
                onViewDetails={setSelectedLoan}
                onEdit={setEditLoan}
                onAddRemark={setRemarksLoan}
              />
            )
          )}
        </section>
      )}

      {(activeFilter === 'All' || activeFilter === 'Updates Log') && (
        <section className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm space-y-6 relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">All Client Updates Log</h3>
            </div>
            <button onClick={() => toggleSection('log')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors group">
              <span className={`block text-md transition-transform duration-300 text-slate-400 group-hover:text-slate-600 ${collapsedSections.log ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>

          {!collapsedSections.log && (
            (activeFilter === 'Updates Log' ? updateList : filteredMainList).length === 0 ? (
              <div className="py-20 bg-white border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-inner">📢</div>
                <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Registry sweep complete</p>
                <p className="text-[#6B7280] font-bold text-xs mt-2">No client updates to display.</p>
              </div>
            ) : (
              <ClientUpdateTable data={activeFilter === 'Updates Log' ? updateList : filteredMainList} />
            )
          )}
        </section>
      )}

      {selectedLoan && <ClientModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />}
      {(editLoan) && (
        <ClientFormModal
          loan={editLoan || undefined}
          currentUser={currentUser}
          selectedBranch={selectedBranch}
          onClose={() => { setEditLoan(null); refreshData(); }}
          onViewProfile={(l) => {
            setEditLoan(null);
            setSelectedLoan(l);
          }}
        />
      )}
      {currentRemarksLoan && (
        <RemarksModal
          loan={currentRemarksLoan}
          currentUser={currentUser}
          onClose={() => { setRemarksLoan(null); refreshData(); }}
        />
      )}
      {visitLogLoan && (
        <VisitLogModal
          loan={visitLogLoan}
          currentUser={currentUser}
          onClose={() => { setVisitLogLoan(null); refreshData(); }}
        />
      )}
    </div>
    {printMode && (
      <ClientUpdatePrintSheet
        branch={selectedBranch}
        title={printMode === 'critical' ? 'Critical Action Field Sheet' : 'Close Monitoring Field Sheet'}
        printDateLabel={printDateLabel}
        groups={printMode === 'critical' ? criticalActionPrintGroups : closeMonitoringPrintGroups}
        totalCount={printMode === 'critical' ? topPriorityList.length : closeMonitoringList.length}
      />
    )}
    </>
  );
};

function ClientUpdatePrintSheet({
  branch,
  title,
  printDateLabel,
  groups,
  totalCount
}: {
  branch: Branch;
  title: string;
  printDateLabel: string;
  groups: Array<{ collector: string; items: Loan[] }>;
  totalCount: number;
}) {
  return (
    <>
    <style>{`
      @media print {
        body.client-update-printing #root > div {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }

        body.client-update-printing #root > div > main {
          display: block !important;
          height: auto !important;
          overflow: visible !important;
        }

        body.client-update-printing #printable-sheet {
          box-sizing: border-box !important;
          padding-top: 8mm !important;
          page-break-before: auto !important;
        }

        body.client-update-printing #printable-sheet > div {
          break-before: avoid !important;
          page-break-before: avoid !important;
        }
      }
    `}</style>
    <div id="printable-sheet">
      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>Melann Lending</div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: 9, marginTop: 2 }}>
            Branch: {branch} | Date: {printDateLabel} | Total Clients: {totalCount}
          </div>
        </div>

        {groups.length === 0 ? (
          <div style={{ border: '0.5pt solid #000', padding: 10, textAlign: 'center', fontSize: 9 }}>
            No Critical Action clients to print.
          </div>
        ) : (
          groups.map(group => (
            <div key={group.collector} style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: 12 }}>
              <div
                style={{
                  background: '#e5e7eb',
                  border: '0.5pt solid #000',
                  borderBottom: 'none',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '4px 6px',
                  textTransform: 'uppercase'
                }}
              >
                Collector: {group.collector} ({group.items.length})
              </div>
              <table>
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Client Code</th>
                    <th>Client Name</th>
                    <th>Address</th>
                    <th>Pay</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(loan => (
                    <tr key={loan.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{loan.code}</td>
                      <td>{loan.borrowerName}</td>
                      <td>{getLoanAddress(loan)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', width: 12, height: 12, border: '0.8pt solid #000' }}></span>
                      </td>
                      <td style={{ height: 28 }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 9 }}>
          <div>
            Prepared by:
            <div style={{ borderBottom: '0.5pt solid #000', height: 24 }}></div>
          </div>
          <div>
            Received by:
            <div style={{ borderBottom: '0.5pt solid #000', height: 24 }}></div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function CollectorAccountabilitySummary({ summary }: { summary: Array<{ collector: string; critical: number; followUps: number; monitoring: number; noActivity: number; total: number }> }) {
  if (summary.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <div>
          <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.18em]">Collector Accountability</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Daily workload by queue</p>
        </div>
        <span className="shrink-0 text-[9px] font-black text-slate-400 uppercase tracking-widest">{summary.length} Collectors</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x">
        {summary.map(item => {
          const activeWork = item.critical + item.monitoring + item.followUps + item.noActivity;
          return (
            <div key={item.collector} className="min-w-[220px] max-w-[220px] snap-start border border-slate-200 rounded-xl p-2.5 bg-slate-50/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-[12px] leading-tight truncate">{item.collector}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{activeWork} Active / {item.total} Total</p>
                </div>
                <div className="w-7 h-7 shrink-0 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                  {item.collector.charAt(0)}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <QueueMiniStat label="Crit" value={item.critical} color="text-red-700 bg-red-50 border-red-100" />
                <QueueMiniStat label="Mon" value={item.monitoring} color="text-rose-700 bg-rose-50 border-rose-100" />
                <QueueMiniStat label="F/U" value={item.followUps} color="text-amber-700 bg-amber-50 border-amber-100" />
                <QueueMiniStat label="None" value={item.noActivity} color="text-indigo-700 bg-indigo-50 border-indigo-100" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QueueMiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border px-1.5 py-1.5 text-center ${color}`}>
      <div className="text-[12px] font-black leading-none">{value}</div>
      <div className="text-[7px] font-black uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}


function NoActivityTable({ data, onViewDetails, onEdit, onAddRemark }: { data: Loan[]; onViewDetails: (l: Loan) => void; onEdit: (l: Loan) => void; onAddRemark: (l: Loan) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'borrowerName' | 'runningBalance', direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: 'borrowerName' | 'runningBalance') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    let result = data.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return item.borrowerName.toLowerCase().includes(term) || item.collector.toLowerCase().includes(term) || item.code.toLowerCase().includes(term);
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        if (sortConfig.key === 'borrowerName') {
          return sortConfig.direction === 'asc'
            ? a.borrowerName.localeCompare(b.borrowerName)
            : b.borrowerName.localeCompare(a.borrowerName);
        } else if (sortConfig.key === 'runningBalance') {
          return sortConfig.direction === 'asc'
            ? a.runningBalance - b.runningBalance
            : b.runningBalance - a.runningBalance;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  return (
    <div className="bg-white rounded-[2rem] border border-indigo-100 overflow-hidden shadow-xl shadow-indigo-900/5 animate-slideIn">
      <div className="px-5 py-3 border-b border-indigo-100 flex justify-between items-center bg-indigo-50/30">
        <h3 className="font-black text-indigo-800 uppercase tracking-widest text-xs flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm text-[10px]">{filteredAndSorted.length}</span>
          No Commitment Queue
        </h3>
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="Search Client or Collector..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-[11px] font-bold text-slate-700 shadow-sm transition-all placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-indigo-50 border-b border-indigo-100">
              <th
                className="py-2 px-4 text-[9px] font-black text-indigo-500 uppercase tracking-widest cursor-pointer hover:bg-indigo-100 transition-colors group"
                onClick={() => handleSort('borrowerName')}
              >
                <div className="flex items-center gap-1.5">
                  Client Details
                  <span className="flex flex-col">
                    {sortConfig?.key === 'borrowerName' ? (
                      sortConfig.direction === 'asc' ? (
                        <svg className="w-3 h-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                      ) : (
                        <svg className="w-3 h-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                      )
                    ) : (
                      <svg className="w-3 h-3 text-indigo-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                    )}
                  </span>
                </div>
              </th>
              <th className="py-2 px-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest">Collector</th>
              <th className="py-2 px-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest">Moving Status</th>
              <th
                className="py-2 px-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest cursor-pointer hover:bg-indigo-100 transition-colors group"
                onClick={() => handleSort('runningBalance')}
              >
                <div className="flex items-center gap-1.5">
                  Balance Risk
                  <span className="flex flex-col">
                    {sortConfig?.key === 'runningBalance' ? (
                      sortConfig.direction === 'asc' ? (
                        <svg className="w-3 h-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                      ) : (
                        <svg className="w-3 h-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                      )
                    ) : (
                      <svg className="w-3 h-3 text-indigo-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                    )}
                  </span>
                </div>
              </th>
              <th className="py-2 px-4 text-right text-[9px] font-black text-indigo-400 uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50">
            {filteredAndSorted.map((row, idx) => (
              <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/60 transition-colors`}>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-800 text-[13px] leading-tight">{row.borrowerName}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.code}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                    {row.collector}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                    {row.status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-sm font-black text-slate-800">₱{row.runningBalance.toLocaleString()}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onAddRemark(row)} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">Log</button>
                    <button onClick={() => onViewDetails(row)} className="px-2.5 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">Details</button>
                    <button onClick={() => onEdit(row)} className="px-2.5 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold text-sm">No matches found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FilterTabProps {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  color?: 'red' | 'amber' | 'slate';
}

function FilterTab({ active, label, count, onClick, color }: FilterTabProps) {
  const colorClasses = {
    red: active ? 'bg-red-600 text-white shadow-md shadow-red-200 translate-y-[-2px]' : 'bg-slate-100/50 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:-translate-y-0.5 hover:shadow-sm',
    amber: active ? 'bg-amber-500 text-white shadow-md shadow-amber-200 translate-y-[-2px]' : 'bg-slate-100/50 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:-translate-y-0.5 hover:shadow-sm',
    slate: active ? 'bg-slate-800 text-white shadow-md shadow-slate-200 translate-y-[-2px]' : 'bg-slate-100/50 text-slate-500 hover:bg-slate-200 hover:text-slate-800 hover:-translate-y-0.5 hover:shadow-sm',
    default: active ? 'bg-[#111827] text-white shadow-md shadow-slate-200 translate-y-[-2px]' : 'bg-slate-100/50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 hover:-translate-y-0.5 hover:shadow-sm'
  };

  const currentClass = color ? colorClasses[color] : colorClasses.default;

  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all duration-300 ${currentClass}`}
    >
      {label}
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shadow-inner transition-colors duration-300 ${active ? 'bg-white/20' : 'bg-slate-200/80 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function PriorityBadge({ level }: { level: PriorityLevel }) {
  const styles = {
    [PriorityLevel.TOP]: 'bg-red-50 text-red-600 border-red-100 font-black',
    [PriorityLevel.NEED_ATTENTION]: 'bg-indigo-50 text-indigo-600 border-indigo-100 font-bold',
    [PriorityLevel.FOLLOW_UP]: 'bg-amber-50 text-amber-600 border-amber-100 font-bold',
    [PriorityLevel.MONITOR]: 'bg-emerald-50 text-emerald-600 border-emerald-100 font-bold',
    [PriorityLevel.LOWEST]: 'bg-slate-50 text-slate-400 border-slate-100 font-bold',
  };
  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest border transition-all ${styles[level]}`}>
      {level === PriorityLevel.MONITOR ? 'Monitor' : level}
    </span>
  );
}

function PriorityChip({ level, count }: { level: PriorityLevel; count: number }) {
  const isPriority = level === PriorityLevel.TOP;
  return (
    <div className={`px-5 py-2.5 rounded-full border flex items-center gap-3 transition-all cursor-default ${
      isPriority ? 'bg-red-600 border-red-700 text-white shadow-lg' : 'bg-orange-500 border-orange-600 text-white shadow-lg'
    }`}>
      <div className={`w-2.5 h-2.5 rounded-full bg-white ${isPriority ? 'shadow-[0_0_8px_white]' : ''}`}></div>
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{level}</span>
      <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px] font-black leading-none">{count}</span>
    </div>
  );
}

function ClientUpdateCard({ update }: { update: any; key?: string | number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort remarks descending by time
  const sortedRemarks = [...update.remarks].sort((a: any, b: any) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Show only the last 3 remarks by default, or all if expanded? 
  // User asked "I want all the three will be visible". 
  // Let's show all of them but maybe in a scrollable container if there are too many.
  // For now, let's just render them all as requested.

  return (
    <div className="bg-white p-5 rounded-[1.5rem] shadow-xl shadow-slate-900/5 border border-slate-100 hover:border-[#10B981] hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-full group">
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 min-w-[2.5rem] bg-slate-50 rounded-xl flex items-center justify-center font-black text-[#111827] text-[10px] shadow-inner transition-colors duration-300 border border-slate-100">
              {update.code}
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-[#111827] text-sm truncate leading-tight mb-1 transition-colors duration-300">{update.borrowerName}</h4>
              <p className="text-[9px] font-black text-[#6B7280] uppercase tracking-widest flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                {update.remarks.length} Interactions
              </p>
            </div>
          </div>
          <div className="shrink-0 p-1">
            <PriorityBadge level={update.aiPriority || PriorityLevel.LOWEST} />
          </div>
        </div>

        {/* Remarks List */}
        <div className="space-y-3 overflow-y-auto pr-1">
          {sortedRemarks.slice(0, 3).map((remark: any, index: number) => (
            <div
              key={index}
              className={`p-4 rounded-xl border transition-all ${index === 0 ? 'bg-[#f0fdf4] border-[#10B981]/30 shadow-sm' : 'bg-slate-50 border-slate-100'} relative transition-colors`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-[#6B7280] uppercase tracking-widest">{remark.collector}</span>
                <span className="text-[9px] font-black text-[#9CA3AF] tracking-tighter">
                  {new Date(remark.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {remark.ptpDate && (
                  <span className="self-start bg-orange-50 text-orange-700 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1 border border-orange-100">
                    PTP: {new Date(remark.ptpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {remark.followUpDate && (
                  <span className="self-start bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1 border border-blue-100">
                    Follow-up: {new Date(remark.followUpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <p className="text-[#4B5563] text-[11px] font-bold leading-relaxed italic">
                  "{remark.text.replace(/\[DL_MARKER\]/g, '').replace(/\[DL_RECEIVED\]\s*Demand Letter received on \d{4}-\d{2}-\d{2}\.?\s*/g, '').replace(/\[DL_RECEIVED\]\s*/g, '').trim() || 'No additional remarks.'}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-end border-t border-slate-50 pt-4 mt-6">
        <div className="flex flex-col">
          <span className="text-[8px] text-[#9CA3AF] font-black uppercase tracking-[0.2em] mb-1">Status At</span>
          <span className="text-[9px] text-[#4B5563] font-bold">
            {new Date(sortedRemarks[0]?.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[8px] text-[#9CA3AF] font-black uppercase tracking-[0.2em] block mb-1">Balance Risk</span>
          <span className="text-sm font-black text-[#111827]">₱{update.runningBalance.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function ClientUpdateTable({ data }: { data: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'balance' | 'priority' | 'name' | 'interactions'>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [logTab, setLogTab] = useState<'regular' | 'demand_letter'>('regular');

  const priorityWeight = (level: PriorityLevel) => {
    switch (level) {
      case PriorityLevel.TOP: return 5;
      case PriorityLevel.NEED_ATTENTION: return 4;
      case PriorityLevel.FOLLOW_UP: return 3;
      case PriorityLevel.MONITOR: return 2;
      default: return 1;
    }
  };

  const getUpdateType = (text: string) => {
    const lower = text.toLowerCase();
    if (text.includes('[COMMITMENT_STATUS:')) return { label: 'Commitment', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' };
    if (text.includes('[DL_MARKER]') || text.includes('[DL_RECEIVED]')) return { label: 'DEMAND LETTER', color: 'bg-red-100 text-red-700 border-red-200' };
    if (lower.includes('pay') || lower.includes('bayad') || lower.includes('settle')) return { label: 'Payment Cmt.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (lower.includes('visit') || lower.includes('puntahan')) return { label: 'Field Visit', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (lower.includes('call') || lower.includes('tawag')) return { label: 'Callback', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    return { label: 'Routine Update', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const categorizedData = useMemo(() => {
    return data.map(item => {
      const isDemand = item.latestRemark?.text?.includes('[DL_MARKER]') || item.latestRemark?.text?.includes('[DL_RECEIVED]') || 
                       getUpdateType(item.latestRemark?.text || '').label === 'DEMAND LETTER';
      return {
        ...item,
        source_type: isDemand ? 'demand_letter' : 'regular'
      };
    });
  }, [data]);

  const regularCount = categorizedData.filter(d => d.source_type === 'regular').length;
  const demandCount = categorizedData.filter(d => d.source_type === 'demand_letter').length;

  const sortedAndFiltered = categorizedData.filter((item) => {
    if (item.source_type !== logTab) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.borrowerName.toLowerCase().includes(term) || item.collector.toLowerCase().includes(term);
  }).sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortKey === 'date') {
      aVal = new Date(a.latestRemark.timestamp).getTime();
      bVal = new Date(b.latestRemark.timestamp).getTime();
    } else if (sortKey === 'balance') {
      aVal = a.runningBalance;
      bVal = b.runningBalance;
    } else if (sortKey === 'priority') {
      aVal = priorityWeight(a.aiPriority || PriorityLevel.LOWEST);
      bVal = priorityWeight(b.aiPriority || PriorityLevel.LOWEST);
    } else if (sortKey === 'name') {
      aVal = a.borrowerName;
      bVal = b.borrowerName;
    } else if (sortKey === 'interactions') {
      aVal = a.remarks.length;
      bVal = b.remarks.length;
    }

    if (aVal < bVal) return sortDesc ? 1 : -1;
    if (aVal > bVal) return sortDesc ? -1 : 1;
    return 0;
  });

  const handleSort = (key: 'date' | 'balance' | 'priority' | 'name' | 'interactions') => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return (
      <span className="text-emerald-600 ml-1 font-bold">
        {sortDesc ? '↓' : '↑'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-900/5 border border-slate-200 overflow-hidden flex flex-col w-full animate-slideIn">
      {/* Logs Tab Navigation */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 pt-4 gap-6">
        <button 
          onClick={() => setLogTab('regular')}
          className={`pb-3 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${logTab === 'regular' ? 'text-emerald-700 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
        >
          Regular Client Log
          <span className={`px-2 py-0.5 rounded-md text-[9px] ${logTab === 'regular' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{regularCount}</span>
        </button>
        <button 
          onClick={() => setLogTab('demand_letter')}
          className={`pb-3 px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${logTab === 'demand_letter' ? 'text-red-700 border-red-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
        >
          Demand Letter Client Log
          <span className={`px-2 py-0.5 rounded-md text-[9px] ${logTab === 'demand_letter' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'}`}>{demandCount}</span>
        </button>
      </div>

      {/* Table Toolbar */}
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
        <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-3">
          <span className={`px-2 py-1 rounded border shadow-sm ${logTab === 'demand_letter' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}>{sortedAndFiltered.length}</span>
          {logTab === 'regular' ? 'Regular Updates' : 'Demand Letter Updates'}
        </h3>
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="Search Client or Collector..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs font-bold text-slate-700 shadow-sm transition-all placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-left">
              <th className="p-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                Client Details <SortIcon columnKey="name" />
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors">
                Collector
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('priority')}>
                Pulse <SortIcon columnKey="priority" />
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                {logTab === 'demand_letter' ? 'Latest Update' : 'Latest Update & Type'}
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('date')}>
                Time Logged <SortIcon columnKey="date" />
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('interactions')}>
                Intrx. <SortIcon columnKey="interactions" />
              </th>
              <th className="p-4 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('balance')}>
                Balance Risk <SortIcon columnKey="balance" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedAndFiltered.map((row, idx) => {
              const uType = getUpdateType(row.latestRemark.text);
              const outcomeMatch = row.latestRemark.text.match(/\[COMMITMENT_STATUS:([^\]]+)\]/);
              const commitmentOutcome = outcomeMatch?.[1] as CommitmentOutcome | undefined;
              let cleanText = row.latestRemark.text.replace(/\[COMMITMENT_STATUS:[^\]]+\]\s*/g, '').replace(/\[DL_MARKER\]/g, '').replace(/\[DL_RECEIVED\]\s*Demand Letter received on \d{4}-\d{2}-\d{2}\.?\s*/g, '').replace(/\[DL_RECEIVED\]\s*/g, '').trim();
              
              let dlStageBadge = null;
              const dlMatch = cleanText.match(/^(1st|2nd|3rd)\s+Demand Letter Update:\s*/i);
              if (dlMatch) {
                dlStageBadge = dlMatch[1];
                cleanText = cleanText.substring(dlMatch[0].length).trim();
              }
              
              if (!dlStageBadge && logTab === 'demand_letter') {
                const clientDL = store.getDemandLetters().find(d => d.loanId === row.id);
                if (clientDL) {
                  if (clientDL.type === '1st Demand Letter') dlStageBadge = '1st';
                  else if (clientDL.type === '2nd Demand Letter') dlStageBadge = '2nd';
                  else if (clientDL.type === '3rd Demand Letter') dlStageBadge = '3rd';
                }
              }
              
              if (!cleanText) cleanText = "No additional remarks.";
              
              return (
                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-emerald-50/50 transition-colors group`}>
                  {/* Client Details */}
                  <td className="p-4 px-6 align-top min-w-[200px]">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-emerald-700 transition-colors">{row.borrowerName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.code}</span>
                        {row.recurringSchedule?.enabled && (
                          <span className="bg-violet-50 text-violet-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm border border-violet-200">
                            Every {formatRecurringScheduleLabel(row)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Collector */}
                  <td className="p-4 align-top">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                      {row.collector}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="p-4 align-top whitespace-nowrap">
                    <PriorityBadge level={row.aiPriority || PriorityLevel.LOWEST} />
                  </td>

                  {/* Remarks & Type */}
                  <td className="p-4 min-w-[300px]">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {logTab !== 'demand_letter' && (
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${uType.color}`}>
                            {uType.label}
                          </span>
                        )}
                        {commitmentOutcome && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200">
                            Outcome: {commitmentOutcome}
                          </span>
                        )}
                        {logTab === 'demand_letter' && dlStageBadge && (
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shadow-sm flex items-center gap-1 ${
                            dlStageBadge.toLowerCase() === '1st' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            dlStageBadge.toLowerCase() === '2nd' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {dlStageBadge} DL
                          </span>
                        )}
                        {row.latestRemark.ptpDate && (
                          <span className="bg-orange-50 text-orange-700 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-orange-200 shadow-sm flex items-center gap-1">
                            PTP: {new Date(row.latestRemark.ptpDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {row.latestRemark.followUpDate && (
                          <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-blue-200 shadow-sm flex items-center gap-1">
                            FU: {new Date(row.latestRemark.followUpDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {(row.payments || []).some((p: any) => p.status === 'GOOD' && p.date.startsWith(new Date().toISOString().split('T')[0])) && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-300 shadow-sm flex items-center gap-1 animate-pulse">
                            🟢 ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="relative group/tooltip">
                        <p className="text-xs text-slate-600 font-bold italic line-clamp-2 leading-relaxed">
                          "{cleanText}"
                        </p>
                        {cleanText.length > 80 && (
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 text-white text-[10px] font-medium p-3 rounded-xl shadow-2xl z-50">
                            {cleanText}
                            <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Timeline */}
                  <td className="p-4 align-top whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700">{new Date(row.latestRemark.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(row.latestRemark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>

                  {/* Interactions */}
                  <td className="p-4 align-top hidden lg:table-cell">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-black border border-slate-200">
                      {row.remarks.length}
                    </div>
                  </td>

                  {/* Balance Risk */}
                  <td className="p-4 px-6 align-top text-right whitespace-nowrap">
                    <span className="text-sm font-black text-slate-800">₱{row.runningBalance.toLocaleString()}</span>
                    {row.runningBalance > 0 && row.status !== 'Paid' && row.aiPriority === PriorityLevel.TOP && (
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block ml-2 animate-ping" title="High Risk Action Needed"></div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-sm">
                  No matches found for your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CloseMonitoringTable({ data, onViewDetails, onEdit, onAddRemark, onVisitLog }: { data: any[], onViewDetails: (l: any) => void, onEdit: (l: any) => void, onAddRemark: (l: any) => void, onVisitLog: (l: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'days'>('days');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedAndFiltered = data.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.borrowerName.toLowerCase().includes(term) || item.collector.toLowerCase().includes(term) || item.code.toLowerCase().includes(term);
  }).sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortKey === 'name') {
      aVal = a.borrowerName;
      bVal = b.borrowerName;
    } else if (sortKey === 'days') {
      aVal = a.daysWithoutPayment;
      bVal = b.daysWithoutPayment;
    }

    if (aVal < bVal) return sortDesc ? 1 : -1;
    if (aVal > bVal) return sortDesc ? -1 : 1;
    return 0;
  });

  const handleSort = (key: 'name' | 'days') => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <span className="text-slate-300 ml-1">↕</span>;
    return (
      <span className="text-rose-600 ml-1 font-bold">
        {sortDesc ? '↓' : '↑'}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-[2rem] border border-rose-200/60 overflow-hidden shadow-xl shadow-rose-900/5 animate-slideIn">
      {/* Table Toolbar */}
      <div className="px-5 py-3 border-b border-rose-100 flex justify-between items-center bg-rose-50/30">
        <h3 className="font-black text-rose-800 uppercase tracking-widest text-xs flex items-center gap-2">
          <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded border border-rose-200 shadow-sm text-[10px]">{sortedAndFiltered.length}</span>
          Monitoring Cases
        </h3>
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-rose-400">
            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="Search Client or Collector..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-[11px] font-bold text-slate-700 shadow-sm transition-all placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-rose-50 border-b border-rose-200 sticky top-0 z-10 text-left shadow-sm">
              <th className="py-2 px-4 text-[9px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => handleSort('name')}>
                Client Details <SortIcon columnKey="name" />
              </th>
              <th className="py-2 px-3 text-[9px] font-black text-rose-400 uppercase tracking-widest whitespace-nowrap">
                Collector
              </th>
              <th className="py-2 px-3 text-[9px] font-black text-rose-400 uppercase tracking-widest min-w-[180px]">
                Last Interaction
              </th>
              <th className="py-2 px-3 text-[9px] font-black text-rose-400 uppercase tracking-widest">
                Priority
              </th>
              <th className="py-2 px-3 text-center text-[9px] font-black text-rose-400 uppercase tracking-widest cursor-pointer hover:bg-rose-100/50 transition-colors" onClick={() => handleSort('days')}>
                Days Since Last Payment <SortIcon columnKey="days" />
              </th>

              <th className="py-2 px-4 text-right text-[9px] font-black text-rose-400 uppercase tracking-widest">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50/50">
            {sortedAndFiltered.map((row, idx) => {
              let cleanText = row.latestRemark.text.replace(/\[DL_MARKER\]/g, '').replace(/\[DL_RECEIVED\]\s*Demand Letter received on \d{4}-\d{2}-\d{2}\.?\s*/g, '').replace(/\[DL_RECEIVED\]\s*/g, '').trim();
              if (!cleanText) cleanText = "No additional remarks.";
              let daysColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 shadow-sm';
              let statusBadge = '🟢 Active';
              
              if (row.daysWithoutPayment === -1) {
                daysColor = 'text-slate-600 bg-slate-50 border-slate-200';
                statusBadge = '🟡 First Pymnt Pend.';
              } else if (row.daysWithoutPayment >= 4) {
                daysColor = 'text-red-700 bg-red-50 border-red-200 shadow-sm';
                statusBadge = '🔴 No Payment Today';
              } else if (row.daysWithoutPayment >= 2) {
                daysColor = 'text-amber-700 bg-amber-50 border-amber-200 shadow-sm';
                statusBadge = '🟡 At Risk';
              } else {
                daysColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 shadow-sm';
                statusBadge = '🔴 No Payment Today';
              }

              return (
                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-rose-50/80 transition-colors group`}>
                  {/* Client Name & ID */}
                  <td className="py-2 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-[13px] leading-tight group-hover:text-rose-700 transition-colors">{row.borrowerName}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.code}</span>
                        {row.recurringSchedule?.enabled && (
                          <span className="bg-violet-50 text-violet-700 text-[8px] font-black uppercase px-1.5 py-0 rounded-sm border border-violet-200">
                            {formatRecurringScheduleLabel(row, true)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Collector */}
                  <td className="py-2 px-3 align-middle">
                    <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                      {row.collector}
                    </span>
                  </td>

                  {/* Interaction */}
                  <td className="py-2 px-3 align-middle">
                    <div className="relative group/tooltip">
                      <p className="text-[11px] text-slate-600 font-bold italic line-clamp-1 leading-snug">
                        "{cleanText}"
                      </p>
                      {cleanText.length > 40 && (
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 text-white text-[10px] font-medium p-3 rounded-xl shadow-2xl z-50">
                          {cleanText}
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      )}
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-400 block tracking-widest">
                       {new Date(row.latestRemark.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="py-2 px-3 align-middle whitespace-nowrap">
                    <PriorityBadge level={row.aiPriority || PriorityLevel.LOWEST} />
                  </td>

                  {/* Days Without Payment & Status */}
                  <td className="py-2 px-3 align-middle text-center w-44">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                       <span className={`px-1.5 py-0 rounded text-[9px] font-black uppercase tracking-widest border bg-white ${daysColor.split(' ')[0]} ${daysColor.split(' ')[2]}`}>
                         {statusBadge}
                       </span>
                       <div className={`px-2 py-0.5 rounded-md border flex items-center justify-center gap-1 ${daysColor}`}>
                          <span className="text-xs font-black leading-none">{row.daysWithoutPayment === -1 ? '?' : row.daysWithoutPayment}</span>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-80">Days</span>
                       </div>
                       {row.lastPaymentDateStr && (
                          <span className="text-[7px] font-bold text-slate-400 tracking-wider">
                            Last: {row.lastPaymentDateStr}
                          </span>
                       )}
                    </div>
                  </td>



                  {/* Action */}
                  <td className="py-2 px-4 align-middle text-right">
                     <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => onVisitLog(row)}
                          className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-md transition-colors relative group/vl"
                          title="Visit Log"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded opacity-0 group-hover/vl:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Visit Log</span>
                        </button>
                        <button
                          onClick={() => onAddRemark(row)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors relative"
                          title="Remarks"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                          {row.remarks && row.remarks.length > 0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>}
                        </button>
                        <button
                          onClick={() => onViewDetails(row)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                          title="Client Details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                      </div>
                  </td>
                </tr>
              );
            })}
            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest opacity-80">Clear Queue (No active monitoring cases)</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ClientUpdate;
