import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { DemandLetter, DemandLetterType, DemandLetterStatus, PriorityLevel, Branch, User } from '../types.ts';
import { formatMMDDYYYY } from '../constants.tsx';
import { getCollectorDisplayName } from '../services/collectorUtils.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import SuccessModal from './SuccessModal.tsx';

interface DemandLetterComponentProps {
    currentUser: User;
    selectedBranch: Branch;
}

const DemandLetterComponent: React.FC<DemandLetterComponentProps> = ({ currentUser, selectedBranch }) => {
    const [demandLetters, setDemandLetters] = useState(store.getDemandLetters(selectedBranch));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCollector, setFilterCollector] = useState('');
    const [filterType, setFilterType] = useState<DemandLetterType | 'For Legal Action'>(DemandLetterType.FIRST);
    const [filterStatus, setFilterStatus] = useState('');

    const [sortColumn, setSortColumn] = useState<string>('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDL, setEditingDL] = useState<DemandLetter | null>(null);
    const [visitingDL, setVisitingDL] = useState<any | null>(null);
    const [receivingDL, setReceivingDL] = useState<any | null>(null);
    const [initialData, setInitialData] = useState<Partial<DemandLetter> | undefined>(undefined);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

    const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'warning') => {
        setConfirmConfig({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                closeConfirm();
            },
            type
        });
    };

    const refreshData = () => {
        setDemandLetters(store.getDemandLetters(selectedBranch));
    };

    useEffect(() => {
        refreshData();
        const unsubscribe = store.subscribe(refreshData);
        return () => unsubscribe();
    }, [selectedBranch]);

    const loans = store.getLoans(selectedBranch);
    const collectorDirectory = store.getCollectors(Branch.ALL);
    const collectors = Array.from(new Set(
        loans.map(l => getCollectorDisplayName(l.collector, collectorDirectory))
    )).sort();

    const augmentedDLs = useMemo(() => {
        return demandLetters.map(dl => {
            const loan = loans.find(l => l.id === dl.loanId);
            const now = new Date();
            const datePrepared = new Date(dl.datePrepared);
            const daysSince3rdDemand = Math.floor((now.getTime() - datePrepared.getTime()) / (1000 * 3600 * 24));
            
            let hasPaymentAfter3rd = false;
            let lastActivityDate = datePrepared;

            if (loan) {
                const payments = loan.payments || [];
                const validPayments = payments.filter(p => p.status === 'GOOD');
                for (const p of validPayments) {
                    const pDate = new Date(p.date);
                    if (pDate > datePrepared) {
                        hasPaymentAfter3rd = true;
                    }
                    if (pDate > lastActivityDate) {
                        lastActivityDate = pDate;
                    }
                }

                const remarks = loan.remarks || [];
                for (const r of remarks) {
                    const rDate = new Date(r.timestamp);
                    if (rDate > lastActivityDate) {
                        lastActivityDate = rDate;
                    }
                }
            }

            const daysSinceLastAction = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 3600 * 24));

            let autoEscalationStatus: string | null = null;
            if (dl.type === DemandLetterType.THIRD && !hasPaymentAfter3rd && daysSince3rdDemand >= 7) {
                if (daysSince3rdDemand >= 14) {
                    autoEscalationStatus = 'Ready for Legal Action';
                } else {
                    autoEscalationStatus = 'For Legal Review';
                }
            }

            return {
                ...dl,
                loan,
                daysSince3rdDemand,
                hasPaymentAfter3rd,
                lastActivityDate,
                daysSinceLastAction,
                autoEscalationStatus
            };
        });
    }, [demandLetters, loans]);

    const filteredDLs = useMemo(() => {
        return augmentedDLs.filter(dl => {
            const matchSearch = dl.borrowerName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCollector = filterCollector === '' || getCollectorDisplayName(dl.collectorName, collectorDirectory) === filterCollector;
            
            let matchType = false;
            if (filterType === 'For Legal Action') {
                matchType = dl.type === DemandLetterType.THIRD && !dl.hasPaymentAfter3rd && dl.daysSince3rdDemand >= 7;
            } else {
                matchType = dl.type === filterType;
            }

            const activeStatus = dl.autoEscalationStatus || dl.status;
            const matchStatus = filterStatus === '' || activeStatus === filterStatus;
            
            return matchSearch && matchCollector && matchType && matchStatus;
        });
    }, [augmentedDLs, searchTerm, filterCollector, filterType, filterStatus, collectorDirectory]);

    const sortedDLs = useMemo(() => {
        if (!sortColumn) return filteredDLs;
        return [...filteredDLs].sort((a, b) => {
            let valA: string | undefined = undefined;
            let valB: string | undefined = undefined;

            if (sortColumn === 'datePrepared') {
                valA = a.datePrepared;
                valB = b.datePrepared;
            } else if (sortColumn === 'dateReceived') {
                valA = a.dateReceived;
                valB = b.dateReceived;
            } else if (sortColumn === 'followUpDate') {
                valA = a.followUpDate;
                valB = b.followUpDate;
            }

            if (!valA && !valB) return 0;
            if (!valA) return sortDirection === 'asc' ? 1 : -1;
            if (!valB) return sortDirection === 'asc' ? -1 : 1;

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDLs, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn !== column) return (
            <svg className="w-3 h-3 ml-1 text-slate-300 dark:text-slate-600 inline-block opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
        );
        return sortDirection === 'asc' ? (
            <svg className="w-3 h-3 ml-1 text-slate-500 dark:text-slate-400 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
        ) : (
            <svg className="w-3 h-3 ml-1 text-slate-500 dark:text-slate-400 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        );
    };

    const handleOpenAddModal = () => {
        setEditingDL(null);
        setInitialData(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (dl: DemandLetter) => {
        setEditingDL(dl);
    };

    const handleReceive = (dl: any) => {
        setReceivingDL(dl);
    };

    const handleSettle = (dl: DemandLetter) => {
        askConfirm(
            "Settle Demand Letter",
            `Are you sure you want to mark the demand letter for ${dl.borrowerName} as settled?`,
            () => {
                store.updateDemandLetter(dl.id, { 
                    status: DemandLetterStatus.SETTLED,
                    remarks: dl.remarks ? `${dl.remarks} - Settled immediately upon demand` : 'Settled immediately upon demand'
                }, currentUser.username, currentUser.role);
                setSuccessMessage("Demand letter successfully marked as settled.");
                refreshData();
            },
            'info'
        );
    };

    const handleProceedToSecond = (dl: DemandLetter) => {
        setEditingDL(null);
        setInitialData({
            collectorName: dl.collectorName,
            loanId: dl.loanId,
            borrowerName: dl.borrowerName,
            type: DemandLetterType.SECOND,
            datePrepared: new Date().toISOString().split('T')[0],
            status: DemandLetterStatus.PENDING,
            remarks: dl.remarks,
            followUpDate: dl.followUpDate,
            branch: dl.branch
        });
        setIsModalOpen(true);
    };

    const handleProceedToThird = (dl: DemandLetter) => {
        setEditingDL(null);
        setInitialData({
            collectorName: dl.collectorName,
            loanId: dl.loanId,
            borrowerName: dl.borrowerName,
            type: DemandLetterType.THIRD,
            datePrepared: new Date().toISOString().split('T')[0],
            status: DemandLetterStatus.PENDING,
            remarks: dl.remarks,
            followUpDate: dl.followUpDate,
            branch: dl.branch
        });
        setIsModalOpen(true);
    };

    const handleAssignFieldVisit = (dl: any) => {
        setVisitingDL(dl);
    };

    return (
        <div className="space-y-8 animate-fadeIn transition-colors duration-300 bg-[#f8fafc] dark:bg-slate-900 p-6 md:p-8 rounded-[2rem]">
            <div className="flex justify-between items-center transition-colors duration-300">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors duration-300">Legal Demand Letters</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 transition-colors duration-300">
                        Tracking for: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedBranch}</span>
                    </p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-[#064e3b] hover:bg-[#043326] text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm transition-all duration-300 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    New Legal Action
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="relative flex-1 w-full">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">Search Profile</label>
                        <svg className="w-4 h-4 text-slate-400 absolute left-4 top-[2.2rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input
                            type="text"
                            placeholder="Enter account holder name..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-[#064e3b] focus:border-[#064e3b] text-sm font-medium text-slate-800 dark:text-white transition-colors duration-300 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-56">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">Collector</label>
                        <select className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 py-2.5 px-4 rounded-lg font-medium appearance-none cursor-pointer text-slate-800 dark:text-slate-300 transition-colors duration-300 outline-none" value={filterCollector} onChange={e => setFilterCollector(e.target.value)}>
                            <option value="">All Personnel</option>
                            {collectors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="w-full md:w-56">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">Case Status</label>
                        <select className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 py-2.5 px-4 rounded-lg font-medium appearance-none cursor-pointer text-slate-800 dark:text-slate-300 transition-colors duration-300 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            {Object.values(DemandLetterStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button className="w-full md:w-auto bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-8 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200">
                        Apply
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                <div className="flex px-6 pt-6 pb-0 border-b border-slate-100 dark:border-slate-700/50 gap-4 overflow-x-auto scrollbar-hide">
                    {[...Object.values(DemandLetterType), 'For Legal Action'].map((type) => {
                        const tabLabel = type === 'For Legal Action' ? 'Litigation' : type === DemandLetterType.THIRD ? 'Final Notice' : type;
                        return (
                            <button
                                key={type}
                                onClick={() => setFilterType(type as any)}
                                className={`py-2.5 px-6 rounded-t-xl text-[14px] font-semibold transition-all whitespace-nowrap -mb-[1px] ${
                                    filterType === type 
                                    ? 'bg-[#064e3b] text-white shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                {tabLabel}
                            </button>
                        );
                    })}
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 px-2 pb-2">
                    <table className="w-full text-sm text-left border-collapse table-auto">
                        <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-colors duration-300 border-b-2 border-slate-200 dark:border-slate-600 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
                            <tr>
                                <th className="px-5 py-4">Collector</th>
                                <th className="px-5 py-4">Borrower Identity</th>
                                <th className="px-5 py-4 cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('datePrepared')}>
                                    Prepared <SortIcon column="datePrepared" />
                                </th>
                                <th className="px-5 py-4 cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('dateReceived')}>
                                    Received <SortIcon column="dateReceived" />
                                </th>
                                <th className="px-5 py-4 cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => handleSort('followUpDate')}>
                                    Follow-up <SortIcon column="followUpDate" />
                                </th>
                                <th className="px-5 py-4">Remarks</th>
                                <th className="px-5 py-4 text-center">Status</th>
                                <th className="px-5 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 transition-colors duration-300">
                            {sortedDLs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-slate-400 dark:text-slate-500 italic font-medium uppercase tracking-[0.2em] text-[10px]">No legal records found in this branch.</td>
                                </tr>
                            ) : sortedDLs.map((dl) => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                const tomorrowTemp = new Date();
                                tomorrowTemp.setDate(tomorrowTemp.getDate() + 1);
                                const tomorrowStr = tomorrowTemp.toISOString().split('T')[0];

                                const isOverdue = dl.followUpDate && dl.followUpDate <= todayStr && dl.status !== DemandLetterStatus.SETTLED && dl.status !== DemandLetterStatus.COMPLETED;
                                const isTomorrow = dl.followUpDate && dl.followUpDate === tomorrowStr && dl.status !== DemandLetterStatus.SETTLED && dl.status !== DemandLetterStatus.COMPLETED;
                                const isThirdDL = dl.type === DemandLetterType.THIRD;
                                const isSettled = dl.status === DemandLetterStatus.SETTLED;

                                const clientDLs = augmentedDLs.filter(d => d.loanId === dl.loanId && d.status !== DemandLetterStatus.SETTLED);
                                const hasLitigation = clientDLs.some(d => d.type === DemandLetterType.THIRD && d.autoEscalationStatus !== null);
                                const hasFinalNotice = clientDLs.some(d => d.type === DemandLetterType.THIRD && d.autoEscalationStatus === null);
                                const hasSecondDemand = clientDLs.some(d => d.type === DemandLetterType.SECOND);

                                const hasThird = hasLitigation || hasFinalNotice;
                                const hasSecond = hasSecondDemand;

                                let overrideStatusText: string | null = null;
                                let overrideStatusColor: string | null = null;

                                if (dl.status !== DemandLetterStatus.SETTLED && filterType !== 'For Legal Action') {
                                    if (dl.type === DemandLetterType.FIRST) {
                                        if (hasLitigation) {
                                            overrideStatusText = "For Litigation";
                                            overrideStatusColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                                        } else if (hasFinalNotice) {
                                            overrideStatusText = "Final Notice on Process";
                                            overrideStatusColor = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
                                        } else if (hasSecondDemand) {
                                            overrideStatusText = "2nd Demand on Process";
                                            overrideStatusColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
                                        }
                                    } else if (dl.type === DemandLetterType.SECOND) {
                                        if (hasLitigation) {
                                            overrideStatusText = "For Litigation";
                                            overrideStatusColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                                        } else if (hasFinalNotice) {
                                            overrideStatusText = "Final Notice on Process";
                                            overrideStatusColor = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
                                        }
                                    } else if (dl.type === DemandLetterType.THIRD) {
                                        if (hasLitigation && dl.autoEscalationStatus === null) {
                                            overrideStatusText = "For Litigation";
                                            overrideStatusColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                                        }
                                    }
                                }

                                const priority = isSettled ? PriorityLevel.LOWEST :
                                    (isOverdue || isThirdDL ? PriorityLevel.TOP : PriorityLevel.FOLLOW_UP);

                                return (
                                    <tr key={dl.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/80 transition-all duration-200">
                                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium text-sm transition-colors duration-300 truncate max-w-[100px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                    {dl.collectorName.substring(0,2).toUpperCase()}
                                                </div>
                                                <span className="truncate">{dl.collectorName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200 text-sm transition-all duration-300 truncate max-w-[150px]">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex-none w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                                                    {dl.borrowerName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="truncate">{dl.borrowerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-medium text-sm transition-colors duration-300">
                                            {dl.datePrepared ? new Date(dl.datePrepared).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-medium text-sm transition-colors duration-300">
                                            {dl.dateReceived ? new Date(dl.dateReceived).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : <span className="text-slate-400 italic">Pending</span>}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-medium text-sm transition-colors duration-300">
                                            {dl.followUpDate ? new Date(dl.followUpDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="px-5 py-4 max-w-[120px]">
                                            <div className="group/tooltip relative">
                                                <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate cursor-help transition-colors duration-300">
                                                    {dl.remarks ? dl.remarks : <span className="text-slate-300 dark:text-slate-600 italic">No remarks</span>}
                                                </p>
                                                {dl.remarks && (
                                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-slate-800 dark:bg-slate-700 text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-normal break-words">
                                                        {dl.remarks}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="group/statustooltip relative inline-block">
                                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                                                    overrideStatusColor ? overrideStatusColor :
                                                    dl.autoEscalationStatus === 'Ready for Legal Action' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    dl.autoEscalationStatus === 'For Legal Review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    dl.status === DemandLetterStatus.SETTLED ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                                                    isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    isTomorrow ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    dl.status === DemandLetterStatus.FOLLOW_UP ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    }`}>
                                                    {overrideStatusText ? overrideStatusText : (
                                                        dl.autoEscalationStatus || 
                                                        (dl.status === DemandLetterStatus.SETTLED ? dl.status :
                                                         isOverdue ? 'Urgent Action Required' :
                                                         isTomorrow ? 'Upcoming Follow-up' :
                                                         (dl.status === DemandLetterStatus.FOLLOW_UP ? 'Follow-up' : dl.status))
                                                    )}
                                                </span>
                                                {overrideStatusText && (
                                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-slate-800 dark:bg-slate-700 text-white text-[11px] rounded-lg shadow-xl opacity-0 group-hover/statustooltip:opacity-100 transition-opacity pointer-events-none whitespace-normal break-words">
                                                        Client already progressed to {overrideStatusText.replace(' on Process', '')}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {dl.type === DemandLetterType.FIRST && (
                                                    hasThird ? (
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 whitespace-nowrap opacity-75 cursor-not-allowed">
                                                            Ongoing 3rd
                                                        </span>
                                                    ) : hasSecond ? (
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 whitespace-nowrap opacity-75 cursor-not-allowed">
                                                            Ongoing 2nd
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleProceedToSecond(dl)}
                                                            title="Proceed to 2nd Demand Letter"
                                                            className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-sm border border-emerald-200 dark:border-emerald-800 whitespace-nowrap"
                                                        >
                                                            To 2nd
                                                        </button>
                                                    )
                                                )}
                                                {dl.type === DemandLetterType.SECOND && (
                                                    hasThird ? (
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 whitespace-nowrap opacity-75 cursor-not-allowed">
                                                            Ongoing 3rd
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleProceedToThird(dl)}
                                                            title="Proceed to 3rd Demand Letter"
                                                            className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-sm border border-indigo-200 dark:border-indigo-800 whitespace-nowrap"
                                                        >
                                                            To 3rd
                                                        </button>
                                                    )
                                                )}
                                                {dl.type === DemandLetterType.THIRD && (
                                                    <button
                                                        onClick={() => handleAssignFieldVisit(dl)}
                                                        title="Assign Field Visit"
                                                        className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/40 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-400 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-sm border border-orange-200 dark:border-orange-800 whitespace-nowrap"
                                                    >
                                                        Visit
                                                    </button>
                                                )}
                                                {/* ✅ Settle Button */}
                                                {!isSettled && (
                                                    <button
                                                        onClick={() => handleSettle(dl)}
                                                        title="Mark as Settled"
                                                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-slate-700/50 rounded-lg transition-all active:scale-90"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                    </button>
                                                )}
                                                {/* 📩 Received Button */}
                                                <button
                                                    onClick={() => handleReceive(dl)}
                                                    title="Mark as Received & Add Remarks"
                                                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded-lg transition-all active:scale-90"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                                </button>
                                                {/* ✏️ Edit Date Prepared Button */}
                                                <button
                                                    onClick={() => handleEdit(dl)}
                                                    title="Edit Date Prepared"
                                                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700/50 rounded-lg transition-all active:scale-90"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <DemandLetterModal
                    dl={editingDL}
                    initialData={initialData}
                    currentUser={currentUser}
                    selectedBranch={selectedBranch}
                    onClose={() => { setIsModalOpen(false); refreshData(); setInitialData(undefined); }}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                />
            )}
            <SuccessModal
                isOpen={!!successMessage}
                title="Success"
                message={successMessage || ''}
                onConfirm={() => setSuccessMessage(null)}
            />
            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={closeConfirm}
                type={confirmConfig.type}
            />
            {visitingDL && (
                <FieldVisitModal 
                    dl={visitingDL}
                    currentUser={currentUser}
                    onClose={() => { setVisitingDL(null); refreshData(); }}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                />
            )}
            {editingDL && (
                <EditDatePreparedModal
                    dl={editingDL}
                    currentUser={currentUser}
                    onClose={() => { setEditingDL(null); refreshData(); }}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                />
            )}
            {receivingDL && (
                <ReceivedDemandLetterModal
                    dl={receivingDL}
                    currentUser={currentUser}
                    onClose={() => { setReceivingDL(null); refreshData(); }}
                    onSuccess={(msg) => setSuccessMessage(msg)}
                />
            )}
        </div>
    );
};



interface FieldVisitModalProps {
    dl: any;
    currentUser: User;
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

const FieldVisitModal: React.FC<FieldVisitModalProps> = ({ dl, currentUser, onClose, onSuccess }) => {
    const [visitData, setVisitData] = useState({
        visitDate: new Date().toISOString().split('T')[0],
        assignedCollector: dl.collectorName,
        result: '',
        remarks: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let priority = PriorityLevel.FOLLOW_UP;
        if (visitData.result === 'Promise to Pay') priority = PriorityLevel.TOP;
        if (visitData.result === 'Refused') priority = PriorityLevel.NEED_ATTENTION;

        const remarkText = `[Field Visit] ${visitData.result} - ${visitData.remarks}`;
        
        await store.addRemark(dl.loanId, remarkText, dl.collectorName, priority, currentUser.username, currentUser.role);
        store.updateDemandLetter(dl.id, { remarks: remarkText }, currentUser.username, currentUser.role);
        
        if (onSuccess) onSuccess("Field visit successfully logged.");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700 transition-colors duration-300">
                <div className="p-8 border-b border-orange-50 dark:border-orange-900/50 flex justify-between items-center bg-[#ea580c] dark:bg-slate-800 text-white transition-colors duration-300">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">Log Field Visit</h3>
                        <p className="text-orange-100/60 dark:text-orange-400/60 font-bold text-xs uppercase tracking-widest mt-1 transition-colors duration-300">Client: {dl.borrowerName}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Visit Date</label>
                        <input
                            type="date"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 font-bold text-slate-800 dark:text-white outline-none transition-colors duration-300"
                            value={visitData.visitDate}
                            onChange={e => setVisitData({ ...visitData, visitDate: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Visit Result</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 font-black text-slate-800 dark:text-white appearance-none outline-none transition-colors duration-300"
                            value={visitData.result}
                            onChange={e => setVisitData({ ...visitData, result: e.target.value })}
                            required
                        >
                            <option value="" disabled>Select Result...</option>
                            <option value="Promise to Pay">Promise to Pay</option>
                            <option value="Refused">Refused</option>
                            <option value="No Show / Not Found">No Show / Not Found</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1 transition-colors duration-300">Detailed Remarks</label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl px-6 py-5 focus:ring-2 focus:ring-orange-500 font-medium text-slate-700 dark:text-slate-300 h-32 outline-none resize-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            placeholder="Condition of premises, discussions held..."
                            value={visitData.remarks}
                            onChange={e => setVisitData({ ...visitData, remarks: e.target.value })}
                            required
                        ></textarea>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all uppercase tracking-widest text-[10px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-black shadow-md shadow-orange-900/20 dark:shadow-orange-900/40 transition-all hover:-translate-y-0.5 hover:shadow-xl uppercase tracking-widest text-[10px]"
                        >
                            Save Log
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface DemandLetterModalProps {
    dl?: DemandLetter | null;
    initialData?: Partial<DemandLetter>;
    currentUser: User;
    selectedBranch: Branch;
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

const DemandLetterModal: React.FC<DemandLetterModalProps> = ({ dl, initialData, currentUser, selectedBranch, onClose, onSuccess }) => {
    const loans = store.getLoans(selectedBranch);
    const [formData, setFormData] = useState<Partial<DemandLetter>>(dl || initialData || {
        collectorName: '',
        loanId: '',
        borrowerName: '',
        type: DemandLetterType.FIRST,
        datePrepared: new Date().toISOString().split('T')[0],
        status: DemandLetterStatus.PENDING,
        remarks: '',
        branch: selectedBranch !== 'All Branches' ? selectedBranch : undefined as any
    });

    const [penaltyData, setPenaltyData] = useState<{ penalty: number, newBalance: number, history: any[] } | null>(null);

    // Auto-compute follow-up date based on date received and legal stage
    useEffect(() => {
        if (formData.dateReceived) {
            const received = new Date(formData.dateReceived + 'T00:00:00');
            if (formData.type === DemandLetterType.FIRST || formData.type === DemandLetterType.SECOND) {
                received.setDate(received.getDate() + 10);
            } else if (formData.type === DemandLetterType.THIRD) {
                received.setDate(received.getDate() + 5);
            }
            const y = received.getFullYear();
            const m = String(received.getMonth() + 1).padStart(2, '0');
            const day = String(received.getDate()).padStart(2, '0');
            const computedFollowUp = `${y}-${m}-${day}`;
            if (formData.followUpDate !== computedFollowUp) {
                setFormData(prev => ({ ...prev, followUpDate: computedFollowUp }));
            }
        } else if (formData.followUpDate) {
            // Need to wrap in prev check to avoid warnings if no change
            setFormData(prev => prev.followUpDate ? { ...prev, followUpDate: undefined } : prev);
        }
    }, [formData.dateReceived, formData.type]);

    // Penalty Calculation Logic
    useEffect(() => {
        if (!formData.loanId) {
            setPenaltyData(null);
            return;
        }

        const loan = loans.find(l => l.id === formData.loanId);
        if (!loan || !loan.dueDate) return;

        const dueDate = new Date(loan.dueDate);
        const now = new Date();

        // If today is before due date, no penalty
        if (now <= dueDate) {
            setPenaltyData({ penalty: 0, newBalance: loan.runningBalance });
            return;
        }

        const sortedPayments = [...(loan.payments || [])]
            .filter(p => p.status === 'GOOD')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 1. Base reference: balance on due date
        let currentBal = loan.outstandingBalance;
        const paymentsBeforeOrOnDue = sortedPayments.filter(p => new Date(p.date) <= dueDate);
        for (const p of paymentsBeforeOrOnDue) {
            currentBal -= p.amount;
        }
        if (currentBal <= 0) {
            setPenaltyData({ penalty: 0, newBalance: 0 });
            return;
        }

        // 2. Loop month-by-month
        let loopDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1); 
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let totalPenaltyCalculated = 0;
        const history: any[] = [];

        while (loopDate <= currentMonthStart) {
            const year = loopDate.getFullYear();
            const month = loopDate.getMonth();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthStr = `${monthNames[month]} ${year}`;

            let monthPayments = 0;
            if (year === dueDate.getFullYear() && month === dueDate.getMonth()) {
                // First month: payments AFTER due date up to end of calendar month
                monthPayments = sortedPayments.filter(p => {
                    const d = new Date(p.date);
                    return d > dueDate && d.getFullYear() === year && d.getMonth() === month;
                }).reduce((sum, p) => sum + p.amount, 0);
            } else {
                // Subsequent months: all payments in the month
                monthPayments = sortedPayments.filter(p => {
                    const d = new Date(p.date);
                    return d.getFullYear() === year && d.getMonth() === month;
                }).reduce((sum, p) => sum + p.amount, 0);
            }

            const beginningBalance = currentBal;
            currentBal -= monthPayments;
            if (currentBal < 0) currentBal = 0;

            let penalty = 0;
            if (currentBal > 0) {
                penalty = currentBal * 0.05;
                totalPenaltyCalculated += penalty;
                currentBal += penalty;
            }

            history.push({
                month: monthStr,
                beginningBalance: beginningBalance,
                paymentsMade: monthPayments,
                penaltyRate: '5%',
                penaltyAmount: penalty,
                endingBalance: currentBal
            });

            // Advance one month
            loopDate.setMonth(loopDate.getMonth() + 1);
        }

        setPenaltyData({
            penalty: totalPenaltyCalculated,
            newBalance: currentBal,
            history
        });

    }, [formData.loanId, loans]);

    const handlePrintPenalty = () => {
        if (!penaltyData || !formData.loanId) return;
        const loan = loans.find(l => l.id === formData.loanId);
        if (!loan) return;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const tableRows = penaltyData.history.map((step: any) => `
            <tr>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; border-left: none;">${step.month}</td>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right;">₱${step.beginningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; color: #166534;">${step.paymentsMade > 0 ? '-₱' + step.paymentsMade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: center;">${step.penaltyRate}</td>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; color: #9f1239;">₱${step.penaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 4px 8px; border: 1px solid #e2e8f0; border-right: none; text-align: right; font-weight: bold;">₱${step.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Penalty Computation - ${loan.borrowerName}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 100%; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #064e3b; padding-bottom: 5px; }
                    .header h1 { margin: 0 0 2px 0; color: #064e3b; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
                    .header p { margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                    .info-section { margin-bottom: 10px; display: flex; justify-content: space-between; gap: 20px; }
                    .info-box { flex: 1; }
                    .info-box p { margin: 2px 0; font-size: 12px; display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px; }
                    .info-box strong { color: #475569; }
                    h2 { color: #0f172a; font-size: 14px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; border: 1px solid #e2e8f0; border-left: none; border-right: none; }
                    th { background: #f8fafc; color: #475569; padding: 4px 8px; border: 1px solid #cbd5e1; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; text-align: left; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
                    th:first-child { border-left: none; width: 22%; }
                    th:last-child { border-right: none; }
                    th:nth-child(n+2) { text-align: right; }
                    th:nth-child(4) { text-align: center; width: 10%; }
                    tbody tr:nth-child(even) { background: #f8fafc; }
                    .summary { margin-top: 15px; text-align: right; padding: 10px; background: #fffbe8; border: 1px solid #fef08a; border-radius: 4px; }
                    .summary p { margin: 2px 0; font-size: 12px; color: #475569; }
                    .summary h3 { margin: 5px 0 0 0; color: #9f1239; font-size: 16px; }
                    .summary span { font-weight: normal; font-size: 11px; color: #64748b; margin-right: 10px; }
                    
                    @page { margin: 10mm; size: A4 portrait; }
                    
                    @media print {
                        body { padding: 0; margin: 0; font-size: 11px; }
                        table { font-size: 10px; }
                        td, th { padding: 3px 6px; }
                        .summary { border: 1px solid #ccc; background: transparent; padding: 5px; margin-top: 10px; }
                        th { background: #f1f5f9 !important; }
                        .info-section { margin-bottom: 5px; }
                        h2 { margin-bottom: 2px; margin-top: 10px; }
                        .header { margin-bottom: 5px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Penalty Computation</h1>
                    <p>Demand Letter Attachment Reference</p>
                </div>
                
                <div class="info-section">
                    <div class="info-box">
                        <p><strong>Client Name:</strong> <span>${loan.borrowerName}</span></p>
                        <p><strong>Client Address:</strong> <span>${loan.fullAddress || (loan.barangay + ', ' + loan.city)}</span></p>
                        <p><strong>Account / Code:</strong> <span>${loan.code}</span></p>
                    </div>
                    <div class="info-box">
                        <p><strong>Current Balance:</strong> <span>₱${loan.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                        <p><strong>Due Date:</strong> <span>${formatMMDDYYYY(loan.dueDate)}</span></p>
                        <p><strong>Date Prepared:</strong> <span>${formData.datePrepared}</span></p>
                    </div>
                </div>

                <h2>Detailed Computation Breakdown</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Beginning Balance</th>
                            <th>Payments Made</th>
                            <th>Penalty Rate</th>
                            <th>Penalty Amount</th>
                            <th>Ending Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <div class="summary">
                    <p>Total Penalty Accumulated: <strong>₱${penaltyData.penalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                    <h3><span>Updated Total Balance:</span> ₱${penaltyData.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
            </body>
            </html>
        `;

        if (iframe.contentDocument) {
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            
            iframe.onload = () => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            };
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.loanId || !formData.collectorName) return;
        
        const submitData = { ...formData };
        if (!submitData.branch) {
            const loan = loans.find(l => l.id === submitData.loanId);
            if (loan) submitData.branch = loan.branch;
        }

        if (dl) {
            store.updateDemandLetter(dl.id, submitData, currentUser.username, currentUser.role);
            if (onSuccess) onSuccess("Successfully updated legal action.");
        } else {
            store.addDemandLetter(submitData as any, currentUser.username, currentUser.role);
            if (onSuccess) {
                if (submitData.type === DemandLetterType.SECOND) onSuccess("Successfully created 2nd Demand Letter");
                else if (submitData.type === DemandLetterType.THIRD) onSuccess("Successfully created 3rd Demand Letter");
                else onSuccess("Successfully created Demand Letter");
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700 transition-colors duration-300">
                <div className="p-10 border-b border-emerald-50 dark:border-emerald-900/50 flex justify-between items-center bg-[#064e3b] dark:bg-slate-800 text-white transition-colors duration-300">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">
                            {dl ? 'Update Legal Action' : (
                                initialData?.type === DemandLetterType.THIRD ? 'Create 3rd Demand Letter' :
                                initialData?.type === DemandLetterType.SECOND ? 'Create 2nd Demand Letter' : 'New Demand Letter'
                            )}
                        </h3>
                        <p className="text-emerald-100/60 dark:text-emerald-400/60 font-bold text-xs uppercase tracking-widest mt-1 transition-colors duration-300">Branch Context: {selectedBranch}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Select Client Profile</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 font-black text-slate-800 dark:text-white appearance-none transition-all outline-none"
                                value={formData.loanId}
                                onChange={e => {
                                    const loan = loans.find(l => l.id === e.target.value);
                                    setFormData({ ...formData, loanId: e.target.value, borrowerName: loan ? loan.borrowerName : '', collectorName: loan ? getCollectorDisplayName(loan.collector, store.getCollectors(Branch.ALL)) : '', branch: loan?.branch || formData.branch });
                                }}
                                required
                                disabled={!!dl}
                            >
                                <option value="">Lookup client by code or name...</option>
                                {loans.map(l => (
                                    <option key={l.id} value={l.id}>[{l.code}] {l.borrowerName}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Assigned Collector</label>
                            <input
                                type="text"
                                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-500 dark:text-slate-400 font-bold cursor-not-allowed outline-none transition-colors duration-300"
                                value={formData.collectorName}
                                readOnly
                                placeholder="Auto-populated"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Legal Stage</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 font-black text-slate-800 dark:text-white appearance-none outline-none transition-colors duration-300"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as DemandLetterType })}
                                required
                            >
                                {Object.values(DemandLetterType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Case Status</label>
                            <input
                                type="text"
                                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-500 dark:text-slate-400 font-bold cursor-not-allowed outline-none transition-colors duration-300"
                                value={formData.status}
                                readOnly
                                disabled
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Date Prepared</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 dark:text-white outline-none transition-colors duration-300"
                                value={formData.datePrepared}
                                onChange={e => setFormData({ ...formData, datePrepared: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 transition-colors duration-300">Date Received</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 dark:text-white outline-none transition-all focus:bg-white dark:focus:bg-slate-900"
                                value={formData.dateReceived || ''}
                                onChange={e => setFormData({ ...formData, dateReceived: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1 flex items-center gap-2 transition-colors duration-300">
                                Follow-Up Date
                                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-tight transition-colors duration-300">Auto</span>
                            </label>
                            <input
                                type="date"
                                className="w-full bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-400 dark:text-slate-500 font-black cursor-not-allowed outline-none transition-colors duration-300"
                                value={formData.followUpDate || ''}
                                readOnly
                                disabled
                            />
                        </div>

                        {/* Penalty Calculation Engine Display */}
                        {penaltyData && (
                            <div className="md:col-span-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 p-6 rounded-3xl space-y-4 shadow-inner transition-colors duration-300">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-rose-800 dark:text-rose-400 font-black text-lg tracking-tight flex items-center gap-2 transition-colors duration-300">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Penalty Calculation
                                        </h4>
                                        <p className="text-rose-600/80 dark:text-rose-400/80 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 transition-colors duration-300">Auto-computed (5% Monthly Compounding)</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handlePrintPenalty}
                                        className="bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-slate-700 border border-rose-200 dark:border-rose-700 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-2 active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                        Print Penalty Computation
                                    </button>
                                </div>
                                <div className="bg-white/80 dark:bg-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 border border-rose-100/60 dark:border-slate-700 shadow-sm transition-colors duration-300">
                                    <div className="w-full md:w-auto text-left">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest transition-colors duration-300">Base Reference</p>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-300 mt-1 transition-colors duration-300">
                                            Current Balance: <span className="font-mono text-base ml-1 text-slate-900 dark:text-white transition-colors duration-300">₱{(loans.find(l => l.id === formData.loanId)?.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </p>
                                    </div>
                                    <div className="w-full md:w-auto justify-end flex gap-6 md:gap-8 border-t md:border-t-0 md:border-l border-rose-200/50 dark:border-slate-700 pt-4 md:pt-0 md:pl-8 transition-colors duration-300">
                                        <div>
                                            <p className="text-[10px] text-rose-500 dark:text-rose-400 font-black uppercase tracking-widest mb-1 transition-colors duration-300">Calculated Penalty</p>
                                            <p className="text-xl font-mono font-black text-rose-700 dark:text-rose-400 transition-colors duration-300">₱{penaltyData.penalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest mb-1 transition-colors duration-300">Total w/ Penalty</p>
                                            <p className="text-2xl font-mono font-black text-rose-900 dark:text-rose-300 transition-colors duration-300">₱{penaltyData.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1 transition-colors duration-300">Case Remarks / Promise to Pay</label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl px-6 py-5 focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 dark:text-slate-300 h-32 outline-none resize-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            placeholder="Detailed notes on field interaction, legal status, or borrower promises..."
                            value={formData.remarks}
                            onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-5 text-slate-400 dark:text-slate-500 font-black rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest text-[10px] border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] px-8 py-5 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-3xl hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-xl shadow-emerald-900/20 dark:shadow-emerald-900/50 transition-all uppercase tracking-widest text-[10px] active:scale-95"
                        >
                            {dl ? 'Confirm Changes' : 'Record Legal Action'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
//  EditDatePreparedModal – Pen Icon: only Date Prepared editable
// ─────────────────────────────────────────────────────────────────
interface EditDatePreparedModalProps {
    dl: DemandLetter;
    currentUser: User;
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

const EditDatePreparedModal: React.FC<EditDatePreparedModalProps> = ({ dl, currentUser, onClose, onSuccess }) => {
    const [datePrepared, setDatePrepared] = useState(dl.datePrepared || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        store.updateDemandLetter(dl.id, { datePrepared }, currentUser.username, currentUser.role);
        if (onSuccess) onSuccess('Date Prepared updated successfully.');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700">
                {/* Header */}
                <div className="p-8 bg-[#064e3b] dark:bg-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Edit Date Prepared</h3>
                        <p className="text-emerald-300/70 font-bold text-xs uppercase tracking-widest mt-1">{dl.borrowerName}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                {/* Body */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 px-1">Date Prepared</label>
                        <input
                            type="date"
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 dark:text-white outline-none transition-colors"
                            value={datePrepared}
                            onChange={e => setDatePrepared(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-black rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest text-[10px] border border-transparent hover:border-slate-100">Cancel</button>
                        <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-3xl hover:bg-emerald-700 shadow-xl shadow-emerald-900/20 transition-all uppercase tracking-widest text-[10px] active:scale-95 disabled:opacity-50">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
//  ReceivedDemandLetterModal – Full processing: Date + Remarks + PTP + Schedule
// ─────────────────────────────────────────────────────────────────
interface ReceivedDemandLetterModalProps {
    dl: any;
    currentUser: User;
    onClose: () => void;
    onSuccess?: (message: string) => void;
}

const ReceivedDemandLetterModal: React.FC<ReceivedDemandLetterModalProps> = ({ dl, currentUser, onClose, onSuccess }) => {
    const today = new Date().toISOString().split('T')[0];

    const getLocalISODate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Compute auto follow-up (1st/2nd: +10 days, 3rd: +5 days)
    const computeFollowUp = (received: string) => {
        if (!received) return '';
        const d = new Date(received + 'T00:00:00');
        d.setDate(d.getDate() + (dl.type === DemandLetterType.THIRD ? 5 : 10));
        return getLocalISODate(d);
    };

    const [dateReceived, setDateReceived] = useState(dl.dateReceived || today);
    const [followUpDate, setFollowUpDate] = useState(computeFollowUp(dl.dateReceived || today));
    const [remarkText, setRemarkText] = useState(dl.remarks || '');
    const [ptpDate, setPtpDate] = useState('');
    const [schedType, setSchedType] = useState<'monthly' | 'weekly'>('monthly');
    const [recurringEnabled, setRecurringEnabled] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Re-compute follow-up when dateReceived changes
    useEffect(() => {
        setFollowUpDate(computeFollowUp(dateReceived));
    }, [dateReceived]);

    const toggleDay = (day: number) => setSelectedDays(p => p.includes(day) ? p.filter(d => d !== day) : [...p, day].sort((a, b) => a - b));
    const toggleWeekDay = (idx: number) => setSelectedWeekDays(p => p.includes(idx) ? p.filter(d => d !== idx) : [...p, idx].sort((a, b) => a - b));

    const computeNextMonthly = (days: number[]) => {
        const sorted = [...days].sort((a, b) => a - b);
        const today = new Date();
        const todayDay = today.getDate();
        let month = today.getMonth();
        let year = today.getFullYear();
        for (const day of sorted) {
            if (day >= todayDay) {
                const lastDay = new Date(year, month + 1, 0).getDate();
                const d = new Date(year, month, Math.min(day, lastDay));
                return getLocalISODate(d);
            }
        }
        month += 1;
        if (month > 11) { month = 0; year += 1; }
        const lastDay = new Date(year, month + 1, 0).getDate();
        const d = new Date(year, month, Math.min(sorted[0], lastDay));
        return getLocalISODate(d);
    };

    const computeNextWeekly = (wDays: number[]) => {
        const sorted = [...wDays].sort((a, b) => a - b);
        const ref = new Date();
        const cur = ref.getDay();
        for (const d of sorted) {
            if (d >= cur) { ref.setDate(ref.getDate() + (d - cur)); return getLocalISODate(ref); }
        }
        ref.setDate(ref.getDate() + (7 - cur + sorted[0]));
        return getLocalISODate(ref);
    };

    const formatSuffix = (d: number) => {
        if (d >= 11 && d <= 13) return d + 'th';
        switch (d % 10) { case 1: return d + 'st'; case 2: return d + 'nd'; case 3: return d + 'rd'; default: return d + 'th'; }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!remarkText.trim() && !ptpDate && !dateReceived) return;
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            // 1. Update the DL record itself
            const dlUpdate: Partial<DemandLetter> = {
                dateReceived,
                followUpDate: followUpDate || undefined,
                status: DemandLetterStatus.FOLLOW_UP,
                remarks: remarkText.trim()
            };
            store.updateDemandLetter(dl.id, dlUpdate, currentUser.username, currentUser.role);

            // 2. Add remark to the loan (flows to Client Update automatically)
            const fullRemark = `[DL_RECEIVED] ${remarkText.trim()}`;
            if (remarkText.trim() || ptpDate || followUpDate) {
                const { PriorityLevel: PL } = await import('../types.ts');
                const priority = ptpDate ? PL.TOP : PL.FOLLOW_UP;
                await store.addRemark(
                    dl.loanId,
                    remarkText.trim() ? fullRemark : `[DL_RECEIVED] Demand Letter received on ${dateReceived}.`,
                    dl.collectorName,
                    priority,
                    currentUser.username,
                    currentUser.role,
                    ptpDate || null,
                    followUpDate || null
                );
            }

            // 3. Save recurring schedule to the loan if enabled
            const hasMonthly = schedType === 'monthly' && selectedDays.length > 0;
            const hasWeekly = schedType === 'weekly' && selectedWeekDays.length > 0;
            if (recurringEnabled && (hasMonthly || hasWeekly)) {
                const nextDue = hasWeekly ? computeNextWeekly(selectedWeekDays) : computeNextMonthly(selectedDays);
                const schedule = {
                    enabled: true,
                    type: schedType,
                    days: selectedDays,
                    weekDays: selectedWeekDays,
                    nextDueDate: nextDue,
                    lastPaidDate: undefined
                };
                await store.updateLoan(dl.loanId, { recurringSchedule: schedule, promiseToPayDate: nextDue }, currentUser.username, currentUser.role);
            }

            if (onSuccess) onSuccess('Demand Letter marked as received. Remarks logged to Client Updates.');
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save. Please check your connection.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-slideUp border border-white/20 dark:border-slate-700">
                {/* Header */}
                <div className="bg-[#1e40af] dark:bg-slate-800 p-8 text-white shrink-0">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-blue-900/50 rounded-xl border border-white/10">Demand Letter Received</span>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight mt-3">{dl.borrowerName}</h3>
                    <p className="text-blue-200/60 font-bold text-xs uppercase tracking-widest mt-1">{dl.type} · {dl.collectorName}</p>
                </div>

                {/* Scrollable Body */}
                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">

                    {/* Date Received */}
                    <div className="group relative bg-[#ECFDF5] border-2 border-[#6EE7B7] p-4 rounded-[12px] shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-200 text-emerald-700 flex items-center justify-center shadow-inner">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">Date Received</p>
                                    <p className="text-[10px] font-medium text-slate-500">When borrower received this letter</p>
                                </div>
                            </div>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-[8px] px-4 py-2 text-xs font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                value={dateReceived}
                                onChange={e => setDateReceived(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Auto Follow-up Date */}
                    <div className="group relative bg-[#EFF6FF] border-2 border-[#93C5FD] p-4 rounded-[12px] shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-200 text-blue-700 flex items-center justify-center shadow-inner">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                                        Follow-up Date
                                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-black">AUTO</span>
                                    </p>
                                    <p className="text-[10px] font-medium text-slate-500">{dl.type === DemandLetterType.THIRD ? '+5 days' : '+10 days'} from receipt</p>
                                </div>
                            </div>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-[8px] px-4 py-2 text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                value={followUpDate}
                                onChange={e => setFollowUpDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Promise to Pay */}
                    <div className="group relative bg-[#FFFBEB] border-2 border-[#FCD34D] p-4 rounded-[12px] shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Promise to Pay (PTP)</p>
                                    <p className="text-[10px] font-medium text-slate-500">Sets borrower commitment date</p>
                                </div>
                            </div>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-[8px] px-4 py-2 text-xs font-black text-amber-900 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                value={ptpDate}
                                onChange={e => setPtpDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Remarks Textarea */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Field Remarks</label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl px-6 py-4 focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 dark:text-slate-300 h-28 outline-none resize-none transition-all placeholder:text-slate-300"
                            placeholder="Notes on borrower response, commitment, or interaction..."
                            value={remarkText}
                            onChange={e => setRemarkText(e.target.value)}
                        />
                    </div>

                    {/* Recurring Schedule */}
                    <div className={`group relative p-4 rounded-[12px] shadow-sm transition-all border-2 ${recurringEnabled ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${recurringEnabled ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                </div>
                                <div>
                                    <p className={`text-sm font-black uppercase tracking-tight ${recurringEnabled ? 'text-violet-900' : 'text-slate-600'}`}>Recurring Schedule</p>
                                    <p className="text-[10px] font-medium text-slate-500">Auto-track repeating payment dates</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRecurringEnabled(!recurringEnabled)}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${recurringEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${recurringEnabled ? 'left-[26px]' : 'left-0.5'}`}></span>
                            </button>
                        </div>

                        {recurringEnabled && (
                            <div className="space-y-4 animate-fadeIn">
                                {/* Mode Segmented Toggle */}
                                <div className="flex bg-slate-200/50 p-1 rounded-xl">
                                    <button type="button" onClick={() => setSchedType('monthly')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${schedType === 'monthly' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
                                    <button type="button" onClick={() => setSchedType('weekly')} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${schedType === 'weekly' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Weekly</button>
                                </div>

                                {schedType === 'monthly' ? (
                                    <>
                                        <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Select days of the month</p>
                                        <div className="grid grid-cols-7 gap-1.5">
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                <button key={day} type="button" onClick={() => toggleDay(day)} className={`w-full aspect-square rounded-lg text-[11px] font-black transition-all duration-200 border ${selectedDays.includes(day) ? 'bg-violet-600 text-white border-violet-700 shadow-sm scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50'}`}>{day}</button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Select days of the week</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((name, idx) => (
                                                <button key={idx} type="button" onClick={() => toggleWeekDay(idx)} className={`py-2.5 rounded-lg text-[11px] font-black transition-all duration-200 border ${selectedWeekDays.includes(idx) ? 'bg-violet-600 text-white border-violet-700 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50'}`}>{name}</button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Live Preview */}
                                {((schedType === 'monthly' && selectedDays.length > 0) || (schedType === 'weekly' && selectedWeekDays.length > 0)) && (
                                    <div className="bg-white p-3 rounded-xl border border-violet-200 space-y-1">
                                        <p className="text-[11px] font-black text-violet-800">
                                            📅 {schedType === 'monthly'
                                                ? `Every ${selectedDays.map(d => formatSuffix(d)).join(' & ')} of the month`
                                                : `Every ${selectedWeekDays.map(n => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][n]).join(' & ')}`}
                                        </p>
                                        <p className="text-[10px] font-bold text-violet-500">
                                            Next Due: {new Date(schedType === 'monthly' ? computeNextMonthly(selectedDays) : computeNextWeekly(selectedWeekDays)).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-5 bg-blue-700 text-white font-black rounded-[2rem] shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs"
                    >
                        {isSubmitting ? 'Saving...' : '✉️ Confirm & Log Received'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default DemandLetterComponent;
