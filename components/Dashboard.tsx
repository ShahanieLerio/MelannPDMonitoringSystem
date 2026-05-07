
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { store } from '../services/dataStore.ts';
import { getLoanInsights } from '../services/geminiService.ts';
import { MovingStatus, Branch } from '../types.ts';

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
  const [stats, setStats] = useState(store.getStats(selectedBranch));
  const [collectorData, setCollectorData] = useState(store.getCollectorPerformance(selectedBranch));
  const [collectorDistribution, setCollectorDistribution] = useState(store.getCollectorDistribution(selectedBranch));
  const [recentPayments, setRecentPayments] = useState(store.getRecentPayments(selectedBranch));
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [collectorViewMode, setCollectorViewMode] = useState<'Balance View' | 'Performance View'>('Balance View');

  const sortedCollectorData = [...collectorData].sort((a, b) => {
    if (collectorViewMode === 'Performance View') {
      const aPerf = a.reportedAmount > 0 ? (a.collectedAmount / a.reportedAmount) : 0;
      const bPerf = b.reportedAmount > 0 ? (b.collectedAmount / b.reportedAmount) : 0;
      return bPerf - aPerf;
    } else {
      return b.reportedAmount - a.reportedAmount;
    }
  });

  useEffect(() => {
    const refreshData = () => {
      setStats(store.getStats(selectedBranch));
      setCollectorData(store.getCollectorPerformance(selectedBranch));
      setCollectorDistribution(store.getCollectorDistribution(selectedBranch));
      setRecentPayments(store.getRecentPayments(selectedBranch));
    };

    refreshData();

    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  const COLORS = ['#3b82f6', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f43f5e', '#6366f1'];

  const fetchAiInsight = async () => {
    setIsAiLoading(true);
    const insight = await getLoanInsights(store.getLoans(selectedBranch));
    setAiInsight(insight || "No insights available.");
    setIsAiLoading(false);
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
           <button className="flex-1 md:flex-none border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Last 30 Days
           </button>
           <button className="flex-1 md:flex-none bg-[#064e3b] hover:bg-[#043326] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Export CSV
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SecondaryMetricCard title="Not Moving" value={`₱${stats.statusData.NM.amount.toLocaleString()}`} subline={`${stats.statusData.NM.count} Clients`} color="text-slate-800 dark:text-white" />
        <SecondaryMetricCard title="Moving" value={`₱${stats.statusData.Moving.amount.toLocaleString()}`} subline={`${stats.statusData.Moving.count} Clients`} color="text-slate-800 dark:text-white" />
        <SecondaryMetricCard title="Paid" value={`₱${stats.statusData.Paid.amount.toLocaleString()}`} subline={`${stats.statusData.Paid.count} Clients`} color="text-emerald-600 dark:text-emerald-400" />
        <SecondaryMetricCard title="NM Since Release" value={`₱${stats.statusData.NMSR.amount.toLocaleString()}`} subline={`${stats.statusData.NMSR.count} Clients`} color="text-red-500 dark:text-red-400" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT SIDE: Collector Performance Matrix */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[500px]">
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
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[500px]">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mt-6">
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-[400px]">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#064e3b] dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Recent Collections
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:shadow-sm transition-all duration-300 border border-transparent hover:border-emerald-100 dark:hover:border-slate-600">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm text-lg font-bold text-[#064e3b] dark:text-emerald-400">₱</div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{payment.borrowerName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{payment.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#064e3b] dark:text-emerald-400">+₱{payment.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Recorded by {payment.recorder}</p>
                </div>
              </div>
            ))}
            {recentPayments.length === 0 && (
              <p className="text-center py-8 text-slate-400 italic text-sm">No recent transactions in this branch.</p>
            )}
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
