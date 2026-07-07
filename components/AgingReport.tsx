import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { store } from '../services/dataStore';
import { isReportableCollectionPayment } from '../services/loanUtils';
import { Branch } from '../types';

interface AgingReportProps {
    selectedBranch: Branch;
}

const AGING_BUCKETS = [
    '30-60 Days',
    '61-90 Days',
    '91-120 Days',
    '120+ Days'
];

interface AgingBucketDetail {
    loanId: string;
    clientCode: string;
    clientName: string;
    area: string;
    collector: string;
    dueDate: string;
    reportedAmount: number;
    collectedAmount: number;
    endingBalance: number;
}

interface SelectedAgingBucket {
    bucketName: string;
    collectorName?: string;
    details: AgingBucketDetail[];
}

type DateFilterMode = 'all' | 'specific' | 'range';
type AgingTab = 'overall' | 'by-collector';

const toDateOnly = (value: string) => {
    if (!value) return '';
    return value.includes('T') ? value.split('T')[0] : value;
};

const isWithinDateFilter = (dueDate: string, mode: DateFilterMode, fromDate: string, toDate: string) => {
    if (mode === 'all') return true;

    const loanDate = toDateOnly(dueDate);
    if (!loanDate) return false;

    if (mode === 'specific') {
        return fromDate ? loanDate === fromDate : true;
    }

    if (fromDate && loanDate < fromDate) return false;
    if (toDate && loanDate > toDate) return false;
    return true;
};

const AgingReport: React.FC<AgingReportProps> = ({ selectedBranch }) => {
    const [loans, setLoans] = useState(store.getLoans(selectedBranch));
    const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeAgingTab, setActiveAgingTab] = useState<AgingTab>('overall');
    const [selectedBucketRow, setSelectedBucketRow] = useState<SelectedAgingBucket | null>(null);

    useEffect(() => {
        setLoans(store.getLoans(selectedBranch));
        const unsubscribe = store.subscribe(() => {
            setLoans(store.getLoans(selectedBranch));
        });
        return () => unsubscribe();
    }, [selectedBranch]);

    const { collectors, grandTotals, overallBuckets } = useMemo(() => {
        const collectorData: Record<string, Record<string, { accounts: number; reported: number; collected: number; balance: number; details: AgingBucketDetail[] }>> = {};
        const today = new Date();
        const totals = { accounts: 0, reported: 0, collected: 0, balance: 0 };
        // Overall bucket aggregation
        const bucketTotals: Record<string, { accounts: number; reported: number; collected: number; balance: number; details: AgingBucketDetail[] }> = {};
        AGING_BUCKETS.forEach(b => {
            bucketTotals[b] = { accounts: 0, reported: 0, collected: 0, balance: 0, details: [] };
        });

        loans.forEach(loan => {
            const reportedAmt = loan.totalLoan != null && loan.totalLoan > 0 ? loan.totalLoan : loan.outstandingBalance;
            if (reportedAmt <= 0) return;
            if (!loan.dueDate) return;
            if (!isWithinDateFilter(loan.dueDate, dateFilterMode, fromDate, toDate)) return;
            const reportableCollected = (loan.payments || [])
                .filter(isReportableCollectionPayment)
                .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            const reportableEndingBalance = Math.max(0, reportedAmt - reportableCollected);

            const dueDate = new Date(loan.dueDate);
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let bucket = '';
            if (diffDays <= 60) bucket = '30-60 Days';
            else if (diffDays <= 90) bucket = '61-90 Days';
            else if (diffDays <= 120) bucket = '91-120 Days';
            else bucket = '120+ Days';

            if (!collectorData[loan.collector]) {
                collectorData[loan.collector] = {};
                AGING_BUCKETS.forEach(b => {
                    collectorData[loan.collector][b] = { accounts: 0, reported: 0, collected: 0, balance: 0, details: [] };
                });
            }

            const entry = collectorData[loan.collector][bucket];
            entry.accounts++;
            entry.reported += reportedAmt;
            entry.collected += reportableCollected;
            entry.balance += reportableEndingBalance;

            const detail: AgingBucketDetail = {
                loanId: loan.id,
                clientCode: loan.code,
                clientName: loan.borrowerName,
                area: loan.area || 'N/A',
                collector: loan.collector,
                dueDate: (loan.dueDate || '').substring(0, 10),
                reportedAmount: reportedAmt,
                collectedAmount: reportableCollected,
                endingBalance: reportableEndingBalance
            };

            entry.details.push(detail);

            // Aggregate into overall buckets
            bucketTotals[bucket].accounts++;
            bucketTotals[bucket].reported += reportedAmt;
            bucketTotals[bucket].collected += reportableCollected;
            bucketTotals[bucket].balance += reportableEndingBalance;
            bucketTotals[bucket].details.push(detail);

            totals.accounts++;
            totals.reported += reportedAmt;
            totals.collected += reportableCollected;
            totals.balance += reportableEndingBalance;
        });

        const processedCollectors = Object.entries(collectorData)
            .map(([collector, buckets]) => {
                // Sort details for each bucket
                AGING_BUCKETS.forEach(b => {
                    buckets[b].details.sort((a, bDetail) => a.clientName.localeCompare(bDetail.clientName));
                });

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

        // Sort overall details
        AGING_BUCKETS.forEach(b => {
            bucketTotals[b].details.sort((a, bDetail) => a.clientName.localeCompare(bDetail.clientName));
        });

        return { collectors: processedCollectors, grandTotals: totals, overallBuckets: bucketTotals };
    }, [loans, dateFilterMode, fromDate, toDate]);

    const clearDateFilter = () => {
        setDateFilterMode('all');
        setFromDate('');
        setToDate('');
    };

    const handleModeChange = (mode: DateFilterMode) => {
        setDateFilterMode(mode);
        if (mode === 'all') {
            setFromDate('');
            setToDate('');
        } else if (mode === 'specific') {
            setToDate('');
        }
    };

    const getBucketColor = (bucket: string) => {
        if (bucket.includes('30-60')) return 'bg-amber-400';
        if (bucket.includes('61-90')) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getChartColor = (bucket: string) => {
        if (bucket.includes('30-60')) return '#fbbf24'; // amber-400
        if (bucket.includes('61-90')) return '#f97316'; // orange-500
        return '#ef4444'; // red-500
    };

    const getBucketTextColor = (bucket: string) => {
        if (bucket.includes('30-60')) return '#d97706';
        if (bucket.includes('61-90')) return '#ea580c';
        return '#dc2626';
    };

    if (false && collectors.length === 0) {
        return (
            <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 animate-fadeIn">
                <span className="text-6xl mb-6 opacity-20">📊</span>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">No receivables data available</h3>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Try selecting a different branch</p>
            </div>
        );
    }

    // Overall efficiency
    const overallEfficiency = grandTotals.reported > 0 ? (grandTotals.collected / grandTotals.reported) * 100 : 0;

    return (
        <div className="space-y-12 animate-fadeIn">
            {/* HEADER */}
            <div className="px-2 flex flex-col gap-5">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Aging of Receivables</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Breakdown of outstanding balances by aging category</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm p-4 md:p-5">
                    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Due Date Filter</p>
                            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 p-1 border border-slate-100 dark:border-slate-700">
                                {([
                                    { value: 'all', label: 'All Dates' },
                                    { value: 'specific', label: 'Specific Date' },
                                    { value: 'range', label: 'Date Range' },
                                ] as { value: DateFilterMode; label: string }[]).map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleModeChange(option.value)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateFilterMode === option.value ? 'bg-[#064e3b] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[180px_180px_auto] gap-3 flex-1 xl:max-w-[520px]">
                            <label className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{dateFilterMode === 'specific' ? 'Due Date' : 'From Date'}</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    disabled={dateFilterMode === 'all'}
                                    onChange={(event) => setFromDate(event.target.value)}
                                    className="h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 px-4 rounded-xl outline-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-600 transition-colors"
                                />
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Date</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    disabled={dateFilterMode !== 'range'}
                                    onChange={(event) => setToDate(event.target.value)}
                                    className="h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 px-4 rounded-xl outline-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-600 transition-colors"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={clearDateFilter}
                                className="h-11 self-end px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {/* SUB-TABS: Overall / By Collector */}
                <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 w-fit">
                    {([
                        { value: 'overall' as AgingTab, label: 'Overall', icon: '📊' },
                        { value: 'by-collector' as AgingTab, label: 'By Collector', icon: '👤' },
                    ]).map(tab => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveAgingTab(tab.value)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                activeAgingTab === tab.value
                                    ? 'bg-[#064e3b] text-white shadow-lg shadow-emerald-900/20'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            <span className="text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {collectors.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 animate-fadeIn">
                    <span className="text-6xl mb-6 opacity-20">Chart</span>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">No receivables data available</h3>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Try selecting a different branch or date filter</p>
                </div>
            ) : (
            <>
            {/* SUMMARY DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <SummaryCard label="Total Accounts" value={grandTotals.accounts.toString()} icon="👥" color="text-slate-600 dark:text-slate-200" />
                <SummaryCard label="Reported Amount" value={`₱${grandTotals.reported.toLocaleString()}`} icon="📋" color="text-slate-600 dark:text-slate-200" />
                <SummaryCard label="Total Collected" value={`₱${grandTotals.collected.toLocaleString()}`} icon="💰" color="text-emerald-600 dark:text-emerald-400" />
                <SummaryCard label="Total Outstanding" value={`₱${grandTotals.balance.toLocaleString()}`} icon="⚠️" color="text-red-600 dark:text-red-400" />
            </div>

            {/* ===== OVERALL TAB ===== */}
            {activeAgingTab === 'overall' && (
                <div className="space-y-8 animate-fadeIn">
                    {/* Overall Aging Summary Card */}
                    <div className="bg-white dark:bg-slate-800 transition-all duration-300" style={{ borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                        {/* Header */}
                        <div className="px-6 py-4 md:px-8 md:py-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-lg shadow-md text-white">📊</div>
                                <div className="flex flex-col justify-center">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">Overall Aging Summary</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">{overallEfficiency.toFixed(1)}% Collection Rate</p>
                                        <div className="w-28 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 rounded-full" style={{ width: `${Math.min(overallEfficiency, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto justify-end">
                                <div className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-center flex flex-col justify-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Collectors</p>
                                    <p className="text-[14px] font-black text-slate-700 dark:text-slate-300 leading-none mt-1">{collectors.length}</p>
                                </div>
                                <div className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-center flex flex-col justify-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Total Accounts</p>
                                    <p className="text-[14px] font-black text-slate-700 dark:text-slate-300 leading-none mt-1">{grandTotals.accounts}</p>
                                </div>
                                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-center flex flex-col justify-center">
                                    <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5 leading-none">Outstanding</p>
                                    <p className="text-[14px] font-black text-red-600 leading-none mt-1">₱{grandTotals.balance.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content: Table + Chart side by side */}
                        <div className="flex flex-col lg:flex-row gap-5 px-4 pt-4 pb-5 md:px-6 md:pt-5 md:pb-6">
                            {/* DATA TABLE */}
                            <div className="lg:w-[60%] overflow-hidden" style={{ background: '#FAFBFC', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '16px' }}>
                                <table className="w-full text-center" style={{ tableLayout: 'fixed', width: '100%' }}>
                                    <thead style={{ background: '#F3F5F7', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#4b5563' }}>
                                        <tr>
                                            <th style={{ width: '16%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>Aging Category</th>
                                            <th style={{ width: '10%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', borderRight: '1px solid rgba(0,0,0,0.04)' }}>No. of Accts.</th>
                                            <th style={{ width: '10%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>% Share</th>
                                            <th style={{ width: '18%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Reported Amt.</th>
                                            <th style={{ width: '18%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Collected Amt.</th>
                                            <th style={{ width: '18%', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', padding: '10px 8px', textAlign: 'center' }}>Ending Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {AGING_BUCKETS.map((bucket) => {
                                            const bData = overallBuckets[bucket];
                                            const pctShare = grandTotals.accounts > 0 ? ((bData.accounts / grandTotals.accounts) * 100) : 0;
                                            return (
                                                <tr 
                                                    key={bucket} 
                                                    onClick={() => {
                                                        if (bData.accounts > 0) {
                                                            setSelectedBucketRow({
                                                                bucketName: bucket,
                                                                details: bData.details
                                                            });
                                                        }
                                                    }}
                                                    className={`transition-all duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${bData.accounts > 0 ? 'cursor-pointer' : ''}`} 
                                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                                >
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${getBucketColor(bucket)}`}></span>
                                                            <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', color: getBucketTextColor(bucket) }}>{bucket}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '14px', fontWeight: 700, lineHeight: 1.5, color: '#334155', borderRight: '1px solid rgba(0,0,0,0.04)' }}>{bData.accounts}</td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.04)' }}>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>{pctShare.toFixed(1)}%</span>
                                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-700 ${getBucketColor(bucket)}`} style={{ width: `${pctShare}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 500, lineHeight: 1.5, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.reported.toLocaleString()}</td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600, lineHeight: 1.5, color: '#16a34a', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.collected.toLocaleString()}</td>
                                                    <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, lineHeight: 1.5, color: '#dc2626', whiteSpace: 'normal', wordBreak: 'break-word' }}>₱{bData.balance.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Totals Row */}
                                        <tr style={{ borderTop: '2px solid rgba(0,0,0,0.12)', background: '#F0F4F8' }}>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid rgba(0,0,0,0.04)' }}>Grand Total</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '14px', fontWeight: 800, color: '#1e293b', borderRight: '1px solid rgba(0,0,0,0.04)' }}>{grandTotals.accounts}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#475569', borderRight: '1px solid rgba(0,0,0,0.04)' }}>100%</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>₱{grandTotals.reported.toLocaleString()}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>₱{grandTotals.collected.toLocaleString()}</td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>₱{grandTotals.balance.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* OVERALL BAR CHART */}
                            <div className="lg:w-[40%] flex flex-col" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '16px' }}>
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Overall Balance Distribution</h4>
                                <div className="flex-1 w-full min-h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={AGING_BUCKETS.map(b => ({
                                                name: b.replace(' Days', ''),
                                                bucket: b,
                                                balance: overallBuckets[b].balance,
                                                accounts: overallBuckets[b].accounts,
                                                reported: overallBuckets[b].reported,
                                                collected: overallBuckets[b].collected
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
                                                tickFormatter={(value) => value >= 1000000 ? `₱${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-slate-800 text-white p-3 rounded-xl shadow-xl border border-slate-700 min-w-[180px]">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{data.bucket}</p>
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[10px] text-slate-400 font-bold">Accounts</span>
                                                                        <span className="text-xs font-bold text-white">{data.accounts}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[10px] text-slate-400 font-bold">Reported</span>
                                                                        <span className="text-xs font-bold text-slate-300">₱{data.reported.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[10px] text-emerald-400 font-bold">Collected</span>
                                                                        <span className="text-xs font-bold text-emerald-400">₱{data.collected.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between pt-1 border-t border-slate-700">
                                                                        <span className="text-[10px] text-red-400 font-bold">Balance</span>
                                                                        <span className="text-sm font-black text-red-400">₱{data.balance.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="balance" radius={[6, 6, 0, 0]} maxBarSize={45}>
                                                {AGING_BUCKETS.map((b, index) => (
                                                    <Cell key={`cell-overall-${index}`} fill={getChartColor(b)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Overall Footer */}
                        <div className="font-black py-5 px-8 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors duration-300 rounded-b-[14px]" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Overall Grand Totals</span>
                            <div className="flex gap-8 sm:gap-10">
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Reported</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">₱{grandTotals.reported.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Collected</p>
                                    <p className="text-sm font-bold text-emerald-600">₱{grandTotals.collected.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-0.5">Balance</p>
                                    <p className="text-sm font-black text-red-600">₱{grandTotals.balance.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Efficiency</p>
                                    <p className="text-sm font-black text-blue-600">{overallEfficiency.toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Aging Composition Breakdown Bars */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 transition-all duration-300" style={{ borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                        <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-6">Aging Composition by Balance</h4>
                        {/* Stacked horizontal bar */}
                        <div className="w-full h-8 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-700 mb-5">
                            {AGING_BUCKETS.map(b => {
                                const pct = grandTotals.balance > 0 ? (overallBuckets[b].balance / grandTotals.balance) * 100 : 0;
                                if (pct <= 0) return null;
                                return (
                                    <div
                                        key={b}
                                        className="h-full transition-all duration-700 relative group cursor-pointer"
                                        style={{ width: `${pct}%`, backgroundColor: getChartColor(b) }}
                                        title={`${b}: ₱${overallBuckets[b].balance.toLocaleString()} (${pct.toFixed(1)}%)`}
                                    >
                                        {pct > 6 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/90 drop-shadow-sm">
                                                {pct.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            {AGING_BUCKETS.map(b => {
                                const pct = grandTotals.balance > 0 ? (overallBuckets[b].balance / grandTotals.balance) * 100 : 0;
                                return (
                                    <div key={b} className="flex items-center gap-2 text-xs">
                                        <span className={`w-3 h-3 rounded-full ${getBucketColor(b)}`}></span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300">{b}</span>
                                        <span className="font-black text-slate-400 dark:text-slate-500">{pct.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BY COLLECTOR TAB ===== */}
            {activeAgingTab === 'by-collector' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 animate-fadeIn">
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
                                                    return (
                                                        <tr 
                                                            key={bucket} 
                                                            onClick={() => {
                                                                if (bData.accounts > 0) {
                                                                    setSelectedBucketRow({
                                                                        bucketName: bucket,
                                                                        collectorName: c.collector,
                                                                        details: bData.details
                                                                    });
                                                                }
                                                            }}
                                                            className={`transition-all duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${bData.accounts > 0 ? 'cursor-pointer' : ''}`} 
                                                            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                                        >
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
            )}
            </>
            )}

            {selectedBucketRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-4 py-6 animate-fadeIn">
                    <div className="w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Aging Details</p>
                                <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedBucketRow.bucketName}</h3>
                                {selectedBucketRow.collectorName && (
                                    <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {selectedBucketRow.collectorName}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Accounts</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{selectedBucketRow.details.length}</p>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Balance</p>
                                    <p className="text-2xl font-black text-red-600 dark:text-red-400">&#8369;{selectedBucketRow.details.reduce((sum, d) => sum + d.endingBalance, 0).toLocaleString()}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedBucketRow(null)}
                                    className="h-10 w-10 ml-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <span className="text-xl leading-none">&times;</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col min-h-0">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 overflow-y-auto custom-scrollbar relative">
                                <table className="w-full text-left border-collapse m-0">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 backdrop-blur-sm z-10 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Client Name / Area</th>
                                            {!selectedBucketRow.collectorName && (
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Collector</th>
                                            )}
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Due Date</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Reported Amt</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Collected Amt</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ending Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {selectedBucketRow.details.map((detail, idx) => (
                                            <tr key={`${detail.loanId}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={detail.clientName}>{detail.clientName}</div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{detail.clientCode}</span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]" title={detail.area}>{detail.area}</span>
                                                    </div>
                                                </td>
                                                {!selectedBucketRow.collectorName && (
                                                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        {detail.collector}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                                                    {detail.dueDate ? new Date(detail.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    &#8369;{detail.reportedAmount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                    &#8369;{detail.collectedAmount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-black text-red-600 dark:text-red-400">
                                                    &#8369;{detail.endingBalance.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
