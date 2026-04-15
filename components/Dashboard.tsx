
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { store } from '../services/dataStore.ts';
import { getLoanInsights } from '../services/geminiService.ts';
import { MovingStatus, Branch } from '../types.ts';

interface DashboardProps {
  selectedBranch: Branch;
}

const KpiCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: string; color?: string }> = ({ title, value, subValue, icon, color = "text-slate-900" }) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">{title}</span>
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all duration-300">{icon}</span>
    </div>
    <div className="flex flex-col">
      <span className={`text-xl font-black tracking-tight dark:text-white transition-colors duration-300 ${color}`}>{value}</span>
      {subValue && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 transition-colors duration-300">{subValue}</span>}
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
    <div className="space-y-8 animate-fadeIn max-w-[1600px] mx-auto">
      {/* Primary Summary row - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Accounts" value={stats.totalAccounts} icon="📋" />
        <KpiCard title="Total Collected" value={`₱${stats.totalCollected.toLocaleString()}`} icon="💰" color="text-green-600" />
        <KpiCard title="Total Outstanding" value={`₱${stats.totalOutstanding.toLocaleString()}`} icon="📊" color="text-red-600" />
        <KpiCard title="Running Balance" value={`₱${stats.totalRunning.toLocaleString()}`} icon="📉" color="text-blue-600" />
      </div>

      {/* Status Detail row - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Not Moving" value={`₱${stats.statusData.NM.amount.toLocaleString()}`} subValue={`${stats.statusData.NM.count} Clients`} icon="⏳" color="text-orange-600" />
        <KpiCard title="Moving" value={`₱${stats.statusData.Moving.amount.toLocaleString()}`} subValue={`${stats.statusData.Moving.count} Clients`} icon="🏃" color="text-blue-600" />
        <KpiCard title="Paid" value={`₱${stats.statusData.Paid.amount.toLocaleString()}`} subValue={`${stats.statusData.Paid.count} Clients`} icon="✅" color="text-green-600" />
        <KpiCard title="NM Since Release" value={`₱${stats.statusData.NMSR.amount.toLocaleString()}`} subValue={`${stats.statusData.NMSR.count} Clients`} icon="🚨" color="text-red-600" />
      </div>


      {/* Main Charts Row - Optimized for visibility */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white transition-colors duration-300">Collector Performance Matrix</h3>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">Branch Profile: {selectedBranch}</span>
          </div>
          <div className="h-72 mt-4 ml-[-20px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectorData}>
                <defs>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="collector" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                  dy={10} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} 
                  tickFormatter={(value) => `₱${value.toLocaleString()}`}
                  width={90}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(5, 150, 105, 0.05)' }} 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    padding: '16px'
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: '13px', paddingTop: '4px' }}
                  labelStyle={{ fontWeight: 900, color: '#64748b', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}
                  formatter={(value: number) => [`₱${value.toLocaleString()}`, undefined]}
                />
                <Bar 
                  dataKey="reportedAmount" 
                  name="Target Amount" 
                  fill="url(#colorTarget)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32} 
                />
                <Bar 
                  dataKey="collectedAmount" 
                  name="Collected Amount" 
                  fill="url(#colorCollected)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 transition-colors duration-300">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl transition-colors duration-300">
              <strong>Collector Performance Matrix</strong> shows the total outstanding balance handled by each collector within the selected branch. This visualization helps management quickly identify workload distribution, performance levels, and collection responsibility across field agents. The chart allows supervisors to easily compare collectors and monitor account distribution and recovery focus.
            </p>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-colors duration-300">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 transition-colors duration-300">Account Distribution by Collector</h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-50 dark:border-slate-700 pb-2 transition-colors duration-300">Client load per personnel</p>
          <div className="h-48 flex items-center justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={collectorDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {collectorDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                  formatter={(value) => [`${value} Clients`, 'Load']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-2.5 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {collectorDistribution.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-[11px] group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm group-hover:scale-125 transition-transform duration-300" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600 dark:text-slate-300 font-bold uppercase tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors duration-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800 dark:text-white transition-colors duration-300">{item.value.toLocaleString()}</span>
                  <span className="text-[9px] font-black text-slate-300 dark:text-slate-500 uppercase italic transition-colors duration-300">Clients</span>
                </div>
              </div>
            ))}
            {collectorDistribution.length === 0 && (
              <div className="py-10 text-center text-slate-400 italic text-xs">No collectors assigned yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 transition-colors duration-300">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Recent Collections
          </h3>
          <div className="space-y-4">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 border border-transparent hover:border-emerald-100 dark:hover:border-slate-600 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-sm text-lg font-bold text-emerald-600 dark:text-emerald-400 transition-colors duration-300">₱</div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white transition-colors duration-300">{payment.borrowerName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors duration-300">{payment.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 transition-colors duration-300">+₱{payment.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase transition-colors duration-300">Recorded by {payment.recorder}</p>
                </div>
              </div>
            ))}
            {recentPayments.length === 0 && (
              <p className="text-center py-8 text-slate-400 italic">No recent transactions in this branch.</p>
            )}
          </div>
        </div>

        <div className="bg-[#064e3b] text-white p-8 rounded-2xl shadow-xl shadow-emerald-900/20 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-4 opacity-5">
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
                className="bg-white/10 backdrop-blur hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
              >
                {isAiLoading ? 'Analyzing...' : 'Refresh Insights'}
              </button>
            </div>
            <div className="flex-1 bg-black/20 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              {aiInsight ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="leading-relaxed text-emerald-50 font-medium whitespace-pre-wrap">{aiInsight}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-6">
                  <div className="w-12 h-12 bg-emerald-800 rounded-full flex items-center justify-center mb-4 text-xl">🤖</div>
                  <p className="italic text-emerald-300 font-medium">Click "Refresh Insights" to let Gemini scan branch data for collection strategies.</p>
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
