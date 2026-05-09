
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { store } from '../services/dataStore.ts';
import { getLoanInsights } from '../services/geminiService.ts';
import { MovingStatus, Branch, Loan, PaymentStatus } from '../types.ts';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';
import * as XLSX from 'xlsx';

interface DashboardProps {
  selectedBranch: Branch;
}

const KpiCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: string; statusIndicator?: {text: string, type: 'positive' | 'neutral' | 'critical' | 'info'} }> = ({ title, value, subValue, icon, statusIndicator }) => {
  const statusStyles = {
    positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-full transition-colors duration-300 relative overflow-hidden group mt-2">
        <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-xl shadow-inner border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform duration-300">
                    {icon}
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            {statusIndicator && (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusStyles[statusIndicator.type]}`}>
                    {statusIndicator.text}
                </span>
            )}
        </div>
        <div className="flex justify-between items-end relative z-10">
            <div className="flex flex-col">
                <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{value}</span>
                {subValue && <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">{subValue}</span>}
            </div>
        </div>
        <div className="absolute -bottom-6 -right-4 text-8xl opacity-[0.03] grayscale pointer-events-none group-hover:scale-110 transition-transform duration-500">{icon}</div>
    </div>
  );
};

const SecondaryMetricCard: React.FC<{ title: string; value: string | number; subline: string; color: string }> = ({ title, value, subline, color }) => (
    <div className="bg-white dark:bg-slate-800 py-4 px-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</span>
            <span className={`text-xl font-black ${color}`}>{value}</span>
        </div>
        <div className="text-right flex flex-col items-end">
            <span className="text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-md">{subline}</span>
        </div>
    </div>
);



const Dashboard: React.FC<DashboardProps> = ({ selectedBranch }) => {
  const [allLoans, setAllLoans] = useState(store.getLoans(selectedBranch));
  const [allCollectors, setAllCollectors] = useState(store.getCollectors(Branch.ALL));
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [collectorViewMode, setCollectorViewMode] = useState<'Balance View' | 'Performance View'>('Balance View');
  const [nearFullCollectorFilter, setNearFullCollectorFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'last30'>('all');

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

  // --- Filtered loans based on date toggle ---
  const loans = useMemo(() => {
    if (dateFilter === 'all') return allLoans;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allLoans.filter(l => {
      // Include loan if it has any active payment within the last 30 days
      const hasRecentPayment = l.payments.some(p => p.status !== 'REVERSED' && p.date >= cutoffStr);
      // Or if the monthReported is within the last 30 days window
      const reportedMonth = l.monthReported; // YYYY-MM
      const cutoffMonth = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
      const hasRecentReport = reportedMonth >= cutoffMonth;
      return hasRecentPayment || hasRecentReport;
    });
  }, [allLoans, dateFilter]);

  // --- Compute stats from filtered loans ---
  const stats = useMemo(() => {
    const totalAccounts = loans.length;
    const totalCollected = loans.reduce((sum, l) => sum + l.amountCollected, 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
    const totalRunning = loans.reduce((sum, l) => sum + l.runningBalance, 0);
    const statusData: Record<string, { count: number; amount: number }> = {
      Paid: { count: 0, amount: 0 },
      Moving: { count: 0, amount: 0 },
      NM: { count: 0, amount: 0 },
      NMSR: { count: 0, amount: 0 },
    };
    const statusKeyMap: Record<string, string> = {
      [MovingStatus.PAID]: 'Paid',
      [MovingStatus.MOVING]: 'Moving',
      [MovingStatus.NM]: 'NM',
      [MovingStatus.NMSR]: 'NMSR',
    };
    loans.forEach(l => {
      const key = statusKeyMap[l.status];
      if (key && statusData[key]) {
        statusData[key].count++;
        statusData[key].amount += (l.status === MovingStatus.PAID ? l.amountCollected : l.runningBalance);
      }
    });
    return { totalAccounts, totalCollected, totalOutstanding, totalRunning, statusData };
  }, [loans]);

  // --- Compute collector performance from filtered loans ---
  const collectorData = useMemo(() => {
    const collectors: Record<string, { collector: string; totalAccounts: number; reportedAmount: number; collectedAmount: number; runningBalance: number; collectionRate: number; paidCount: number }> = {};
    loans.forEach(loan => {
      const coll = getCollectorDisplayName(loan.collector, allCollectors);
      if (!coll || coll === 'N/A' || coll === 'UNDEFINED' || coll === 'UNASSIGNED') return;
      if (!collectors[coll]) {
        collectors[coll] = { collector: coll, totalAccounts: 0, reportedAmount: 0, collectedAmount: 0, runningBalance: 0, collectionRate: 0, paidCount: 0 };
      }
      const p = collectors[coll];
      p.totalAccounts++;
      p.reportedAmount += loan.outstandingBalance;
      p.collectedAmount += loan.amountCollected;
      p.runningBalance += loan.runningBalance;
      if (loan.status === MovingStatus.PAID) p.paidCount++;
    });
    return Object.values(collectors).map(p => ({ ...p, collectionRate: p.reportedAmount > 0 ? (p.collectedAmount / p.reportedAmount) * 100 : 0 }));
  }, [loans, allCollectors]);

  // --- Compute collector distribution from filtered loans ---
  const collectorDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    loans.forEach(loan => {
      const coll = loan.collector?.trim();
      if (!coll || coll === 'N/A' || coll === 'undefined' || coll === 'UNASSIGNED') return;
      distribution[coll] = (distribution[coll] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [loans]);

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

  const sortedCollectorData = [...collectorData].sort((a, b) => {
    if (collectorViewMode === 'Performance View') {
      const aPerf = a.reportedAmount > 0 ? (a.collectedAmount / a.reportedAmount) : 0;
      const bPerf = b.reportedAmount > 0 ? (b.collectedAmount / b.reportedAmount) : 0;
      return bPerf - aPerf;
    } else {
      return b.reportedAmount - a.reportedAmount;
    }
  });

  const COLORS = ['#3b82f6', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f43f5e', '#6366f1'];

  const fetchAiInsight = async () => {
    setIsAiLoading(true);
    const insight = await getLoanInsights(store.getLoans(selectedBranch));
    setAiInsight(insight || "No insights available.");
    setIsAiLoading(false);
  };

  const handleExportExcel = () => {
    const exportData: any[][] = [
      ['Melann Lending — Dashboard Export'],
      ['Branch', selectedBranch],
      ['Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
      [],
      ['Metric', 'Value'],
      ['Total Accounts', stats.totalAccounts],
      ['Total Collected', stats.totalCollected],
      ['Total Outstanding', stats.totalOutstanding],
      ['Running Balance', stats.totalRunning],
      [],
      ['Status Breakdown', 'Amount', 'Count'],
      ['Not Moving', stats.statusData.NM.amount, stats.statusData.NM.count],
      ['Moving', stats.statusData.Moving.amount, stats.statusData.Moving.count],
      ['Paid', stats.statusData.Paid.amount, stats.statusData.Paid.count],
      ['NM Since Release', stats.statusData.NMSR.amount, stats.statusData.NMSR.count],
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

  return (
    <div className="space-y-6 animate-fadeIn max-w-[1600px] mx-auto pb-10">
      
      {/* Header SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
        <div>
           <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Institutional Performance Matrix</h1>
           <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Daily Settlement & Portfolio Overview — As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
           </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <button
              onClick={() => setDateFilter(f => f === 'all' ? 'last30' : 'all')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                dateFilter === 'last30'
                  ? 'bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700'
                  : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              }`}
           >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {dateFilter === 'last30' ? '✓ Last 30 Days' : 'Last 30 Days'}
           </button>
           <button onClick={handleExportExcel} className="flex-1 md:flex-none bg-[#064e3b] hover:bg-[#043326] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Export Excel
           </button>
        </div>
      </div>

      {/* KPI Cards (Top Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Accounts" value={stats.totalAccounts} icon="👥" statusIndicator={{text: 'Stable', type: 'positive'}} />
        <KpiCard title="Total Collected" value={`₱${stats.totalCollected.toLocaleString()}`} icon="💳" statusIndicator={{text: 'Today', type: 'info'}} />
        <KpiCard title="Total Outstanding" value={`₱${stats.totalOutstanding.toLocaleString()}`} icon="📈" statusIndicator={{text: 'Pending', type: 'neutral'}} />
        <KpiCard title="Running Balance" value={`₱${stats.totalRunning.toLocaleString()}`} icon="📉" statusIndicator={{text: 'Critical', type: 'critical'}} />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
        <SecondaryMetricCard title="Not Moving" value={`₱${stats.statusData.NM.amount.toLocaleString()}`} subline={`${stats.statusData.NM.count} Clients`} color="text-slate-800 dark:text-white" />
        <SecondaryMetricCard title="Moving" value={`₱${stats.statusData.Moving.amount.toLocaleString()}`} subline={`${stats.statusData.Moving.count} Clients`} color="text-slate-800 dark:text-white" />
        <SecondaryMetricCard title="Paid" value={`₱${stats.statusData.Paid.amount.toLocaleString()}`} subline={`${stats.statusData.Paid.count} Clients`} color="text-emerald-600 dark:text-emerald-400" />
        <SecondaryMetricCard title="NM Since Release" value={`₱${stats.statusData.NMSR.amount.toLocaleString()}`} subline={`${stats.statusData.NMSR.count} Clients`} color="text-red-500 dark:text-red-400" />
      </div>

      {/* Main 3-Column Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch mt-6">
        {/* Collection Trend Chart */}
      {(() => {
        // Compute daily collection data for the last 30 days
        const now = new Date();
        const days30Ago = new Date();
        days30Ago.setDate(now.getDate() - 29);

        // Build a map of date -> { amount, count }
        const dailyMap: Record<string, { amount: number; count: number }> = {};
        // Pre-fill all 30 days with zeros
        for (let i = 0; i < 30; i++) {
          const d = new Date(days30Ago);
          d.setDate(days30Ago.getDate() + i);
          const key = d.toISOString().split('T')[0];
          dailyMap[key] = { amount: 0, count: 0 };
        }
        // Aggregate payments
        loans.forEach(loan => {
          loan.payments.forEach(p => {
            if (p.status === PaymentStatus.GOOD && dailyMap[p.date] !== undefined) {
              dailyMap[p.date].amount += p.amount;
              dailyMap[p.date].count += 1;
            }
          });
        });

        const sortedDates = Object.keys(dailyMap).sort();
        let cumulative = 0;
        const trendData = sortedDates.map(date => {
          cumulative += dailyMap[date].amount;
          const d = new Date(date + 'T00:00:00');
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
        const avgDaily = totalCollected30 / 30;
        const peakDay = trendData.reduce((best, d) => d.amount > best.amount ? d : best, trendData[0]);

        return (
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
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">₱{totalCollected30.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg / Day</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">₱{Math.round(avgDaily).toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transactions</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">{totalTransactions30.toLocaleString()}</div>
                </div>
                {peakDay && peakDay.amount > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Day</div>
                    <div className="text-sm font-black text-blue-600 dark:text-blue-400">{peakDay.label} — ₱{peakDay.amount.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 mt-4 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    interval={Math.floor(trendData.length / 7)}
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
        );
      })()}

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
                 <span className="font-bold text-slate-800 dark:text-white">{item.value.toLocaleString()} <span className="text-slate-400 font-medium text-xs ml-1">accts</span></span>
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
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#064e3b] dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Near Full Payment
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clients with ₱1,000 or less remaining balance</p>
            </div>
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
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {(() => {
              const nearFullPaymentClients = loans
                .filter(l => l.runningBalance > 0 && l.runningBalance <= 1000 && l.status !== MovingStatus.PAID)
                .filter(l => nearFullCollectorFilter === '' || getCollectorDisplayName(l.collector, allCollectors) === nearFullCollectorFilter)
                .sort((a, b) => a.runningBalance - b.runningBalance);

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
