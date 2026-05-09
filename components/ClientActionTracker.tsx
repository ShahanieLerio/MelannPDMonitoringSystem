import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { User, Branch, Loan, MovingStatus, LocationStatus, DemandLetterStatus, DemandLetterType } from '../types.ts';
import ClientModal from './ClientModal.tsx';
import RemarksModal from './RemarksModal.tsx';

// Helper to get days diff
const getDifferenceInDays = (date1: Date, date2: Date) => {
    const diffTime = Math.abs(date1.getTime() - date2.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

interface ClientActionTrackerProps {
    currentUser: User;
    selectedBranch: Branch;
}

enum LifecycleStage {
    RESOLVED = 'Resolved',
    WRITE_OFF = 'For Write-Off',
    LEGAL = 'For Legal Action',
    DEMAND_LETTER = 'For Demand Letter',
    NON_COOPERATIVE = 'Non-Cooperative',
    FOLLOW_UP = 'Needs Follow-Up',
    ACTIVE = 'Active / Cooperative',
    UNCLASSIFIED = 'Unclassified'
}

const STAGE_COLORS: Record<LifecycleStage, string> = {
    [LifecycleStage.RESOLVED]: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
    [LifecycleStage.WRITE_OFF]: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
    [LifecycleStage.LEGAL]: 'bg-red-900 text-red-100 border-red-950 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900',
    [LifecycleStage.DEMAND_LETTER]: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    [LifecycleStage.NON_COOPERATIVE]: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    [LifecycleStage.FOLLOW_UP]: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    [LifecycleStage.ACTIVE]: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    [LifecycleStage.UNCLASSIFIED]: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
};

const ClientActionTracker: React.FC<ClientActionTrackerProps> = ({ currentUser, selectedBranch }) => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [demandLetters, setDemandLetters] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStage, setFilterStage] = useState<LifecycleStage | 'All'>('All');
    const [filterCollector, setFilterCollector] = useState<string>('All');
    const [selectedLoanId, setSelectedLoanId] = useState<string>('');

    // Modals
    const [selectedLoanForProfile, setSelectedLoanForProfile] = useState<Loan | null>(null);
    const [selectedLoanForRemarks, setSelectedLoanForRemarks] = useState<Loan | null>(null);

    // Override Modal
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [overrideLoan, setOverrideLoan] = useState<any | null>(null);
    const [overrideStage, setOverrideStage] = useState<string>('');
    const [overrideNote, setOverrideNote] = useState<string>('');

    const refreshData = () => {
        setLoans(store.getLoans(selectedBranch));
        setDemandLetters(store.getDemandLetters(selectedBranch));
    };

    useEffect(() => {
        refreshData();
        const unsubscribe = store.subscribe(refreshData);
        return () => unsubscribe();
    }, [selectedBranch]);

    const calculateStageAndAction = (loan: Loan): { stage: LifecycleStage, action: string, daysPastDue: number, daysSinceLastPayment: number } => {
        const today = new Date();
        const dueDate = new Date(loan.dueDate);
        const daysPastDue = isNaN(dueDate.getTime()) ? 0 : getDifferenceInDays(today, dueDate);

        let lastPaymentDate: Date | null = null;
        if (loan.payments && loan.payments.length > 0) {
            const sortedPayments = [...loan.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            lastPaymentDate = new Date(sortedPayments[0].date);
        }
        const daysSinceLastPayment = lastPaymentDate ? getDifferenceInDays(today, lastPaymentDate) : daysPastDue;

        const latestDL = demandLetters.filter(dl => dl.loanId === loan.id).sort((a, b) => new Date(b.dateSent || b.dateCreated).getTime() - new Date(a.dateSent || a.dateCreated).getTime())[0];

        // 1. Resolved
        if (loan.runningBalance <= 0 || loan.status === MovingStatus.PAID) {
            return { stage: LifecycleStage.RESOLVED, action: 'No action needed. Fully paid.', daysPastDue, daysSinceLastPayment };
        }

        // 2. For Write-Off
        if (loan.location === LocationStatus.NOT_LOCATED && daysSinceLastPayment >= 180) {
            return { stage: LifecycleStage.WRITE_OFF, action: 'Recommend write-off. Not located, no activity for 180+ days.', daysPastDue, daysSinceLastPayment };
        }

        // 3. For Legal Action
        if (latestDL && (latestDL.type === DemandLetterType.THIRD || latestDL.type === DemandLetterType.LITIGATION)) {
            const daysSinceDL = latestDL.dateSent ? getDifferenceInDays(today, new Date(latestDL.dateSent)) : getDifferenceInDays(today, new Date(latestDL.dateCreated));
            if (daysSinceDL >= 14 && loan.status !== MovingStatus.MOVING) {
                return { stage: LifecycleStage.LEGAL, action: `Escalate to legal. 3rd/Litigation DL sent ${daysSinceDL} days ago.`, daysPastDue, daysSinceLastPayment };
            }
        }

        // 4. For Demand Letter
        if ((loan.status === MovingStatus.NM || loan.status === MovingStatus.NMSR) && daysSinceLastPayment >= 90) {
            if (!latestDL) {
                return { stage: LifecycleStage.DEMAND_LETTER, action: `File 1st Demand Letter. No response/payment in ${daysSinceLastPayment} days.`, daysPastDue, daysSinceLastPayment };
            }
        }

        // 5. Non-Cooperative
        if ((loan.status === MovingStatus.NM || loan.status === MovingStatus.NMSR) && daysSinceLastPayment >= 60) {
            return { stage: LifecycleStage.NON_COOPERATIVE, action: 'Schedule field visit. Consider 1st Demand Letter.', daysPastDue, daysSinceLastPayment };
        }

        // 6. Needs Follow-Up
        if (loan.promiseToPayDate || loan.followUpDate || daysSinceLastPayment >= 30) {
            let actionText = 'Follow up immediately.';
            if (loan.promiseToPayDate) {
                const ptpDays = Math.floor((today.getTime() - new Date(loan.promiseToPayDate).getTime()) / (1000 * 60 * 60 * 24));
                if (ptpDays > 0) actionText = `Follow up on PTP (overdue by ${ptpDays} days).`;
                else actionText = `Next PTP on ${loan.promiseToPayDate}.`;
            } else if (loan.followUpDate) {
                actionText = `Follow up scheduled for ${loan.followUpDate}.`;
            } else {
                actionText = `No payment in ${daysSinceLastPayment} days. Follow up required.`;
            }
            return { stage: LifecycleStage.FOLLOW_UP, action: actionText, daysPastDue, daysSinceLastPayment };
        }

        // 7. Active / Cooperative
        if (loan.status === MovingStatus.MOVING && daysSinceLastPayment < 30) {
            return { stage: LifecycleStage.ACTIVE, action: 'Continue monitoring.', daysPastDue, daysSinceLastPayment };
        }

        return { stage: LifecycleStage.UNCLASSIFIED, action: 'Review account history.', daysPastDue, daysSinceLastPayment };
    };

    const analyzedLoans = useMemo(() => {
        return loans.map(loan => {
            const analysis = calculateStageAndAction(loan);
            
            // Apply Manual Overrides
            const finalStage = loan.actionStage && Object.values(LifecycleStage).includes(loan.actionStage as LifecycleStage) 
                ? (loan.actionStage as LifecycleStage) 
                : analysis.stage;
                
            const finalAction = loan.actionNote || analysis.action;
            const isOverridden = !!(loan.actionStage || loan.actionNote);

            return {
                ...loan,
                ...analysis,
                finalStage,
                finalAction,
                isOverridden
            };
        });
    }, [loans, demandLetters]);

    const filteredLoans = useMemo(() => {
        return analyzedLoans.filter(loan => {
            const matchesSearch = loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) || loan.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStage = filterStage === 'All' || loan.finalStage === filterStage;
            const matchesCollector = filterCollector === 'All' || loan.collector === filterCollector;
            return matchesSearch && matchesStage && matchesCollector;
        }).sort((a, b) => b.runningBalance - a.runningBalance);
    }, [analyzedLoans, searchTerm, filterStage, filterCollector]);

    const selectedRow = useMemo(() => {
        return filteredLoans.find(loan => loan.id === selectedLoanId) || filteredLoans[0] || null;
    }, [filteredLoans, selectedLoanId]);

    const combinedHistory = useMemo(() => {
        if (!selectedRow) return [];
        const items: { date: Date, type: string, user: string, desc: string }[] = [];
        
        // Add remarks
        selectedRow.remarks?.forEach(r => {
           items.push({ date: new Date(r.timestamp), type: 'Remark', user: r.collector, desc: r.text });
        });
        
        // Add history
        selectedRow.history?.forEach(h => {
            const desc = (h.description || '').toLowerCase();
            const typeStr = (h.type || '').toLowerCase();
            const isExcluded = 
                desc.includes('payment recorded') || typeStr.includes('payment recorded') ||
                desc.includes('payment reverse') || typeStr.includes('payment reverse') ||
                desc.includes('payment received') || typeStr.includes('payment received') ||
                desc.includes('address impart') || typeStr.includes('address impart') ||
                desc.includes('address import') || typeStr.includes('address import');

            if (!isExcluded) {
                items.push({ date: new Date(h.timestamp), type: h.type, user: h.user, desc: h.description });
            }
        });

        // Add Demand Letters
        const clientDLs = demandLetters.filter(dl => dl.loanId === selectedRow.id);
        clientDLs.forEach(dl => {
            items.push({ date: new Date(dl.dateSent || dl.dateCreated), type: 'Demand Letter', user: dl.preparedBy || 'System', desc: `${dl.type} generated` });
        });

        // Sort descending
        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [selectedRow, demandLetters]);

    const stageCounts = useMemo(() => {
        const counts = Object.values(LifecycleStage).reduce((acc, stage) => {
            acc[stage] = { count: 0, amount: 0 };
            return acc;
        }, {} as Record<LifecycleStage, { count: number, amount: number }>);

        analyzedLoans.forEach(loan => {
            if (counts[loan.finalStage]) {
                counts[loan.finalStage].count += 1;
                counts[loan.finalStage].amount += loan.runningBalance;
            }
        });
        return counts;
    }, [analyzedLoans]);

    const uniqueCollectors = useMemo(() => {
        const cols = new Set(loans.map(l => l.collector));
        return Array.from(cols).sort();
    }, [loans]);

    const handleExportCSV = () => {
        const headers = ['Client Code', 'Borrower Name', 'Collector', 'Running Balance', 'Days Since Last Payment', 'Lifecycle Stage', 'Recommended Action', 'Manual Override Note'];
        const csvRows = filteredLoans.map(l => [
            l.code,
            l.borrowerName,
            l.collector,
            l.runningBalance.toFixed(2),
            l.daysSinceLastPayment,
            l.finalStage,
            l.finalAction,
            l.actionNote || ''
        ]);

        const csvContent = [headers, ...csvRows]
            .map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Client_Action_Tracker_${selectedBranch}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveOverride = async () => {
        if (!overrideLoan) return;
        try {
            const updatedLoan = { 
                ...overrideLoan, 
                actionStage: overrideStage || null, 
                actionNote: overrideNote || null 
            };
            await store.updateLoan(overrideLoan.id, updatedLoan, currentUser.username, currentUser.role);
            refreshData();
            setIsOverrideModalOpen(false);
            setOverrideLoan(null);
            setOverrideStage('');
            setOverrideNote('');
        } catch (err) {
            console.error('Failed to save override:', err);
            alert('Failed to save override. Please check console for details.');
        }
    };

    const openOverrideModal = (loan: any) => {
        setOverrideLoan(loan);
        setOverrideStage(loan.actionStage || loan.finalStage);
        setOverrideNote(loan.actionNote || '');
        setIsOverrideModalOpen(true);
    };

    const currency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const StageCard = ({ stage, title, icon, accent }: { stage: LifecycleStage, title: string, icon: string, accent: string }) => {
        const data = stageCounts[stage];
        const isSelected = filterStage === stage;
        return (
            <div 
                onClick={() => setFilterStage(isSelected ? 'All' : stage)}
                className={`rounded-2xl bg-slate-50 dark:bg-slate-900/60 border ${isSelected ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500' : 'border-slate-100 dark:border-slate-700'} p-3 cursor-pointer transition-all hover:scale-[1.02]`}
            >
                <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-3 shadow-sm`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon}></path></svg>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{data.count}</p>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 leading-tight">{title}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-10 px-4 sm:px-8 mt-6">
            {/* Header Area */}
            <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-400" />
                <div className="p-6 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Client Action Tracker</h2>
                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em] mt-1">{selectedBranch}</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                            Lifecycle classification and decision support tool to determine the next best step for past-due clients.
                        </p>
                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-sm w-max">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export List to CSV
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:w-[700px] gap-3">
                        <StageCard stage={LifecycleStage.ACTIVE} title="Active" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" accent="from-emerald-500 to-green-600" />
                        <StageCard stage={LifecycleStage.FOLLOW_UP} title="Follow-Up" icon="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" accent="from-amber-400 to-orange-500" />
                        <StageCard stage={LifecycleStage.NON_COOPERATIVE} title="Non-Coop" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" accent="from-orange-500 to-red-500" />
                        <StageCard stage={LifecycleStage.DEMAND_LETTER} title="For DL" icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" accent="from-rose-500 to-pink-600" />
                        <StageCard stage={LifecycleStage.LEGAL} title="For Legal" icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" accent="from-red-700 to-rose-900" />
                        <StageCard stage={LifecycleStage.WRITE_OFF} title="Write-Off" icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" accent="from-slate-500 to-zinc-700" />
                        <StageCard stage={LifecycleStage.RESOLVED} title="Resolved" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" accent="from-teal-500 to-emerald-600" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_450px] gap-6 items-start">
                <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_180px] gap-3">
                        <div className="relative">
                            <svg className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search client, code, collector, or area..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <select
                            value={filterStage}
                            onChange={e => setFilterStage(e.target.value as LifecycleStage | 'All')}
                            className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                        >
                            <option value="All">All Stages</option>
                            {Object.values(LifecycleStage).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            value={filterCollector}
                            onChange={e => setFilterCollector(e.target.value)}
                            className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
                        >
                            <option value="All">All Collectors</option>
                            {uniqueCollectors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="max-h-[calc(100vh-360px)] min-h-[420px] overflow-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.18em] shadow-[0_1px_0_rgba(148,163,184,0.35),0_8px_18px_-18px_rgba(15,23,42,0.8)]">
                                <tr>
                                    <th className="px-5 py-4">Client</th>
                                    <th className="px-5 py-4">Exposure</th>
                                    <th className="px-5 py-4">Lifecycle Stage</th>
                                    <th className="px-5 py-4">Recommended Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-16 text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em]">No clients match the current filters.</td>
                                    </tr>
                                ) : filteredLoans.map(loan => (
                                    <tr
                                        key={loan.id}
                                        onClick={() => setSelectedLoanId(loan.id)}
                                        className={`cursor-pointer transition-colors ${selectedRow?.id === loan.id ? 'bg-indigo-50/80 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/35'}`}
                                    >
                                        <td className="px-5 py-4 min-w-[220px]">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-sm font-black">
                                                    {loan.borrowerName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{loan.borrowerName}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{loan.code} | {loan.collector || 'Unassigned'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <p className="text-sm font-black text-slate-900 dark:text-white">{currency(loan.runningBalance)}</p>
                                            <p className="text-[10px] font-bold text-slate-400">
                                                {loan.daysPastDue > 0 ? `${loan.daysPastDue} days past due` : 'Current'}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4 min-w-[190px]">
                                            <span className={`inline-flex px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${STAGE_COLORS[loan.finalStage]} ${loan.isOverridden ? 'ring-2 ring-blue-400 border-blue-400 border-dashed' : ''}`}>
                                                {loan.finalStage}
                                            </span>
                                            {loan.isOverridden && <span className="block text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">Manual Override</span>}
                                        </td>
                                        <td className="px-5 py-4 min-w-[260px]">
                                            <p className={`text-xs font-bold line-clamp-2 ${loan.isOverridden ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {loan.finalAction}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <aside className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden 2xl:sticky 2xl:top-24">
                    {selectedRow ? (
                        <>
                            <div className="p-6 bg-slate-950 text-white relative overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400" />
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mb-2">Client Overview</p>
                                        <h3 className="text-2xl font-black leading-tight">{selectedRow.borrowerName}</h3>
                                        <p className="text-xs font-bold text-slate-400 mt-2">{selectedRow.code} | {selectedRow.fullAddress || selectedRow.city}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openOverrideModal(selectedRow)} className="p-2 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl transition-colors" title="Manual Override">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => setSelectedLoanForRemarks(selectedRow)} className="p-2 bg-slate-800 hover:bg-emerald-600 text-white rounded-xl transition-colors" title="Add Remark">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                        </button>
                                        <button onClick={() => setSelectedLoanForProfile(selectedRow)} className="p-2 bg-slate-800 hover:bg-sky-600 text-white rounded-xl transition-colors" title="View Profile">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Last Payment & Status Bar */}
                                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-indigo-900/30 pt-4">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Status</p>
                                        <p className="text-sm font-bold text-white">{selectedRow.status}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Last Payment</p>
                                        <p className="text-sm font-bold text-white">
                                            {selectedRow.payments && selectedRow.payments.length > 0 
                                                ? new Date([...selectedRow.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date).toLocaleDateString() 
                                                : 'No payments'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 mb-4 px-2">Activity Timeline</p>
                                
                                <div className="max-h-[calc(100vh-360px)] min-h-[300px] overflow-y-auto px-2 space-y-4">
                                    {combinedHistory.length > 0 ? combinedHistory.map((item, idx) => (
                                        <div key={idx} className="relative pl-6">
                                            <div className="absolute w-2 h-2 rounded-full bg-indigo-500 left-[3px] top-[6px] ring-4 ring-indigo-50 dark:ring-slate-800 z-10" />
                                            {idx < combinedHistory.length - 1 && (
                                                <div className="absolute w-0.5 bg-slate-100 dark:bg-slate-700 left-[6px] top-[14px] bottom-[-24px]" />
                                            )}
                                            
                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-colors">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                                        {item.type}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                                                    {item.desc}
                                                </p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    By {item.user}
                                                </p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10 px-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">No recorded history</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-10 min-h-[400px]">
                            <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            </div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Select a client<br/>to view history</p>
                        </div>
                    )}
                </aside>
            </div>

            {/* Overrides Modal */}
            {isOverrideModalOpen && overrideLoan && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[70]">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-md p-7 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Manual Override</h3>
                            <button onClick={() => setIsOverrideModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
                            Set a custom lifecycle stage or specific action note for <strong className="text-slate-700 dark:text-slate-300">{overrideLoan.borrowerName}</strong>.
                        </p>
                        
                        <div className="space-y-5">
                            <label className="block">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lifecycle Stage</span>
                                <select 
                                    value={overrideStage} 
                                    onChange={(e) => setOverrideStage(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">-- Use Auto-Calculated Stage --</option>
                                    {Object.values(LifecycleStage).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action Note (Optional)</span>
                                <textarea 
                                    value={overrideNote} 
                                    onChange={(e) => setOverrideNote(e.target.value)}
                                    placeholder="e.g. Owner is abroad, wait until June"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                                    rows={3}
                                />
                            </label>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setIsOverrideModalOpen(false)} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                            <button onClick={handleSaveOverride} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-colors">Save Override</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedLoanForProfile && (
                <ClientModal
                    loan={selectedLoanForProfile}
                    onClose={() => setSelectedLoanForProfile(null)}
                    currentUser={currentUser}
                />
            )}

            {selectedLoanForRemarks && (
                <RemarksModal
                    loan={selectedLoanForRemarks}
                    onClose={() => setSelectedLoanForRemarks(null)}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default ClientActionTracker;
