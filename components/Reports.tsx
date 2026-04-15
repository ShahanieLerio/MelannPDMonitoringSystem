import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore';
import { Branch } from '../types';
import MonthlyPerformance from './MonthlyPerformance';
import AgingReport from './AgingReport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportsProps {
  selectedBranch: Branch;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300 min-w-[200px]">
        <p className="font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2 text-sm transition-colors duration-300">{label}</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-wider transition-colors duration-300">Accounts</span>
            <span className="text-slate-700 dark:text-slate-300 font-bold transition-colors duration-300">{data.totalAccounts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-wider transition-colors duration-300">Target</span>
            <span className="text-slate-500 dark:text-slate-400 font-bold transition-colors duration-300">₱{data.reportedAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider transition-colors duration-300">Collected</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black transition-colors duration-300">₱{data.collectedAmount.toLocaleString()}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center transition-colors duration-300">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold transition-colors duration-300">Efficiency</span>
            <span className={`font-black transition-colors duration-300 ${data.collectionRate > 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>{data.collectionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const Reports: React.FC<ReportsProps> = ({ selectedBranch }) => {
  const [collectorData, setCollectorData] = useState(store.getCollectorPerformance(selectedBranch));
  const [activeReport, setActiveReport] = useState<'performance' | 'aging' | 'monthly-performance'>('performance');

  useEffect(() => {
    setCollectorData(store.getCollectorPerformance(selectedBranch));
    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      setCollectorData(store.getCollectorPerformance(selectedBranch));
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  // Tiered Sorting Logic: Efficiency (%) -> Actual Collected -> Name
  const sortedData = [...collectorData].sort((a, b) => {
    // 1. Efficiency Rate (Descending)
    if (b.collectionRate !== a.collectionRate) {
      return b.collectionRate - a.collectionRate;
    }
    // 2. Actual Collected (Descending)
    if (b.collectedAmount !== a.collectedAmount) {
      return b.collectedAmount - a.collectedAmount;
    }
    // 3. Collector Name (Ascending)
    return a.collector.localeCompare(b.collector);
  });

  const getBarColor = (rate: number) => {
    if (rate >= 75) return '#10b981'; // Green
    if (rate >= 25) return '#f59e0b'; // Amber/Orange
    return '#ef4444'; // Red
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* PILL TABS NAVIGATION */}
      <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
        <button
          onClick={() => setActiveReport('performance')}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeReport === 'performance' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Collector Performance
        </button>
        <button
          onClick={() => setActiveReport('monthly-performance')}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeReport === 'monthly-performance' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Monthly Performance
        </button>
        <button
          onClick={() => setActiveReport('aging')}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${activeReport === 'aging' ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Aging of Receivables
        </button>
      </div>

      {activeReport === 'performance' ? (
        <div className="space-y-8">
          {/* Graph Section */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase transition-colors duration-300">Performance Visualization</h3>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-500 dark:text-slate-400 transition-colors duration-300">High Efficiency (&ge;75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-slate-500 dark:text-slate-400 transition-colors duration-300">Medium (25-74%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-slate-500 dark:text-slate-400 transition-colors duration-300">Low (&lt;25%)</span>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              {sortedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                    barGap={0}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="collector"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="collectionRate" name="Efficiency Rate" radius={[4, 4, 0, 0]} barSize={40}>
                      {sortedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.collectionRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">
                  No collection data available for this branch.
                </div>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Collector Efficiency Matrix</h3>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">Real-time stats for: <span className="text-emerald-600 dark:text-emerald-400 font-black">{selectedBranch}</span></p>
              </div>
              <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all duration-300">Export Report</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                  <tr>
                    <th className="px-8 py-5">Collector Identity</th>
                    <th className="px-8 py-5 text-center">Accounts</th>
                    <th className="px-8 py-5 text-right">Target Amount</th>
                    <th className="px-8 py-5 text-right">Actual Collected</th>
                    <th className="px-8 py-5 text-right">Running Balance</th>
                    <th className="px-8 py-5 text-center">Efficiency Rate (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium transition-colors duration-300">
                  {sortedData.map((p, index) => {
                    const rank = index + 1;
                    return (
                      <tr key={p.collector} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:underline decoration-emerald-500/30 underline-offset-4">{p.collector}</span>
                            {rank === 1 && (
                              <span className="bg-emerald-600 dark:bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-lg font-black shadow-sm shadow-emerald-900/20 dark:shadow-emerald-900/50 animate-pulse">#1 RANK</span>
                            )}
                            {(rank === 2 || rank === 3) && (
                              <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-lg font-black transition-colors duration-300">TOP {rank}</span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase transition-colors duration-300">Field Agent</div>
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-slate-600 dark:text-slate-300 transition-colors duration-300">{p.totalAccounts}</td>
                        <td className="px-8 py-5 text-right text-slate-500 dark:text-slate-400 transition-colors duration-300">₱{p.reportedAmount.toLocaleString()}</td>
                        <td className="px-8 py-5 text-right font-black text-emerald-600 dark:text-emerald-400 transition-colors duration-300">₱{p.collectedAmount.toLocaleString()}</td>
                        <td className="px-8 py-5 text-right font-black text-slate-800 dark:text-white transition-colors duration-300">₱{p.runningBalance.toLocaleString()}</td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`text-[11px] font-black transition-colors duration-300 ${p.collectionRate > 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {p.collectionRate.toFixed(1)}%
                            </span>
                            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-600/50 transition-colors duration-300">
                              <div
                                className={`h-full transition-all duration-1000 ${p.collectionRate > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${p.collectionRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">No field data available for this branch.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeReport === 'aging' ? (
        <AgingReport selectedBranch={selectedBranch} />
      ) : (
        <MonthlyPerformance selectedBranch={selectedBranch} />
      )}
    </div>
  );
};

export default Reports;

