import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore';
import { Branch } from '../types';
import MonthlyPerformance from './MonthlyPerformance';
import AgingReport from './AgingReport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportsProps {
  selectedBranch: Branch;
  activeView?: 'performance' | 'monthly-performance' | 'aging';
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

const Reports: React.FC<ReportsProps> = ({ selectedBranch, activeView }) => {
  const [collectorData, setCollectorData] = useState(store.getCollectorPerformance(selectedBranch));
  const activeReport = activeView || 'performance';

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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collector Efficiency Matrix</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Real-time stats for: <span className="font-semibold">{selectedBranch}</span>
                </p>
              </div>
              <button className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Report
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Collector Identity</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Accounts</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Target</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Collected</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Balance</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Efficiency Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {sortedData.map((p, index) => {
                    const rank = index + 1;
                    const isTopThree = rank <= 3;
                    const isHighEfficiency = p.collectionRate >= 75;
                    const isMediumEfficiency = p.collectionRate >= 25 && p.collectionRate < 75;
                    
                    return (
                      <tr key={p.collector} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                              {p.collector.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {p.collector}
                                </span>
                                {isTopThree && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {rank === 1 ? '#1 RANK' : `TOP ${rank}`}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">Field Agent</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right align-middle text-slate-700 dark:text-slate-300">
                          {p.totalAccounts}
                        </td>
                        <td className="px-6 py-4 text-right align-middle text-slate-500">
                          ₱{p.reportedAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right align-middle">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ₱{p.collectedAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right align-middle">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            ₱{p.runningBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center justify-end gap-3">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                              {p.collectionRate.toFixed(1)}%
                            </span>
                            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${isHighEfficiency ? 'bg-emerald-500' : isMediumEfficiency ? 'bg-orange-500' : 'bg-red-500'}`}
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
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No field data available for this branch
                      </td>
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

