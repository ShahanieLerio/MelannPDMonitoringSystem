
import React, { useState, useEffect } from 'react';
import { Loan, User, VisitLog, VisitLogAction } from '../types.ts';
import { store } from '../services/dataStore.ts';
import SuccessModal from './SuccessModal.tsx';

interface VisitLogModalProps {
  loan: Loan;
  currentUser: User;
  onClose: () => void;
}

const VisitLogModal: React.FC<VisitLogModalProps> = ({ loan, currentUser, onClose }) => {
  const [visitLogs, setVisitLogs] = useState<VisitLog[]>([]);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectorNotes, setCollectorNotes] = useState('');
  const [clientComment, setClientComment] = useState('');
  const [visitedByCollector, setVisitedByCollector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<{ title: string; message: string } | null>(null);
  const [showConfirmAction, setShowConfirmAction] = useState<'return' | 'settled' | null>(null);

  useEffect(() => {
    setVisitLogs(store.getVisitLogs(loan.id));
  }, [loan.id]);

  const handleSubmitLog = async (action: VisitLogAction) => {
    if (!collectorNotes.trim()) {
      setErrorFeedback('Collector notes are required.');
      return;
    }
    setIsSubmitting(true);
    setErrorFeedback(null);
    try {
      await store.addVisitLog(
        loan.id,
        visitDate,
        collectorNotes,
        clientComment,
        visitedByCollector,
        action,
        currentUser.username,
        currentUser.role
      );

      const successTitle = action === VisitLogAction.RETURN_TO_UPDATE
        ? 'Returned to Client Updates'
        : action === VisitLogAction.MARK_SETTLED
          ? 'Account Settled'
          : 'Visit Logged';

      const successMsg = action === VisitLogAction.RETURN_TO_UPDATE
        ? 'This client has been moved back to All Client Updates Log for new follow-up/promise tracking.'
        : action === VisitLogAction.MARK_SETTLED
          ? 'This account has been marked as settled and will no longer appear in monitoring queues.'
          : 'The visit has been successfully logged for close monitoring.';

      setSuccessFeedback({ title: successTitle, message: successMsg });
      setCollectorNotes('');
      setClientComment('');
      setVisitedByCollector(false);
      setShowConfirmAction(null);

      // Refresh logs
      setVisitLogs(store.getVisitLogs(loan.id));
    } catch (err: any) {
      setErrorFeedback(err.message || 'Failed to save visit log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case VisitLogAction.RETURN_TO_UPDATE:
        return { label: 'RETURNED', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case VisitLogAction.MARK_SETTLED:
        return { label: 'SETTLED', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      default:
        return { label: 'LOGGED', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-slideUp border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-br from-rose-700 via-rose-600 to-rose-800 p-8 text-white shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22/%3E%3C/g%3E%3C/svg%3E')]"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">Close Monitoring • Visit Log</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <h2 className="text-2xl font-black tracking-tight">{loan.borrowerName}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full border border-white/10">{loan.code}</span>
              <span className="text-[10px] font-bold text-rose-100/60 uppercase tracking-widest">• {loan.collector}</span>
              <span className="text-[10px] font-bold text-rose-100/40 uppercase tracking-widest">• ₱{loan.runningBalance.toLocaleString()} Balance</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white custom-scrollbar">
          {/* Visit Log History */}
          {visitLogs.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                Visit History ({visitLogs.length} {visitLogs.length === 1 ? 'entry' : 'entries'})
              </p>
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {visitLogs.map(log => {
                  const badge = getActionBadge(log.action);
                  return (
                    <div key={log.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:border-rose-100 hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                          {log.visitedByCollector && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                              ✓ Visited
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-bold leading-relaxed mb-1">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Collector: </span>
                        "{log.collectorNotes}"
                      </p>
                      {log.clientComment && (
                        <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest not-italic">Client: </span>
                          "{log.clientComment}"
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                        <span>Visit: {new Date(log.visitDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>By: {log.loggedBy}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Visit Log Form */}
          <div className="pt-2">
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New Visit Entry
            </p>

            {/* Visit Date & Collector Visit Toggle */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Visit Date</label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Collector Visit Status</label>
                <button
                  type="button"
                  onClick={() => setVisitedByCollector(!visitedByCollector)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all border-2 ${
                    visitedByCollector
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                  disabled={isSubmitting}
                >
                  {visitedByCollector ? (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> Yes, Visited</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> Not Visited</>
                  )}
                </button>
              </div>
            </div>

            {/* Collector Notes */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Collector Notes / Observations <span className="text-rose-500">*</span></label>
              <textarea
                autoFocus
                className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none text-sm font-medium resize-none transition-all shadow-sm hover:border-slate-300 min-h-[100px] placeholder:text-slate-300"
                placeholder="Describe findings from the visit, collector status update, or situation report..."
                value={collectorNotes}
                onChange={e => setCollectorNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Client Comment */}
            <div className="mb-6">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Client Comment / Response</label>
              <textarea
                className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none text-sm font-medium resize-none transition-all shadow-sm hover:border-slate-300 min-h-[80px] placeholder:text-slate-300"
                placeholder="What did the client say? Any promises, complaints, or feedback..."
                value={clientComment}
                onChange={e => setClientComment(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {errorFeedback && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 mb-4">
                <svg className="w-4 h-4 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-xs text-red-600 font-medium">{errorFeedback}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Primary: Just Log Visit */}
              <button
                onClick={() => handleSubmitLog(VisitLogAction.LOG_ONLY)}
                disabled={isSubmitting || !collectorNotes.trim()}
                className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-900/20 hover:bg-rose-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-[11px]"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    Log Visit Entry
                  </>
                )}
              </button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Return to Client Updates */}
                <button
                  onClick={() => setShowConfirmAction('return')}
                  disabled={isSubmitting || !collectorNotes.trim()}
                  className="py-4 px-4 bg-blue-50 text-blue-700 font-black rounded-2xl border-2 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 flex flex-col items-center justify-center gap-1.5 text-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                  <span className="text-[9px] uppercase tracking-widest leading-tight">Return to<br/>Client Updates</span>
                </button>

                {/* Mark as Settled */}
                <button
                  onClick={() => setShowConfirmAction('settled')}
                  disabled={isSubmitting || !collectorNotes.trim()}
                  className="py-4 px-4 bg-emerald-50 text-emerald-700 font-black rounded-2xl border-2 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 flex flex-col items-center justify-center gap-1.5 text-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span className="text-[9px] uppercase tracking-widest leading-tight">Mark as<br/>Settled</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Overlay */}
        {showConfirmAction && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-8 animate-fadeIn">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-slideUp">
              <div className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-6 ${
                showConfirmAction === 'settled' ? 'bg-emerald-100' : 'bg-blue-100'
              }`}>
                {showConfirmAction === 'settled' ? (
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ) : (
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-800 text-center mb-2">
                {showConfirmAction === 'settled' ? 'Mark Account as Settled?' : 'Return to Client Updates?'}
              </h3>
              <p className="text-xs text-slate-500 text-center font-medium mb-8 leading-relaxed">
                {showConfirmAction === 'settled'
                  ? 'This will mark the account as PAID/SETTLED. It will be removed from all monitoring queues and will NOT appear in All Client Update Log.'
                  : 'This will move the client back to All Client Updates Log for new promise tracking or follow-up scheduling. The client will leave Close Monitoring.'
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmAction(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitLog(
                    showConfirmAction === 'settled' ? VisitLogAction.MARK_SETTLED : VisitLogAction.RETURN_TO_UPDATE
                  )}
                  disabled={isSubmitting}
                  className={`flex-1 py-3 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                    showConfirmAction === 'settled'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                  ) : (
                    showConfirmAction === 'settled' ? 'Confirm Settled' : 'Confirm Return'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <SuccessModal
          isOpen={!!successFeedback}
          title={successFeedback?.title || ''}
          message={successFeedback?.message || ''}
          onConfirm={() => {
            setSuccessFeedback(null);
            // If action was return or settled, close the modal since the loan will move out
            if (successFeedback?.title === 'Returned to Client Updates' || successFeedback?.title === 'Account Settled') {
              onClose();
            }
          }}
        />
      </div>
    </div>
  );
};

export default VisitLogModal;
