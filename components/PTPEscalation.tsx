import React, { useMemo, useState } from 'react';
import { Branch, Loan, PriorityLevel, User } from '../types';
import { getPTPEscalationCases, PTPEscalationCase } from '../services/ptpEscalation';
import { useClientUpdates } from '../hooks/useClientUpdates';
import ClientModal from './ClientModal';
import RemarksModal from './RemarksModal';
import VisitLogModal from './VisitLogModal';

interface PTPEscalationProps {
  selectedBranch: Branch;
  currentUser: User;
}

const cleanRemarkText = (text: string) => {
  return text
    .replace(/\[DL_MARKER\]/g, '')
    .replace(/\[DL_RECEIVED\]\s*Demand Letter received on \d{4}-\d{2}-\d{2}\.?\s*/g, '')
    .replace(/\[DL_RECEIVED\]\s*/g, '')
    .trim() || 'No additional remarks.';
};

const formatDate = (date: string) => {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const priorityClass = (level?: PriorityLevel) => {
  switch (level) {
    case PriorityLevel.TOP:
      return 'bg-red-50 text-red-700 border-red-200';
    case PriorityLevel.NEED_ATTENTION:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case PriorityLevel.FOLLOW_UP:
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case PriorityLevel.MONITOR:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200';
  }
};

const PTPEscalation: React.FC<PTPEscalationProps> = ({ selectedBranch, currentUser }) => {
  const { loans } = useClientUpdates(selectedBranch);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [remarksLoan, setRemarksLoan] = useState<Loan | null>(null);
  const [visitLogLoan, setVisitLogLoan] = useState<Loan | null>(null);

  const escalationCases = useMemo(() => getPTPEscalationCases(loans), [loans]);
  const filteredCases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return escalationCases;

    return escalationCases.filter(item =>
      item.borrowerName.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.collector.toLowerCase().includes(term)
    );
  }, [escalationCases, searchTerm]);

  const summary = useMemo(() => {
    const exposure = escalationCases.reduce((sum, item) => sum + item.runningBalance, 0);
    const missed = escalationCases.reduce((sum, item) => sum + item.missedCount, 0);
    const collectors = new Set(escalationCases.map(item => item.collector || 'UNASSIGNED')).size;
    return { exposure, missed, collectors };
  }, [escalationCases]);

  const currentRemarksLoan = useMemo(() => {
    if (!remarksLoan) return null;
    return loans.find(loan => loan.id === remarksLoan.id) || remarksLoan;
  }, [loans, remarksLoan]);

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="bg-white rounded-[1.5rem] border border-red-200 shadow-sm p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-3">
            Required Super Action
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">PTP Escalation</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Clients with 3 or more missed remarks, commitments, or scheduled payments for <span className="text-emerald-700">{selectedBranch}</span>.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search client, code, collector..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Escalated Clients" value={escalationCases.length.toLocaleString()} tone="red" />
        <SummaryCard label="Total Missed Commitments" value={summary.missed.toLocaleString()} tone="amber" />
        <SummaryCard label="Balance Exposure" value={`PHP ${summary.exposure.toLocaleString()}`} tone="slate" />
      </div>

      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-xl shadow-slate-900/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">
            Super Action Queue
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {summary.collectors} Collector{summary.collectors === 1 ? '' : 's'} with escalation cases
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Client</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Collector</th>
                <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">Missed</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Latest Missed Commitment</th>
                <th className="p-4 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Balance</th>
                <th className="p-4 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.map(item => (
                <EscalationRow
                  key={item.id}
                  item={item}
                  onViewDetails={setSelectedLoan}
                  onAddRemark={setRemarksLoan}
                  onVisitLog={setVisitLogLoan}
                />
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      No PTP escalation cases found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && (
        <ClientModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      )}
      {currentRemarksLoan && (
        <RemarksModal loan={currentRemarksLoan} onClose={() => setRemarksLoan(null)} currentUser={currentUser} />
      )}
      {visitLogLoan && (
        <VisitLogModal loan={visitLogLoan} currentUser={currentUser} onClose={() => setVisitLogLoan(null)} />
      )}
    </div>
  );
};

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'red' | 'amber' | 'slate' }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700'
  };

  return (
    <div className={`rounded-[1.25rem] border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function EscalationRow({ item, onViewDetails, onAddRemark, onVisitLog }: {
  item: PTPEscalationCase;
  onViewDetails: (loan: Loan) => void;
  onAddRemark: (loan: Loan) => void;
  onVisitLog: (loan: Loan) => void;
}) {
  const visibleMisses = item.missedCommitments.slice(-3).reverse();

  return (
    <tr className="group hover:bg-red-50/40 transition-colors">
      <td className="p-4 align-top">
        <div className="flex flex-col">
          <span className="text-sm font-black text-slate-900 group-hover:text-red-800">{item.borrowerName}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.code}</span>
          <span className={`mt-2 w-fit rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${priorityClass(item.aiPriority)}`}>
            {item.aiPriority || PriorityLevel.LOWEST}
          </span>
        </div>
      </td>
      <td className="p-4 align-top">
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
          {item.collector || 'UNASSIGNED'}
        </span>
      </td>
      <td className="p-4 align-top text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-lg font-black text-white shadow-lg shadow-red-900/20">
          {item.missedCount}
        </span>
      </td>
      <td className="p-4 align-top min-w-[340px]">
        <div className="space-y-2">
          {visibleMisses.map(miss => (
            <div key={miss.id} className="rounded-xl border border-red-100 bg-white p-3 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-red-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-red-700 border border-red-100">
                  {miss.type}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Missed {formatDate(miss.dueDate)}
                </span>
              </div>
              <p className="line-clamp-2 text-[11px] font-bold italic leading-relaxed text-slate-600">
                "{cleanRemarkText(miss.context)}"
              </p>
            </div>
          ))}
        </div>
      </td>
      <td className="p-4 align-top text-right whitespace-nowrap">
        <span className="text-sm font-black text-slate-900">PHP {item.runningBalance.toLocaleString()}</span>
      </td>
      <td className="p-4 align-top">
        <div className="flex justify-end gap-1">
          <button onClick={() => onVisitLog(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-100 hover:text-red-700 transition-colors" title="Visit Log">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </button>
          <button onClick={() => onAddRemark(item)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 transition-colors" title="Remarks">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </button>
          <button onClick={() => onViewDetails(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Client Details">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default PTPEscalation;
