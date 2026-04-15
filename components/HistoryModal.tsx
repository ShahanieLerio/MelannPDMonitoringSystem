
import React from 'react';
import { Loan, HistoryRecord } from '../types.ts';

interface HistoryModalProps {
    loan: Loan;
    onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ loan, onClose }) => {
    // Sort history by timestamp descending (newest first)
    const sortedHistory = [...(loan.history || [])].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-slideUp border border-white/20">
                <div className="bg-[#064e3b] p-10 text-white shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-900/50 rounded-xl border border-white/10 flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Activity Audit Trail
                        </span>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{loan.borrowerName}</h2>
                    <p className="text-[10px] font-bold text-emerald-100/60 uppercase tracking-widest mt-1">Client Code: {loan.code} • {loan.branch}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-white">
                    {sortedHistory.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic font-medium uppercase tracking-[0.2em] text-[10px]">No activity history recorded for this client.</div>
                    ) : (
                        <div className="space-y-4">
                            {sortedHistory.map((record, index) => (
                                <div key={record.id} className="group flex gap-6 relative">
                                    {/* Timeline Line */}
                                    {index !== sortedHistory.length - 1 && (
                                        <div className="absolute left-[23px] top-10 bottom-[-16px] w-0.5 bg-slate-100 group-last:hidden"></div>
                                    )}

                                    {/* Avatar / Icon Container */}
                                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg z-10 transition-transform group-hover:scale-110 shadow-sm">
                                        {getActivityIcon(record.type)}
                                    </div>

                                    {/* Content Container */}
                                    <div className="flex-1 pb-8">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mr-3 px-2 py-0.5 bg-emerald-50 rounded-lg">{record.type}</span>
                                                <span className="text-xs font-bold text-slate-400">{new Date(record.timestamp).toLocaleDateString()} at {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{record.module}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 font-semibold leading-relaxed mb-3">{record.description}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-500 font-bold">
                                                {record.user.charAt(0).toUpperCase()}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span className="text-slate-600">{record.user}</span> • {record.role}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-50 bg-slate-50/30 shrink-0 text-center">
                    <button
                        onClick={onClose}
                        className="px-10 py-4 bg-slate-900 text-white font-black rounded-3xl shadow-md shadow-black/10 hover:bg-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95 uppercase tracking-widest text-[10px]"
                    >
                        Close History
                    </button>
                </div>
            </div>
        </div>
    );
};

const getActivityIcon = (type: string) => {
    switch (type) {
        case 'Loan Creation': return '📝';
        case 'Payment Received': return '💰';
        case 'Status Change': return '🔄';
        case 'Remark Added': return '💬';
        case 'Demand Letter Issued': return '✉️';
        case 'Legal Status Update': return '⚖️';
        case 'Location Update': return '📍';
        case 'Collector Reassignment': return '👥';
        case 'Balance Adjustment': return '📊';
        default: return '🔘';
    }
};

export default HistoryModal;
