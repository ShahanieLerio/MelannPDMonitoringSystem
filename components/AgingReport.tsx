import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

    const getChartColor = (bucket: string) => {
        if (bucket.includes('1-30')) return '#34d399'; // emerald-400
        if (bucket.includes('31-45') || bucket.includes('46-60')) return '#fbbf24'; // amber-400
        if (bucket.includes('61-90')) return '#f97316'; // orange-500
        return '#ef4444'; // red-500
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
                {collectors.map((c) => {
                    const totalAccounts = c.total.accounts;
                    
                    return (
                        <div key={c.collector} className="bg-white dark:bg-slate-800 flex flex-col h-full transition-all duration-300" style={{ borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                            {/* COLLECTOR MODULE HEADER */}
                            <div className="px-6 py-3 md:px-8 md:py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-6">
                                <div className="flex-1 flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-lg shadow-sm border border-slate-100 dark:border-slate-700">👤</div>
                                        <div className="flex flex-col justify-center">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">{c.collector}</h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">{c.efficiency.toFixed(1)}% Collected</p>
                                                <div className="w-24 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${c.efficiency}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* AGING DISTRIBUTION MINI CHART (HIDDEN ON VERY SMALL SCREENS TO SAVE SPACE) */}
                                    <div className="hidden sm:flex items-end gap-1 h-6 w-24 opacity-60">
                                        {AGING_BUCKETS.map(b => {
                                            const count = c.buckets[b].accounts;
                                            const pct = totalAccounts > 0 ? (count / totalAccounts) * 100 : 0;
                                            return (
                                                <div key={b} className="flex-1 group relative">
                                                    <div className={`w-full rounded-t-sm transition-all duration-700 ${getBucketColor(b)} ${pct > 0 ? 'opacity-100' : 'opacity-20'}`} style={{ height: pct > 0 ? `${Math.max(pct, 15)}%` : '2px' }}></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0 justify-end">
                                    <div className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-center flex flex-col justify-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Accounts</p>
                                        <p className="text-[13px] font-black text-slate-700 dark:text-slate-300 leading-none mt-1">{c.total.accounts}</p>
                                    </div>
                                    <div className="px-4 py-1.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-center flex flex-col justify-center">
                                        <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5 leading-none">Outstanding</p>
                                        <p className="text-[13px] font-black text-red-600 leading-none mt-1">₱{c.total.balance.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                                {/* CONTENT WRAPPER */}
                                <div className="flex flex-col lg:flex-row gap-5 px-4 pt-3 pb-4 md:px-6 md:pt-4 md:pb-6 flex-1">
                                    {/* DATA TABLE CONTAINER */}
                                    <div className="lg:w-[60%] overflow-hidden" style={{ background: '#FAFBFC', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '16px' }}>
                                        <table className="w-full text-center" style={{ tableLayout: 'fixed', width: '100%' }}>
                                            <thead style={{ background: '#F3F5F7', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#4b5563' }}>
                                                <tr>
                                                    <th style={{ width: '18%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>Aging Category</th>
                                                    <th style={{ width: '10%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', borderRight: '1px solid rgba(0,0,0,0.04)' }}>No. of Accts.</th>
                                                    <th style={{ width: '20%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Reported Amt.</th>
                                                    <th style={{ width: '20%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Collected Amt.</th>
                                                    <th style={{ width: '22%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Ending Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {AGING_BUCKETS.map((bucket) => {
                                                    const bData = c.buckets[bucket];
                                                    if (bData.accounts === 0) return null;
                                                    return (
                                                        <tr key={bucket} className="transition-all duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                            <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className={`w-2 h-2 shrink-0 rounded-full ${getBucketColor(bucket)}`}></span>
                                                                    <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', color: '#1e293b' }}>{bucket}</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, color: '#334155', borderRight: '1px solid rgba(0,0,0,0.04)' }}>{bData.accounts}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.reported.toLocaleString()}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, color: '#16a34a', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.collected.toLocaleString()}</td>
                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600, lineHeight: 1.5, color: '#dc2626', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.balance.toLocaleString()}</td>
                                                        </tr>
                                                    );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* BAR CHART CONTAINER */}
                                <div className="lg:w-[40%] flex flex-col" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '16px' }}>
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Ending Balance Distribution</h4>
                                    <div className="flex-1 w-full min-h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={AGING_BUCKETS.map(b => ({
                                                    name: b.replace(' Days', ''),
                                                    bucket: b,
                                                    balance: c.buckets[b].balance,
                                                    accounts: c.buckets[b].accounts
                                                }))}
                                                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.2} />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }}
                                                    interval={0}
                                                />
                                                <YAxis 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }}
                                                    tickFormatter={(value) => value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`}
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-slate-800 text-white p-3 rounded-xl shadow-xl border border-slate-700">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{data.bucket}</p>
                                                                    <p className="text-sm font-black text-white">₱{data.balance.toLocaleString()}</p>
                                                                    <p className="text-[10px] font-bold text-emerald-400 mt-1">{data.accounts} Accounts</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="balance" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                                    {AGING_BUCKETS.map((b, index) => (
                                                        <Cell key={`cell-${index}`} fill={getChartColor(b)} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            
                            {/* COLLECTOR SUMMARY FOOTER */}
                            <div className="font-black py-5 px-8 flex justify-between items-center transition-colors duration-300 rounded-b-[14px]" style={{ background: '#F8FAFB', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Collector Grand Totals</span>
                                <div className="flex gap-10">
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Reported</p>
                                        <p className="text-sm font-bold text-slate-800">₱{c.total.reported.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Collected</p>
                                        <p className="text-sm font-bold text-emerald-600">₱{c.total.collected.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-0.5">Balance</p>
                                        <p className="text-sm font-black text-red-600">₱{c.total.balance.toLocaleString()}</p>
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
