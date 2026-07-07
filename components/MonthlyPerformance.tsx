
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { store } from '../services/dataStore.ts';
import { getCollectorDisplayName, normalizeCollectorKey } from '../services/collectorUtils.ts';
import { isDeadWriteOffLoan, isReportableCollectionPayment } from '../services/loanUtils.ts';
import { Loan, Payment, Branch, DispositionStatus, DispositionType } from '../types.ts';

interface MonthlyPerformanceProps {
    selectedBranch: Branch;
}

interface CollectionPaymentDetail {
    collector: string;
    area: string;
    loan: Loan;
    payment: Payment;
    paymentDate: string;
}

interface DailyCollectionSummary {
    date: string;
    amount: number;
    count: number;
    details: CollectionPaymentDetail[];
}

const MonthlyPerformance: React.FC<MonthlyPerformanceProps> = ({ selectedBranch }) => {
    const [loans, setLoans] = useState(() => [...store.getLoans(selectedBranch)]);
    const [collectors, setCollectors] = useState(() => [...store.getCollectors()]);
    const [activeTab, setActiveTab] = useState<'reported' | 'efficiency'>('reported');
    const [selectedReportedCollector, setSelectedReportedCollector] = useState<string | null>(null);
    const [selectedCollectionCollector, setSelectedCollectionCollector] = useState<string | null>(null);
    const [selectedCollectionDay, setSelectedCollectionDay] = useState<string | null>(null);

    useEffect(() => {
        const updateState = () => {
            setLoans([...store.getLoans(selectedBranch)]);
            setCollectors([...store.getCollectors()]);
        };
        updateState();
        const unsubscribe = store.subscribe(updateState);
        return () => unsubscribe();
    }, [selectedBranch]);

    // Section 1 State
    const currentDate = new Date();
    const currentYearStr = currentDate.getFullYear().toString();
    const currentMonthStr = (currentDate.getMonth() + 1).toString().padStart(2, '0');

    const [fromYear, setFromYear] = useState(currentYearStr);
    const [fromMonth, setFromMonth] = useState(currentMonthStr);
    const [toYear, setToYear] = useState(currentYearStr);
    const [toMonth, setToMonth] = useState(currentMonthStr);

    // Section 2 State
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });

    const [dueStartDate, setDueStartDate] = useState('');
    const [dueEndDate, setDueEndDate] = useState('');

    const formatDateLabel = (date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
        new Date(`${date}T00:00:00`).toLocaleDateString([], options);

    const isOfficialWriteOff = (loanId: string) =>
        store.getDispositions(loanId).some(disposition =>
            (disposition.type === DispositionType.PROSPECT_WRITE_OFF || disposition.type === DispositionType.DEAD_ACCOUNT) &&
            (disposition.status === DispositionStatus.APPROVED || disposition.status === DispositionStatus.EXECUTED)
        );

    const isExcludedFromCollectionReports = (loan: Loan) =>
        isDeadWriteOffLoan(loan) || isOfficialWriteOff(loan.id);

    // Month mapping
    const months = [
        { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' }, { value: '03', label: 'Mar' },
        { value: '04', label: 'Apr' }, { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
        { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' }, { value: '09', label: 'Sep' },
        { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' }
    ];

    // Validation Logic
    const validationError = useMemo(() => {
        const fromValue = parseInt(fromYear + fromMonth);
        const toValue = parseInt(toYear + toMonth);
        const currentValue = parseInt(currentYearStr + currentMonthStr);

        if (fromValue > toValue) {
            return "From date cannot be later than To date.";
        }
        if (fromValue > currentValue || toValue > currentValue) {
            return "Future months are not allowed.";
        }
        return null;
    }, [fromYear, fromMonth, toYear, toMonth, currentYearStr, currentMonthStr]);

    // Section 1 Calculation: Reported Past Due
    const reportedPastDueData = useMemo(() => {
        if (validationError) return [];

        const data: Record<string, { area: string, collector: string, amount: number }> = {};
        const fromStr = `${fromYear}-${fromMonth}`;
        const toStr = `${toYear}-${toMonth}`;

        loans.forEach(loan => {
            if (isExcludedFromCollectionReports(loan)) return;

            if (loan.monthReported >= fromStr && loan.monthReported <= toStr) {
                const key = getCollectorDisplayName(loan.collector, collectors);
                if (!data[key]) {
                    const searchName = normalizeCollectorKey(loan.collector);
                    const collectorInfo = collectors.find(c => 
                        normalizeCollectorKey(c.name) === searchName ||
                        normalizeCollectorKey(c.nickname) === searchName
                    );
                    const deploymentArea = (collectorInfo?.address?.trim() || loan.area?.trim() || 'N/A');
                    
                    data[key] = { area: deploymentArea, collector: key, amount: 0 };
                }
                data[key].amount += loan.outstandingBalance;
            }
        });

        return Object.values(data).sort((a, b) => b.amount - a.amount);
    }, [loans, collectors, fromYear, fromMonth, toYear, toMonth, validationError]);

    const collectionFilterMeta = useMemo(() => {
        const dueStart = dueStartDate ? dueStartDate.substring(0, 10) : null;
        const dueEnd = dueEndDate ? dueEndDate.substring(0, 10) : null;

        let dueDateRangeDisplay = 'All Due Dates';
        if (dueStart && dueEnd) {
            dueDateRangeDisplay = `${formatDateLabel(dueStart)} - ${formatDateLabel(dueEnd)}`;
        } else if (dueStart) {
            dueDateRangeDisplay = `From ${formatDateLabel(dueStart)}`;
        } else if (dueEnd) {
            dueDateRangeDisplay = `Until ${formatDateLabel(dueEnd)}`;
        }

        return {
            filterStart: startDate.substring(0, 10),
            filterEnd: endDate.substring(0, 10),
            dueStart,
            dueEnd,
            dueDateRangeDisplay
        };
    }, [startDate, endDate, dueStartDate, dueEndDate]);

    const collectionPaymentDetails = useMemo<CollectionPaymentDetail[]>(() => {
        const { filterStart, filterEnd, dueStart, dueEnd } = collectionFilterMeta;
        const details: CollectionPaymentDetail[] = [];

        loans.forEach(loan => {
            if (isExcludedFromCollectionReports(loan)) return;

            const collectorKey = getCollectorDisplayName(loan.collector, collectors);

            // Apply due date filter logic BEFORE checking payments
            if (dueStart || dueEnd) {
                const loanDueDate = (loan.dueDate || '').substring(0, 10);
                if (dueStart && loanDueDate < dueStart) return;
                if (dueEnd && loanDueDate > dueEnd) return;
            }

            loan.payments.forEach(payment => {
                if (!isReportableCollectionPayment(payment)) return;

                // Safely extract YYYY-MM-DD from the payment date, even if it's an ISO string Date/Time
                const paymentDateStr = (payment.date || '').substring(0, 10);
                if (!paymentDateStr) return;

                const isWithinFilterRange = paymentDateStr >= filterStart && paymentDateStr <= filterEnd;

                if (isWithinFilterRange) {
                    const searchName = normalizeCollectorKey(loan.collector);
                    const collectorInfo = collectors.find(c =>
                        normalizeCollectorKey(c.name) === searchName ||
                        normalizeCollectorKey(c.nickname) === searchName
                    );
                    const deploymentArea = (collectorInfo?.address?.trim() || loan.area?.trim() || 'N/A');

                    details.push({
                        collector: collectorKey,
                        area: deploymentArea,
                        loan,
                        payment,
                        paymentDate: paymentDateStr
                    });
                }
            });
        });

        return details.sort((a, b) => {
            const dateDiff = b.paymentDate.localeCompare(a.paymentDate);
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.payment.createdAt || b.payment.date).getTime() - new Date(a.payment.createdAt || a.payment.date).getTime();
        });
    }, [loans, collectors, collectionFilterMeta]);

    // Section 2 Calculation: Past Due Collection
    const pastDueCollectionData = useMemo(() => {
        const data: Record<string, { area: string, collector: string, amount: number, startDate: string, endDate: string, dueDateRangeDisplay: string }> = {};
        const { filterStart, filterEnd, dueDateRangeDisplay } = collectionFilterMeta;

        collectionPaymentDetails.forEach(({ collector, area, payment }) => {
            if (!data[collector]) {
                data[collector] = {
                    area,
                    collector,
                    amount: 0,
                    startDate: filterStart,
                    endDate: filterEnd,
                    dueDateRangeDisplay
                };
            }
            data[collector].amount += payment.amount;
        });

        return Object.values(data).sort((a, b) => b.amount - a.amount);
    }, [collectionPaymentDetails, collectionFilterMeta]);

    const selectedCollectorDailyCollections = useMemo<DailyCollectionSummary[]>(() => {
        if (!selectedCollectionCollector) return [];

        const daily: Record<string, DailyCollectionSummary> = {};
        collectionPaymentDetails
            .filter(detail => detail.collector === selectedCollectionCollector)
            .forEach(detail => {
                if (!daily[detail.paymentDate]) {
                    daily[detail.paymentDate] = { date: detail.paymentDate, amount: 0, count: 0, details: [] };
                }
                daily[detail.paymentDate].amount += detail.payment.amount;
                daily[detail.paymentDate].count += 1;
                daily[detail.paymentDate].details.push(detail);
            });

        return Object.values(daily).sort((a, b) => b.date.localeCompare(a.date));
    }, [collectionPaymentDetails, selectedCollectionCollector]);

    const selectedDayDetails = selectedCollectionDay
        ? [...(selectedCollectorDailyCollections.find(day => day.date === selectedCollectionDay)?.details || [])].sort((a, b) => a.loan.borrowerName.localeCompare(b.loan.borrowerName))
        : [];

    const selectedReportedLoans = useMemo(() => {
        if (!selectedReportedCollector) return [];
        const fromStr = `${fromYear}-${fromMonth}`;
        const toStr = `${toYear}-${toMonth}`;

        return loans
            .filter(loan =>
                !isExcludedFromCollectionReports(loan) &&
                loan.monthReported >= fromStr &&
                loan.monthReported <= toStr &&
                getCollectorDisplayName(loan.collector, collectors) === selectedReportedCollector
            )
            .sort((a, b) => b.monthReported.localeCompare(a.monthReported) || b.outstandingBalance - a.outstandingBalance);
    }, [loans, collectors, selectedReportedCollector, fromYear, fromMonth, toYear, toMonth]);

    const closeCollectionModal = () => {
        setSelectedCollectionCollector(null);
        setSelectedCollectionDay(null);
    };

    const years = Array.from({ length: 15 }, (_, i) => (2016 + i).toString());

    return (
        <div className="animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                
                {/* TABS NAVIGATION */}
                <div className="flex px-6 pt-6 pb-0 border-b border-slate-100 dark:border-slate-700/50 gap-4 overflow-x-auto scrollbar-hide bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                        onClick={() => setActiveTab('reported')}
                        className={`py-2.5 px-6 rounded-t-xl text-[14px] font-semibold transition-all whitespace-nowrap -mb-[1px] ${
                            activeTab === 'reported' 
                            ? 'bg-[#064e3b] text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700/50'
                        }`}
                    >
                        Reported Past Due
                    </button>
                    <button
                        onClick={() => setActiveTab('efficiency')}
                        className={`py-2.5 px-6 rounded-t-xl text-[14px] font-semibold transition-all whitespace-nowrap -mb-[1px] ${
                            activeTab === 'efficiency' 
                            ? 'bg-[#064e3b] text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700/50'
                        }`}
                    >
                        Past Due Collection Efficiency
                    </button>
                </div>

                {/* TAB CONTENT */}
                {/* Section 1: Reported Past Due */}
                {activeTab === 'reported' && (
                    <div className="animate-fadeIn">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 transition-colors duration-300">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Reported Past Due</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">Summary for branch: <span className="text-emerald-600 dark:text-emerald-400 font-black">{selectedBranch}</span></p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-end gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                            {/* From Filter */}
                            <div className="flex items-center gap-2 px-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap transition-colors duration-300">From</label>
                                <select
                                    value={fromMonth}
                                    onChange={(e) => setFromMonth(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <select
                                    value={fromYear}
                                    onChange={(e) => setFromYear(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            
                            {/* To Filter */}
                            <div className="flex items-center gap-2 px-2 border-l border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap transition-colors duration-300">To</label>
                                <select
                                    value={toMonth}
                                    onChange={(e) => setToMonth(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <select
                                    value={toYear}
                                    onChange={(e) => setToYear(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        {validationError && (
                            <div className="text-[10px] font-bold text-red-500 dark:text-red-400 text-right bg-red-50 dark:bg-red-900/30 rounded-xl px-3 py-1.5 border border-red-100 dark:border-red-800/50 animate-fadeIn transition-colors duration-300">
                                ⚠ {validationError}
                            </div>
                        )}
                    </div>
                </div>
                {!validationError && reportedPastDueData.length > 0 ? (
                    <div className="mt-6 flex flex-col lg:flex-row gap-6 items-start">
                        {/* Table Side (Takes roughly 60%) */}
                        <div className="w-full lg:w-[60%] flex-shrink-0">
                            <div className="overflow-x-auto overflow-y-auto max-h-[450px] border border-slate-200 dark:border-slate-700/80 rounded-[16px] shadow-sm bg-white dark:bg-slate-900/50">
                                <table className="w-full text-left relative min-w-[500px]">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black tracking-widest transition-colors duration-300 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                        <tr>
                                            <th className="px-6 py-5">Area</th>
                                            <th className="px-6 py-5">Collector Identity</th>
                                            <th className="px-6 py-5 text-center">Period</th>
                                            <th className="px-6 py-5 text-right">Total Reported</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-300 bg-white dark:bg-transparent">
                                        {reportedPastDueData.map((d, i) => (
                                            <tr
                                                key={i}
                                                onClick={() => setSelectedReportedCollector(d.collector)}
                                                className="group hover:bg-[#F5F7F6] dark:hover:bg-slate-800/50 transition-all duration-300 cursor-pointer"
                                                title={`Open reported past due details for ${d.collector}`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-[13px] text-slate-400 dark:text-slate-500 uppercase tracking-tight transition-colors duration-300">{d.area}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-[13px] text-slate-700 dark:text-slate-300 uppercase tracking-tight transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-bold">{d.collector}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider whitespace-nowrap transition-colors duration-300 border border-slate-100 dark:border-slate-700/50">
                                                        {months.find(m => m.value === fromMonth)?.label} {fromYear} - {months.find(m => m.value === toMonth)?.label} {toYear}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-[15px] transition-colors duration-300">₱{d.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {reportedPastDueData.length > 0 && (
                                            <tr className="bg-emerald-50/50 dark:bg-emerald-900/20 border-t-2 border-emerald-100 dark:border-emerald-800/50">
                                                <td colSpan={3} className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Grand Total</td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-700 dark:text-emerald-400 text-[16px]">₱{reportedPastDueData.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Chart Side (Takes roughly 40%) */}
                        <div className="w-full lg:w-[40%] flex-shrink-0 h-[450px] bg-[#F9FAFB] dark:bg-slate-900/80 rounded-[16px] border border-slate-200 dark:border-slate-700/80 shadow-sm p-6 flex flex-col overflow-hidden relative">
                            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-slate-700/50 pb-3">Performance Visualization</h3>
                            <div className="flex-1 w-full relative min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reportedPastDueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#145A45" stopOpacity={1}/>
                                                <stop offset="95%" stopColor="#0F3D2E" stopOpacity={1}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis 
                                            dataKey="collector" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} 
                                            dy={15}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} 
                                            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} 
                                            dx={-5}
                                        />
                                        <Tooltip 
                                            formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Reported']}
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                                            labelStyle={{ color: '#475569', fontWeight: 900, marginBottom: '6px' }}
                                        />
                                        <Bar 
                                            dataKey="amount" 
                                            fill="url(#colorAmount)" 
                                            activeBar={{ fill: '#145A45' }}
                                            radius={[6, 6, 0, 0]} 
                                            maxBarSize={35} 
                                            animationDuration={1500}
                                            animationEasing="ease-out"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto mt-6">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                                <tr>
                                    <th className="px-8 py-5">Area</th>
                                    <th className="px-8 py-5">Collector Identity</th>
                                    <th className="px-8 py-5 text-center">Period</th>
                                    <th className="px-8 py-5 text-right">Total Reported (Target)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors duration-300">
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-red-400 dark:text-red-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">
                                        {validationError || 'No records found for the selected period.'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

                {/* Section 2: Past Due Collection */}
                {activeTab === 'efficiency' && (
                    <div className="animate-fadeIn">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 transition-colors duration-300">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Past Due Collection Efficiency</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">Payments within 45 days of due date</p>
                    </div>
                    <div className="flex flex-col xl:flex-row gap-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                            <div className="hidden xl:block px-2">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors duration-300 whitespace-nowrap">Collection Interval</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 xl:border-l border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">From</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 border-l border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">To</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                            <div className="hidden xl:block px-2">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors duration-300 whitespace-nowrap">Due Date Range</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 xl:border-l border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">From</label>
                                <input
                                    type="date"
                                    value={dueStartDate}
                                    onChange={(e) => setDueStartDate(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 border-l border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">To</label>
                                <input
                                    type="date"
                                    value={dueEndDate}
                                    onChange={(e) => setDueEndDate(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-300"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex flex-col lg:flex-row gap-6 items-start">
                    {/* Table Side (Takes roughly 60%) */}
                    <div className="w-full lg:w-[60%] flex-shrink-0">
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-[16px] shadow-sm bg-white dark:bg-slate-900/50">
                            <table className="w-full text-left relative min-w-[600px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black tracking-widest transition-colors duration-300 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <tr>
                                        <th className="px-6 py-5">Area</th>
                                        <th className="px-6 py-5">Collector Identity</th>
                                        <th className="px-6 py-5 text-center">Due Date Range</th>
                                        <th className="px-6 py-5 text-center">Collection Interval</th>
                                        <th className="px-6 py-5 text-right">Amount Collected</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-300 bg-white dark:bg-transparent">
                                    {pastDueCollectionData.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">No collection data found for the selected period in this branch.</td>
                                        </tr>
                                    ) : pastDueCollectionData.map((d, i) => (
                                        <tr
                                            key={i}
                                            onClick={() => {
                                                setSelectedCollectionCollector(d.collector);
                                                setSelectedCollectionDay(null);
                                            }}
                                            className="group hover:bg-[#F5F7F6] dark:hover:bg-slate-800/50 transition-all duration-300 cursor-pointer"
                                            title={`Open daily collection for ${d.collector}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-[13px] text-slate-400 dark:text-slate-500 uppercase tracking-tight transition-colors duration-300">{d.area}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-[13px] text-slate-700 dark:text-slate-300 uppercase tracking-tight transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-bold">{d.collector}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 transition-colors duration-300">
                                                <span className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider whitespace-nowrap transition-colors duration-300 border border-slate-100 dark:border-slate-700/50">
                                                    {d.dueDateRangeDisplay}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 transition-colors duration-300">
                                                <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border border-emerald-100 dark:border-emerald-800/50 transition-colors duration-300">
                                                    {formatDateLabel(d.startDate, { month: 'short', day: 'numeric' })} - {formatDateLabel(d.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-[15px] transition-colors duration-300">₱{d.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {pastDueCollectionData.length > 0 && (
                                        <tr className="bg-emerald-50/50 dark:bg-emerald-900/20 border-t-2 border-emerald-100 dark:border-emerald-800/50">
                                            <td colSpan={4} className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Grand Total</td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-700 dark:text-emerald-400 text-[16px]">₱{pastDueCollectionData.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Chart Side (Takes roughly 40%) */}
                    {pastDueCollectionData.length > 0 && (
                        <div className="w-full lg:w-[40%] flex-shrink-0 h-[450px] bg-[#F9FAFB] dark:bg-slate-900/80 rounded-[16px] border border-slate-200 dark:border-slate-700/80 shadow-sm p-6 flex flex-col overflow-hidden relative">
                            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-slate-700/50 pb-3">Collection Visualization</h3>
                            <div className="flex-1 w-full relative min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={pastDueCollectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorEfficiencyAmount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#145A45" stopOpacity={1}/>
                                                <stop offset="95%" stopColor="#0F3D2E" stopOpacity={1}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis 
                                            dataKey="collector" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} 
                                            dy={15}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} 
                                            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} 
                                            dx={-5}
                                        />
                                        <Tooltip 
                                            formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Amount Collected']}
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                                            labelStyle={{ color: '#475569', fontWeight: 900, marginBottom: '6px' }}
                                        />
                                        <Bar 
                                            dataKey="amount" 
                                            fill="url(#colorEfficiencyAmount)" 
                                            activeBar={{ fill: '#145A45' }}
                                            radius={[6, 6, 0, 0]} 
                                            maxBarSize={35} 
                                            animationDuration={1500}
                                            animationEasing="ease-out"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
                    </div>
                )}
            </div>
            {selectedReportedCollector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">Reported Past Due Details</p>
                                <h3 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{selectedReportedCollector}</h3>
                                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {months.find(m => m.value === fromMonth)?.label} {fromYear} - {months.find(m => m.value === toMonth)?.label} {toYear}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedReportedCollector(null)}
                                className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                title="Close reported past due details"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="min-h-0 overflow-y-auto p-5">
                            <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 dark:border-emerald-900/70 dark:bg-emerald-900/20">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70 dark:text-emerald-300/70">Total Reported</p>
                                    <p className="mt-1 text-sm font-bold text-emerald-900 dark:text-emerald-100">{selectedReportedLoans.length} account{selectedReportedLoans.length === 1 ? '' : 's'}</p>
                                </div>
                                <p className="text-xl font-black text-emerald-800 dark:text-emerald-200">
                                    ₱{selectedReportedLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0).toLocaleString()}
                                </p>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full min-w-[780px] text-left text-sm">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3">Client</th>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Reported Month</th>
                                            <th className="px-4 py-3">Due Date</th>
                                            <th className="px-4 py-3 text-right">Reported Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                        {selectedReportedLoans.map(loan => (
                                            <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                <td className="px-4 py-3">
                                                    <p className="font-black uppercase text-slate-900 dark:text-white">{loan.borrowerName}</p>
                                                    <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{loan.barangay}, {loan.city}</p>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{loan.code}</td>
                                                <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{formatDateLabel(`${loan.monthReported}-01`, { month: 'long', year: 'numeric' })}</td>
                                                <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{formatDateLabel((loan.dueDate || '').substring(0, 10))}</td>
                                                <td className="px-4 py-3 text-right font-black text-emerald-700 dark:text-emerald-300">₱{loan.outstandingBalance.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {selectedCollectionCollector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">Daily Collection Report</p>
                                <h3 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{selectedCollectionCollector}</h3>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                                    <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        Collection: {formatDateLabel(collectionFilterMeta.filterStart, { month: 'short', day: 'numeric' })} - {formatDateLabel(collectionFilterMeta.filterEnd)}
                                    </span>
                                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                        Due: {collectionFilterMeta.dueDateRangeDisplay}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={closeCollectionModal}
                                className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                title="Close daily collection report"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[0.9fr_1.4fr]">
                            <div className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Daily Totals</p>
                                        <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">Click a day to view client payments</p>
                                    </div>
                                    <span className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300">
                                        ₱{selectedCollectorDailyCollections.reduce((sum, day) => sum + day.amount, 0).toLocaleString()}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {selectedCollectorDailyCollections.map(day => (
                                        <button
                                            key={day.date}
                                            onClick={() => setSelectedCollectionDay(day.date)}
                                            className={`w-full rounded-xl border p-4 text-left transition-all ${
                                                selectedCollectionDay === day.date
                                                    ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20'
                                                    : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-black uppercase text-slate-900 dark:text-white">{formatDateLabel(day.date)}</p>
                                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{day.count} payment{day.count === 1 ? '' : 's'}</p>
                                                </div>
                                                <p className="text-base font-black text-emerald-700 dark:text-emerald-300">₱{day.amount.toLocaleString()}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="min-h-0 overflow-y-auto p-5">
                                {!selectedCollectionDay ? (
                                    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950/30">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Select Collection Day</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Daily client/payment details will appear here.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Collection Details</p>
                                                <h4 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{formatDateLabel(selectedCollectionDay)}</h4>
                                                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    {selectedDayDetails.length} client payment{selectedDayDetails.length === 1 ? '' : 's'} matching selected collection interval and due date range
                                                </p>
                                            </div>
                                            <span className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                ₱{selectedDayDetails.reduce((sum, detail) => sum + detail.payment.amount, 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <table className="w-full min-w-[760px] text-left text-sm">
                                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-3">Client</th>
                                                        <th className="px-4 py-3">Code</th>
                                                        <th className="px-4 py-3">Due Date</th>
                                                        <th className="px-4 py-3">OR / Ref</th>
                                                        <th className="px-4 py-3 text-right">Amount</th>
                                                        <th className="px-4 py-3">Recorder</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                                    {selectedDayDetails.map(({ loan, payment }) => (
                                                        <tr key={`${loan.id}-${payment.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                            <td className="px-4 py-3">
                                                                <p className="font-black uppercase text-slate-900 dark:text-white">{loan.borrowerName}</p>
                                                                <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{loan.barangay}, {loan.city}</p>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{loan.code}</td>
                                                            <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{formatDateLabel((loan.dueDate || '').substring(0, 10))}</td>
                                                            <td className="px-4 py-3 font-black text-emerald-700 dark:text-emerald-300">{payment.orNumber}</td>
                                                            <td className="px-4 py-3 text-right font-black text-emerald-700 dark:text-emerald-300">₱{payment.amount.toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">{payment.recorder}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyPerformance;
