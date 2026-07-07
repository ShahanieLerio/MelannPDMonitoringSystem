import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore';
import { Branch } from '../types';
import MonthlyPerformance from './MonthlyPerformance';
import AgingReport from './AgingReport';
import DeadWriteOffReport from './DeadWriteOffReport';
import ReconstructedReport from './ReconstructedReport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportsProps {
  selectedBranch: Branch;
  activeView?: 'performance' | 'monthly-performance' | 'aging' | 'dead-write-off' | 'reconstructed';
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
  const getActiveAccountCount = (p: { totalAccounts: number; activeAccountCount?: number; paidCount?: number }) =>
    p.activeAccountCount ?? Math.max(0, p.totalAccounts - (p.paidCount || 0));

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

  const handleExport = () => {
    const headers = ['Collector Identity', 'Total Accounts', 'Active Accounts', 'Target', 'Collected', 'Balance', 'Efficiency Rate (%)'];
    
    const rows = sortedData.map(p => [
      `"${p.collector}"`,
      p.totalAccounts,
      getActiveAccountCount(p),
      p.reportedAmount,
      p.collectedAmount,
      p.runningBalance,
      p.collectionRate.toFixed(1)
    ]);
    
    const totalTarget = sortedData.reduce((sum, p) => sum + p.reportedAmount, 0);
    const totalCollected = sortedData.reduce((sum, p) => sum + p.collectedAmount, 0);
    const totalEfficiency = totalTarget > 0 ? (totalCollected / totalTarget * 100).toFixed(1) : '0.0';

    const grandTotalRow = [
      '"GRAND TOTAL"',
      sortedData.reduce((sum, p) => sum + p.totalAccounts, 0),
      sortedData.reduce((sum, p) => sum + getActiveAccountCount(p), 0),
      totalTarget,
      totalCollected,
      sortedData.reduce((sum, p) => sum + p.runningBalance, 0),
      totalEfficiency
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
    a.download = `Collector_Efficiency_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {activeReport === 'performance' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {/* Matrix Section (Left) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-10rem)] min-h-[600px]">
            <div className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collector Efficiency Matrix</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Real-time stats for: <span className="font-semibold">{selectedBranch}</span>
                </p>
              </div>
              <button 
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Report
              </button>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full h-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-700/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Collector Identity</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Accounts</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Target</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Collected</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Balance</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Efficiency Rate</th>
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
                        <td className="px-3 py-1.5 align-middle">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {p.collector.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {p.collector}
                                </span>
                                {isTopThree && (
                                  <span className="px-1 py-[1px] rounded-full text-[8px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {rank === 1 ? '#1 RANK' : `TOP ${rank}`}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-500">Field Agent</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center align-middle text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{p.totalAccounts}</span> <span className="text-[9px] text-slate-400 uppercase tracking-wider">Total</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{getActiveAccountCount(p)}</span> <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Active</span>
                        </td>
                        <td className="px-3 py-1.5 text-right align-middle text-slate-500 text-xs">
                          ₱{p.reportedAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right align-middle">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            ₱{p.collectedAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right align-middle">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            ₱{p.runningBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">
                              {p.collectionRate.toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
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
                  {sortedData.length > 0 && (
                    <tr className="bg-emerald-50/50 dark:bg-emerald-900/20 border-t-2 border-emerald-100 dark:border-emerald-800/50">
                      <td className="px-3 py-3 align-middle">
                        <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px] ml-2">Grand Total</span>
                      </td>
                      <td className="px-3 py-3 text-center align-middle text-xs">
                        <span className="font-black text-slate-700 dark:text-slate-300">{sortedData.reduce((sum, p) => sum + p.totalAccounts, 0)}</span> <span className="text-[9px] text-slate-500 uppercase tracking-wider">Total</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">{sortedData.reduce((sum, p) => sum + getActiveAccountCount(p), 0)}</span> <span className="text-[9px] text-emerald-600 uppercase tracking-wider">Active</span>
                      </td>
                      <td className="px-3 py-3 text-right align-middle font-black text-slate-700 dark:text-slate-300 text-xs">
                        ₱{sortedData.reduce((sum, p) => sum + p.reportedAmount, 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-[13px]">
                          ₱{sortedData.reduce((sum, p) => sum + p.collectedAmount, 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <span className="font-black text-emerald-700 dark:text-emerald-400 text-[13px]">
                          ₱{sortedData.reduce((sum, p) => sum + p.runningBalance, 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-black text-[11px] text-slate-700 dark:text-slate-300">
                            {(sortedData.reduce((sum, p) => sum + p.reportedAmount, 0) > 0 ? (sortedData.reduce((sum, p) => sum + p.collectedAmount, 0) / sortedData.reduce((sum, p) => sum + p.reportedAmount, 0)) * 100 : 0).toFixed(1)}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${(sortedData.reduce((sum, p) => sum + p.reportedAmount, 0) > 0 ? (sortedData.reduce((sum, p) => sum + p.collectedAmount, 0) / sortedData.reduce((sum, p) => sum + p.reportedAmount, 0)) * 100 : 0) >= 75 ? 'bg-emerald-500' : (sortedData.reduce((sum, p) => sum + p.reportedAmount, 0) > 0 ? (sortedData.reduce((sum, p) => sum + p.collectedAmount, 0) / sortedData.reduce((sum, p) => sum + p.reportedAmount, 0)) * 100 : 0) >= 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                              style={{ width: `${(sortedData.reduce((sum, p) => sum + p.reportedAmount, 0) > 0 ? (sortedData.reduce((sum, p) => sum + p.collectedAmount, 0) / sortedData.reduce((sum, p) => sum + p.reportedAmount, 0)) * 100 : 0)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-500 text-xs">
                        No field data available for this branch
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Graph Section (Right) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-[calc(100vh-10rem)] min-h-[600px]">
            <div className="flex flex-col gap-4 mb-6 shrink-0">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Performance Visualization</h3>
              <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-500 dark:text-slate-400">High (&ge;75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-slate-500 dark:text-slate-400">Medium (25-74%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-slate-500 dark:text-slate-400">Low (&lt;25%)</span>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              {sortedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    barGap={0}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="collector"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="collectionRate" name="Efficiency Rate" radius={[4, 4, 0, 0]} barSize={30}>
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
        </div>
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
