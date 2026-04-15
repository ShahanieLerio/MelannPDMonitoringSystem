
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, Payment, Branch } from '../types.ts';

interface MonthlyPerformanceProps {
    selectedBranch: Branch;
}

const MonthlyPerformance: React.FC<MonthlyPerformanceProps> = ({ selectedBranch }) => {
    const [loans, setLoans] = useState(store.getLoans(selectedBranch));

    useEffect(() => {
        setLoans(store.getLoans(selectedBranch));
        // Subscribe to store updates for real-time sync
        const unsubscribe = store.subscribe(() => {
            setLoans(store.getLoans(selectedBranch));
        });
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

        const data: Record<string, { collector: string, amount: number }> = {};
        const fromStr = `${fromYear}-${fromMonth}`;
        const toStr = `${toYear}-${toMonth}`;

        loans.forEach(loan => {
            if (loan.monthReported >= fromStr && loan.monthReported <= toStr) {
                const key = loan.collector;
                if (!data[key]) {
                    data[key] = { collector: loan.collector, amount: 0 };
                }
                data[key].amount += loan.outstandingBalance;
            }
        });

        return Object.values(data).sort((a, b) => b.amount - a.amount);
    }, [loans, fromYear, fromMonth, toYear, toMonth, validationError]);

    // Section 2 Calculation: Past Due Collection
    const pastDueCollectionData = useMemo(() => {
        const data: Record<string, { collector: string, amount: number, startDate: string, endDate: string }> = {};

        // Force startDate and endDate into YYYY-MM-DD format strictly for comparison
        const filterStart = startDate.substring(0, 10);
        const filterEnd = endDate.substring(0, 10);

        loans.forEach(loan => {
            loan.payments.forEach(payment => {
                if (payment.status && payment.status === 'REVERSED') return;

                // Safely extract YYYY-MM-DD from the payment date, even if it's an ISO string Date/Time
                const paymentDateStr = (payment.date || '').substring(0, 10);
                if (!paymentDateStr) return;

                const isWithinFilterRange = paymentDateStr >= filterStart && paymentDateStr <= filterEnd;

                if (isWithinFilterRange) {
                    if (!data[loan.collector]) {
                        data[loan.collector] = { collector: loan.collector, amount: 0, startDate: filterStart, endDate: filterEnd };
                    }
                    data[loan.collector].amount += payment.amount;
                }
            });
        });

        return Object.values(data).sort((a, b) => b.amount - a.amount);
    }, [loans, startDate, endDate]);

    const years = Array.from({ length: 15 }, (_, i) => (2016 + i).toString());

    return (
        <div className="space-y-12 animate-fadeIn">
            {/* Section 1: Reported Past Due */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
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
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                            <tr>
                                <th className="px-8 py-5">Collector Identity</th>
                                <th className="px-8 py-5 text-center">Period</th>
                                <th className="px-8 py-5 text-right">Total Reported (Target)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors duration-300">
                            {validationError ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-red-400 dark:text-red-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">Filter Error: Invalid Date Range.</td>
                                </tr>
                            ) : reportedPastDueData.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">No records found for the selected period.</td>
                                </tr>
                            ) : reportedPastDueData.map((d, i) => (
                                <tr key={i} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300 font-medium cursor-pointer">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-black group-hover:underline decoration-emerald-500/30 underline-offset-4">{d.collector}</div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest whitespace-nowrap transition-colors duration-300">
                                            {months.find(m => m.value === fromMonth)?.label} {fromYear} - {months.find(m => m.value === toMonth)?.label} {toYear}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg transition-colors duration-300">₱{d.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Section 2: Past Due Collection */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Past Due Collection Efficiency</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">Payments within 45 days of due date</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                        <div className="flex items-center gap-2 px-2">
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
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest transition-colors duration-300">
                            <tr>
                                <th className="px-8 py-5">Collector Identity</th>
                                <th className="px-8 py-4 text-center">Collection Interval</th>
                                <th className="px-8 py-4 text-right">Settled Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors duration-300">
                            {pastDueCollectionData.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px] transition-colors duration-300">No collection data found for the selected period in this branch.</td>
                                </tr>
                            ) : pastDueCollectionData.map((d, i) => (
                                <tr key={i} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300 font-medium cursor-pointer">
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-black group-hover:underline decoration-emerald-500/30 underline-offset-4">{d.collector}</div>
                                    </td>
                                    <td className="px-8 py-5 text-center text-slate-600 dark:text-slate-400 transition-colors duration-300">
                                        <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 transition-colors duration-300">
                                            {new Date(d.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} - {new Date(d.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg transition-colors duration-300">₱{d.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MonthlyPerformance;
