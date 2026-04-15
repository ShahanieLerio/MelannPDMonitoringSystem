import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore';
import { Branch } from '../types';

interface AgingReportProps {
    selectedBranch: Branch;
}

const AGING_BUCKETS = [
    '1-30 Days',
    '31-45 Days',
    '46-60 Days',
    '61-90 Days',
    '91-120 Days',
    '120+ Days'
];

const AgingReport: React.FC<AgingReportProps> = ({ selectedBranch }) => {
    const [loans, setLoans] = useState(store.getLoans(selectedBranch));

    useEffect(() => {
        setLoans(store.getLoans(selectedBranch));
        const unsubscribe = store.subscribe(() => {
            setLoans(store.getLoans(selectedBranch));
        });
        return () => unsubscribe();
    }, [selectedBranch]);

    const { collectors, grandTotals } = useMemo(() => {
        const collectorData: Record<string, Record<string, { accounts: number; reported: number; collected: number; balance: number }>> = {};
        const today = new Date();
        const totals = { accounts: 0, reported: 0, collected: 0, balance: 0 };

        loans.forEach(loan => {
            if (loan.outstandingBalance <= 0) return;
            if (!loan.dueDate) return;

            const dueDate = new Date(loan.dueDate);
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let bucket = '';
            if (diffDays <= 30) bucket = '1-30 Days';
            else if (diffDays <= 45) bucket = '31-45 Days';
            else if (diffDays <= 60) bucket = '46-60 Days';
            else if (diffDays <= 90) bucket = '61-90 Days';
            else if (diffDays <= 120) bucket = '91-120 Days';
            else bucket = '120+ Days';

            if (!collectorData[loan.collector]) {
                collectorData[loan.collector] = {};
                AGING_BUCKETS.forEach(b => {
                    collectorData[loan.collector][b] = { accounts: 0, reported: 0, collected: 0, balance: 0 };
                });
            }

            const entry = collectorData[loan.collector][bucket];
            entry.accounts++;
            entry.reported += loan.outstandingBalance;
            entry.collected += loan.amountCollected;
            entry.balance += loan.runningBalance;

            totals.accounts++;
            totals.reported += loan.outstandingBalance;
            totals.collected += loan.amountCollected;
            totals.balance += loan.runningBalance;
        });

        const processedCollectors = Object.entries(collectorData)
            .map(([collector, buckets]) => {
                const collectorTotals = AGING_BUCKETS.reduce((acc, b) => ({
                    accounts: acc.accounts + buckets[b].accounts,
                    reported: acc.reported + buckets[b].reported,
                    collected: acc.collected + buckets[b].collected,
                    balance: acc.balance + buckets[b].balance,
                }), { accounts: 0, reported: 0, collected: 0, balance: 0 });
                
                const efficiency = collectorTotals.reported > 0 ? (collectorTotals.collected / collectorTotals.reported) * 100 : 0;
                
                return {
                    collector,
                    buckets,
                    efficiency,
                    total: collectorTotals
                };
            })
            .sort((a, b) => a.collector.localeCompare(b.collector));

        return { collectors: processedCollectors, grandTotals: totals };
    }, [loans]);

    const getBucketColor = (bucket: string) => {
        if (bucket.includes('1-30')) return 'bg-emerald-400';
        if (bucket.includes('31-45') || bucket.includes('46-60')) return 'bg-amber-400';
        if (bucket.includes('61-90')) return 'bg-orange-500';
        return 'bg-red-500';
    };

    if (collectors.length === 0) {
        return (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 animate-fadeIn">
                <span className="text-6xl mb-6 opacity-20">📊</span>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">No receivables data available</h3>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Try selecting a different branch</p>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fadeIn">
            {/* HEADER */}
            <div className="px-2">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Aging of Receivables</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Breakdown of outstanding balances by aging category</p>
            </div>

            {/* SUMMARY DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <SummaryCard label="Total Accounts" value={grandTotals.accounts.toString()} icon="👥" color="text-slate-600 dark:text-slate-200" />
                <SummaryCard label="Reported Amount" value={`₱${grandTotals.reported.toLocaleString()}`} icon="📋" color="text-slate-600 dark:text-slate-200" />
                <SummaryCard label="Total Collected" value={`₱${grandTotals.collected.toLocaleString()}`} icon="💰" color="text-emerald-600 dark:text-emerald-400" />
                <SummaryCard label="Total Outstanding" value={`₱${grandTotals.balance.toLocaleString()}`} icon="⚠️" color="text-red-600 dark:text-red-400" />
            </div>

            {/* COLLECTOR CARDS - ALL FULLY VISIBLE */}
            <div className="space-y-10">
                {collectors.map((c) => {
                    const totalAccounts = c.total.accounts;
                    
                    return (
                        <div key={c.collector} className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300">
                            {/* COLLECTOR MODULE HEADER */}
                            <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-slate-700">👤</div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{c.collector}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{c.efficiency.toFixed(1)}% Collected</p>
                                                <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${c.efficiency}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* AGING DISTRIBUTION MINI CHART */}
                                    <div className="flex items-end gap-1 h-8">
                                        {AGING_BUCKETS.map(b => {
                                            const count = c.buckets[b].accounts;
                                            const pct = totalAccounts > 0 ? (count / totalAccounts) * 100 : 0;
                                            return (
                                                <div key={b} className="flex-1 group relative">
                                                    <div className={`w-full rounded-t-sm transition-all duration-700 ${getBucketColor(b)} ${pct > 0 ? 'opacity-100' : 'opacity-20'}`} style={{ height: pct > 0 ? `${Math.max(pct, 15)}%` : '2px' }}></div>
                                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-10">
                                                        <div className="bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap">{count} Accts ({b})</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-4 w-full md:w-auto">
                                    <div className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Accounts</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-300">{c.total.accounts}</p>
                                    </div>
                                    <div className="flex-1 md:flex-none px-6 py-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-center">
                                        <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5">Outstanding</p>
                                        <p className="text-sm font-black text-red-600">₱{c.total.balance.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* DATA TABLE - PERMANENTLY VISIBLE */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-[#F9FAFB] dark:bg-slate-900/80 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                                        <tr>
                                            <th className="px-8 py-5">Aging Category</th>
                                            <th className="px-8 py-5 text-center">Accounts</th>
                                            <th className="px-8 py-5 text-right">Reported Amt.</th>
                                            <th className="px-8 py-5 text-right">Collected Amt.</th>
                                            <th className="px-8 py-5 text-right">Ending Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30 font-medium">
                                        {AGING_BUCKETS.map((bucket, bIdx) => {
                                            const bData = c.buckets[bucket];
                                            if (bData.accounts === 0) return null;
                                            return (
                                                <tr key={bucket} className={`group transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/40 ${bIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/20 dark:bg-slate-800/40'}`}>
                                                    <td className="px-8 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-2 h-2 rounded-full ${getBucketColor(bucket)}`}></span>
                                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{bucket}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400">{bData.accounts}</td>
                                                    <td className="px-8 py-4 text-right text-xs font-bold text-slate-400">₱{bData.reported.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right text-xs font-black text-emerald-600 dark:text-emerald-400">₱{bData.collected.toLocaleString()}</td>
                                                    <td className="px-8 py-4 text-right text-sm font-black text-red-600">₱{bData.balance.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* COLLECTOR SUMMARY FOOTER */}
                            <div className="bg-slate-50/80 dark:bg-slate-900 text-slate-800 dark:text-white font-black py-5 px-8 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center transition-colors duration-300">
                                <span className="text-[10px] uppercase tracking-[0.2em] opacity-40">Collector Grand Totals</span>
                                <div className="flex gap-10">
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reported</p>
                                        <p className="text-xs">₱{c.total.reported.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Collected</p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">₱{c.total.collected.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5">Balance</p>
                                        <p className="text-xs text-red-600">₱{c.total.balance.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ label: string; value: string; icon: string; color: string }> = ({ label, value, icon, color }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
            <span className="text-2xl filter grayscale opacity-50">{icon}</span>
            <div className="w-8 h-2 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"></div>
        </div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-xl font-black ${color} tracking-tight`}>{value}</p>
    </div>
);

export default AgingReport;
