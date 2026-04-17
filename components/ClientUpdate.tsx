
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { PriorityLevel, Branch, User, Loan } from '../types.ts';

interface ClientUpdateProps {
  selectedBranch: Branch;
  currentUser: User;
}

interface ReminderItem {
  loan: Loan;
  date: string; // ISO date or "Tomorrow"
  type: 'Payment' | 'Visit' | 'Callback' | 'Follow-up';
  context: string;
}

const ClientUpdate: React.FC<ClientUpdateProps> = ({ selectedBranch, currentUser }) => {
  const [loans, setLoans] = useState(store.getLoans(selectedBranch));
  const [activeFilter, setActiveFilter] = useState<'All' | 'Priority' | 'Monitoring' | 'Follow-up' | 'Updates Log'>('All');
  const [collapsedSections, setCollapsedSections] = useState({
    priority: false,
    monitoring: false,
    reminders: false,
    log: false
  });

  useEffect(() => {
    setLoans(store.getLoans(selectedBranch));
    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      setLoans(store.getLoans(selectedBranch));
    });

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

    return () => unsubscribe();
  }, [selectedBranch]);

  const updateList = useMemo(() => {
    return loans
      .filter(l => l.remarks.length > 0)
      .map(l => ({
        ...l,
        latestRemark: l.remarks[l.remarks.length - 1]
      }))
      .sort((a, b) => new Date(b.latestRemark.timestamp).getTime() - new Date(a.latestRemark.timestamp).getTime());
  }, [loans]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  
  const checkIsPriority = (l: any) => {
    // Auto-detect fulfilled commitments: If they paid today, they shouldn't be in Critical Action today
    const hasGoodPaymentToday = (l.payments || []).some((p: any) => p.status === 'GOOD' && p.date.startsWith(todayStr));
    if (hasGoodPaymentToday) return false;

    const isTopAi = l.aiPriority === PriorityLevel.TOP;
    const isUnpaid = l.runningBalance > 0 && l.status !== 'Paid';
    // Primary check: loan-level fields (synced from remarks on load/add)
    const isDueToday = !!l.promiseToPayDate && l.promiseToPayDate === todayStr && isUnpaid;
    const isFollowUpToday = !!l.followUpDate && l.followUpDate === todayStr && isUnpaid;
    // Fallback: check the latest remark's ptpDate/followUpDate directly — guards against
    // stale loan-level fields (e.g. if syncLoanInteractionDates hasn't run yet after load)
    const latestRemark = l.remarks?.length > 0 ? l.remarks[l.remarks.length - 1] : null;
    const remarkPtpToday = !!latestRemark?.ptpDate && latestRemark.ptpDate === todayStr && isUnpaid;
    const remarkFuToday = !!latestRemark?.followUpDate && latestRemark.followUpDate === todayStr && isUnpaid;
    return isTopAi || isDueToday || isFollowUpToday || remarkPtpToday || remarkFuToday;
  };

  // Logic for Top Priority Section
  const topPriorityList = useMemo(() => {
    return updateList.filter(l => checkIsPriority(l));
  }, [updateList, todayStr]);

  const handleMarkCommitmentDone = async (loan: any) => {
    const isPaid = loan.outstandingBalance <= 0 || loan.status === 'Paid';
    const newPriority = isPaid ? PriorityLevel.LOWEST : PriorityLevel.NEED_ATTENTION;

    // Optimistic update locally if needed, but store subscription should handle it
    await store.updateLoan(loan.id, { aiPriority: newPriority }, currentUser.username, currentUser.role);
  };

  // Logic for Reminder Section (Advance early notification - triggers strictly 1 day prior)
  const reminderList = useMemo(() => {
    const reminders: ReminderItem[] = [];

    updateList.forEach(l => {
      if (l.status === 'Paid') return;
      if (checkIsPriority(l)) {
        return;
      }

      const isTomorrowPTP = !!l.promiseToPayDate && l.promiseToPayDate === tomorrowStr;
      const isTomorrowFU = !!l.followUpDate && l.followUpDate === tomorrowStr;

      if (isTomorrowPTP || isTomorrowFU) {
        const type = isTomorrowPTP ? 'Payment' : 'Follow-up';
        const dateStr = isTomorrowPTP ? l.promiseToPayDate : l.followUpDate;
        
        reminders.push({
          loan: l,
          date: new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          type: type as any,
          context: l.latestRemark.text
        });
      }
    });

    return reminders;
  }, [updateList, todayStr, tomorrowStr]);

  // Logic for Close Monitoring (Clients with critical dates reached but NO payment recorded after the date)
  const closeMonitoringList = useMemo(() => {
    return updateList.map(l => {
      if (l.status === 'Paid') return null;
      if (checkIsPriority(l)) return null;

      // Only trigger if promised or follow-up date has passed
      const hasPassedPTP = !!l.promiseToPayDate && l.promiseToPayDate < todayStr;
      const hasPassedFollowUp = !!l.followUpDate && l.followUpDate < todayStr;
      
      if (!hasPassedPTP && !hasPassedFollowUp) return null;

      // Determine the most recent critical date that triggered this monitoring
      const passedDates = [];
      if (hasPassedPTP) passedDates.push(l.promiseToPayDate);
      if (hasPassedFollowUp) passedDates.push(l.followUpDate);
      passedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const mostRecentPassedDate = passedDates[0];

      // If they made a GOOD payment on or after the most recent critical date, they fulfilled the past commitment
      const hasSatisfyingPayment = (l.payments || []).some((p: any) => p.status === 'GOOD' && p.date >= mostRecentPassedDate);
      if (hasSatisfyingPayment) return null;

      const goodPayments = (l.payments || []).filter((p: any) => p.status === 'GOOD');
      let lastPaymentDateStr = null;
      let daysWithoutPayment = 'N/A';

      if (goodPayments.length > 0) {
        const sortedPayments = goodPayments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastPaymentDateStr = sortedPayments[0].date;
        const diffMs = new Date().getTime() - new Date(lastPaymentDateStr).getTime();
        daysWithoutPayment = Math.max(0, Math.floor(diffMs / (1000 * 3600 * 24))).toString();
      }

      return {
        ...l,
        lastPaymentDateStr,
        daysWithoutPayment: daysWithoutPayment !== 'N/A' ? parseInt(daysWithoutPayment) : -1
      };
    }).filter(Boolean);
  }, [updateList, todayStr]);

  // Logic for All Client Updates (Main List) - Single-State Rule
  // Must exclude: Top Priority, Need Attention, Advance Reminders AND Close Monitoring
  const filteredMainList = useMemo(() => {
    const reminderIds = new Set(reminderList.map(r => r.loan.id));
    const monitoringIds = new Set(closeMonitoringList.map((m: any) => m.id));

    return updateList.filter(u =>
      !checkIsPriority(u) &&
      !reminderIds.has(u.id) &&
      !monitoringIds.has(u.id)
    );
  }, [updateList, reminderList, closeMonitoringList, todayStr]);

  const noActivityList = useMemo(() => {
    return loans.filter(l => l.remarks.length === 0);
  }, [loans]);

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center transition-colors duration-300 bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight transition-colors duration-300 mb-1">Client Pulse & Updates</h2>
          <p className="text-slate-400 font-medium text-sm transition-colors duration-300">Real-time analysis of collector feedback for: <span className="text-emerald-600 font-bold">{selectedBranch}</span></p>
        </div>
        <div className="flex items-center gap-6">
        </div>
      </div>

      {/* QUICK FILTERS & COUNT SUMMARY */}
      <div className="flex flex-wrap items-center justify-between gap-6 p-2 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          <FilterTab active={activeFilter === 'All'} label="All Activity" onClick={() => setActiveFilter('All')} />
          <FilterTab active={activeFilter === 'Monitoring'} label="Close Monitoring" count={closeMonitoringList.length} onClick={() => setActiveFilter('Monitoring')} color="red" />
          <FilterTab active={activeFilter === 'Priority'} label="Critical Action" count={topPriorityList.length} onClick={() => setActiveFilter('Priority')} color="red" />
          <FilterTab active={activeFilter === 'Follow-up'} label="Advance Reminders" count={reminderList.length} onClick={() => setActiveFilter('Follow-up')} color="amber" />
          <FilterTab active={activeFilter === 'Updates Log'} label="All Client Updates Log" count={updateList.length} onClick={() => setActiveFilter('Updates Log')} color="slate" />
        </div>
        <div className="px-6 flex gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Close Monitoring</span>
            <span className="text-lg font-black text-rose-600 leading-none">{closeMonitoringList.length}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 self-center"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Critical Action</span>
            <span className="text-lg font-black text-red-600 leading-none">{topPriorityList.length}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 self-center"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Advance Reminders</span>
            <span className="text-lg font-black text-amber-600 leading-none">{reminderList.length}</span>
          </div>
        </div>
      </div>


      {/* 1️⃣ CLOSE MONITORING — Highest Priority */}
      {(activeFilter === 'All' || activeFilter === 'Monitoring') && (
        <section className="bg-rose-50/30 rounded-[1.5rem] p-6 shadow-sm border border-rose-200 space-y-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
              <h3 className="text-sm font-black text-rose-900 uppercase tracking-[0.2em]">Close Monitoring Queue</h3>
            </div>
            <button onClick={() => toggleSection('monitoring')} className="p-2 hover:bg-rose-100 rounded-xl transition-colors group">
              <span className={`block text-md transition-transform duration-300 text-rose-500 group-hover:text-rose-700 ${collapsedSections.monitoring ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>
          
          {!collapsedSections.monitoring && (
             <CloseMonitoringTable data={closeMonitoringList} />
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
            <button onClick={() => toggleSection('priority')} className="p-2 hover:bg-red-50 rounded-xl transition-colors group">
              <span className={`block text-lg transition-transform duration-300 text-red-500 group-hover:text-red-700 ${collapsedSections.priority ? 'rotate-180' : ''}`}>▼</span>
            </button>
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
                        <span className="text-[10px]">👤</span> {item.latestRemark.collector}
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
                    
                    <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-4">
                      <div className="flex justify-between items-center px-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Exposure</div>
                        <div className="text-xl font-black text-[#111827]">₱{item.runningBalance.toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => handleMarkCommitmentDone(item)}
                        className="w-full py-3 bg-slate-900 border border-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="bg-white/20 w-4 h-4 rounded-full flex items-center justify-center text-[8px]">✓</span> Settle Commitment
                      </button>
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
                    
                    <div className="flex items-center gap-3 text-[10px] text-[#6B7280] font-black uppercase tracking-[0.1em] border-t border-slate-100 pt-4 mt-auto">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-black shadow-sm group-hover:scale-110 transition-transform">
                        {item.loan.latestRemark.collector.charAt(0)}
                      </div>
                      {item.loan.latestRemark.collector}
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

      {/* 4️⃣ ALL CLIENT UPDATES LOG — Full Logs */}
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
    </div>
  );
};

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
                  "{remark.text.replace('[DL_MARKER]', '').trim()}"
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
    if (text.includes('[DL_MARKER]')) return { label: 'Demand Letter', color: 'bg-red-100 text-red-700 border-red-200' };
    if (lower.includes('pay') || lower.includes('bayad') || lower.includes('settle')) return { label: 'Payment Cmt.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (lower.includes('visit') || lower.includes('puntahan')) return { label: 'Field Visit', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (lower.includes('call') || lower.includes('tawag')) return { label: 'Callback', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    return { label: 'Routine Update', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const categorizedData = useMemo(() => {
    return data.map(item => {
      const isDemand = item.latestRemark?.text?.includes('[DL_MARKER]') || 
                       getUpdateType(item.latestRemark?.text || '').label === 'Demand Letter';
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
    return item.borrowerName.toLowerCase().includes(term) || item.latestRemark.collector.toLowerCase().includes(term);
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
                Latest Update & Type
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
              const cleanText = row.latestRemark.text.replace('[DL_MARKER]', '').trim();
              
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
                            🔄 Every {row.recurringSchedule.type === 'weekly' 
                              ? row.recurringSchedule.weekDays?.map(n => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(' & ') 
                              : row.recurringSchedule.days?.join(' & ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Collector */}
                  <td className="p-4 align-top">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                      {row.latestRemark.collector}
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
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${uType.color}`}>
                          {uType.label}
                        </span>
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

function CloseMonitoringTable({ data }: { data: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'days'>('days');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedAndFiltered = data.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.borrowerName.toLowerCase().includes(term) || item.latestRemark.collector.toLowerCase().includes(term) || item.code.toLowerCase().includes(term);
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
      <div className="p-6 border-b border-rose-100 flex justify-between items-center bg-rose-50/30">
        <h3 className="font-black text-rose-800 uppercase tracking-widest text-sm flex items-center gap-3">
          <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded border border-rose-200 shadow-sm">{sortedAndFiltered.length}</span>
          Monitoring Cases
        </h3>
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-rose-400">
            <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="Search Client or Collector..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-bold text-slate-700 shadow-sm transition-all placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-rose-50 border-b border-rose-200 sticky top-0 z-10 text-left shadow-sm">
              <th className="p-4 px-6 text-[10px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => handleSort('name')}>
                Client Details <SortIcon columnKey="name" />
              </th>
              <th className="p-4 text-[10px] font-black text-rose-400 uppercase tracking-widest whitespace-nowrap">
                Collector
              </th>
              <th className="p-4 text-[10px] font-black text-rose-400 uppercase tracking-widest min-w-[200px]">
                Last Interaction
              </th>
              <th className="p-4 text-[10px] font-black text-rose-400 uppercase tracking-widest">
                Priority
              </th>
              <th className="p-4 text-center text-[10px] font-black text-rose-400 uppercase tracking-widest cursor-pointer hover:bg-rose-100/50 transition-colors" onClick={() => handleSort('days')}>
                Days Since Last Payment <SortIcon columnKey="days" />
              </th>
              <th className="p-4 px-6 text-right text-[10px] font-black text-rose-400 uppercase tracking-widest">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50/50">
            {sortedAndFiltered.map((row, idx) => {
              const cleanText = row.latestRemark.text.replace('[DL_MARKER]', '').trim();
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
                  <td className="p-4 px-6 align-top">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-rose-700 transition-colors">{row.borrowerName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.code}</span>
                        {row.recurringSchedule?.enabled && (
                          <span className="bg-violet-50 text-violet-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border border-violet-200 shadow-sm">
                            🔄 Every {row.recurringSchedule.type === 'weekly' 
                              ? row.recurringSchedule.weekDays?.map(n => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(' & ') 
                              : row.recurringSchedule.days?.join(' & ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Collector */}
                  <td className="p-4 align-top">
                    <span className="bg-slate-50 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                      {row.latestRemark.collector}
                    </span>
                  </td>

                  {/* Interaction */}
                  <td className="p-4 align-top">
                    <div className="relative group/tooltip">
                      <p className="text-[11px] text-slate-600 font-bold italic line-clamp-2 leading-relaxed">
                        "{cleanText}"
                      </p>
                      {cleanText.length > 60 && (
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-72 bg-slate-800 text-white text-[10px] font-medium p-3 rounded-xl shadow-2xl z-50">
                          {cleanText}
                          <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[8px] font-black uppercase text-slate-400 block tracking-widest">
                       {new Date(row.latestRemark.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="p-4 align-top whitespace-nowrap">
                    <PriorityBadge level={row.aiPriority || PriorityLevel.LOWEST} />
                  </td>

                  {/* Days Without Payment & Status */}
                  <td className="p-4 align-top text-center w-48">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border bg-white ${daysColor.split(' ')[0]} ${daysColor.split(' ')[2]}`}>
                         {statusBadge}
                       </span>
                       <div className={`px-3 py-1 rounded-lg border flex items-center justify-center gap-1.5 ${daysColor}`}>
                          <span className="text-sm font-black leading-none">{row.daysWithoutPayment === -1 ? '?' : row.daysWithoutPayment}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-80">Days</span>
                       </div>
                       {row.lastPaymentDateStr && (
                          <span className="text-[8px] font-bold text-slate-400 tracking-wider">
                            Last: {row.lastPaymentDateStr}
                          </span>
                       )}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="p-4 px-6 align-top text-right">
                     <button className="px-4 py-2 bg-slate-800 text-white hover:bg-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:shadow-rose-200 transition-all active:scale-95">
                        Review
                     </button>
                  </td>
                </tr>
              );
            })}
            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center">
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
