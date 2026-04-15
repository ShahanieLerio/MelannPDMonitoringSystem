
import React, { useState } from 'react';
import { Loan, PriorityLevel, User, Remark } from '../types.ts';
import { store } from '../services/dataStore.ts';
import { analyzeRemarkPriority } from '../services/geminiService.ts';
import SuccessModal from './SuccessModal.tsx';

interface RemarksModalProps {
  loan: Loan;
  currentUser: User;
  onClose: () => void;
}

const RemarksModal: React.FC<RemarksModalProps> = ({ loan, currentUser, onClose }) => {
  const [newRemark, setNewRemark] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRemark, setEditingRemark] = useState<{ id: string } | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<{ title: string, message: string } | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  const isPTPSuggested = !ptpDate && (
    newRemark.toLowerCase().includes('pay') ||
    newRemark.toLowerCase().includes('babayad') ||
    newRemark.toLowerCase().includes('promise')
  );

  const showRemarkWarning = (!newRemark.trim() && (ptpDate || followUpDate));

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemark.trim() && !ptpDate && !followUpDate) return;

    setIsSubmitting(true);
    setErrorFeedback(null);
    try {
      const priority = await analyzeRemarkPriority(newRemark);

      if (editingRemark) {
        await store.updateRemark(loan.id, editingRemark.id, newRemark, priority, currentUser.username, currentUser.role, ptpDate || null, followUpDate || null);
        setEditingRemark(null);
        setSuccessFeedback({
          title: "Field Intel Updated",
          message: "The intelligence remarks have been successfully updated and synced."
        });
      } else {
        await store.addRemark(loan.id, newRemark, currentUser.username, priority, currentUser.username, currentUser.role, ptpDate || null, followUpDate || null);
        setSuccessFeedback({
          title: "Field Intel Logged",
          message: "The new field intelligence has been successfully saved to the client profile."
        });
      }

      setNewRemark('');
      setPtpDate('');
      setFollowUpDate('');
    } catch (err: any) {
      setErrorFeedback(err.message || 'Failed to submit field intelligence. Check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (remark: Remark) => {
    setEditingRemark({ id: remark.id });
    setNewRemark(remark.text);
    setPtpDate(remark.ptpDate || '');
    setFollowUpDate(remark.followUpDate || '');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-slideUp border border-white/20">
        <div className="bg-[#064e3b] p-10 text-white shrink-0">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-900/50 rounded-xl border border-white/10">Field Intelligence</span>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <h2 className="text-2xl font-black tracking-tight">{loan.borrowerName}</h2>
          <div className="mt-4 flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 ${loan.aiPriority === PriorityLevel.TOP ? 'bg-red-500 text-white' :
              loan.aiPriority === PriorityLevel.FOLLOW_UP ? 'bg-amber-500 text-white' :
                'bg-emerald-900/50 text-white'
              }`}>
              Pulse: {loan.aiPriority || PriorityLevel.LOWEST}
            </span>
            <span className="text-[10px] font-bold text-emerald-100/60 uppercase tracking-widest ml-2">{loan.branch}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white custom-scrollbar">
          {/* A. RECENT ACTIVITY PREVIEW (Last 1-2 entries) */}
          {loan.remarks.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Recent Activity Context
              </p>
              <div className="space-y-3">
                {loan.remarks.slice().reverse().slice(0, 2).map(remark => (
                  <div key={remark.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:border-emerald-100 hover:shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">{remark.collector}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400">{new Date(remark.timestamp).toLocaleDateString()}</span>
                        <button onClick={() => handleEditClick(remark)} className="p-1 hover:bg-emerald-50 rounded text-slate-300 hover:text-emerald-600 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic line-clamp-2">"{remark.text}"</p>
                  </div>
                ))}
                {loan.remarks.length > 2 && (
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center pt-1">+ {loan.remarks.length - 2} More entries below</p>
                )}
              </div>
            </div>
          )}

          {/* B. INPUT FORM SECTION */}
          <div className="pt-2">
            <form onSubmit={handleAddRemark} className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Collector Notes / Remarks</label>
                  {showRemarkWarning && (
                     <span className="text-[10px] font-bold text-red-500 animate-bounce flex items-center gap-1">
                       ⚠ Add context for this action
                     </span>
                  )}
                </div>
                <div className="relative group">
                  <textarea
                    autoFocus
                    className="w-full p-6 bg-white border border-[#E5E7EB] rounded-[1.5rem] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none text-sm font-medium resize-none transition-all shadow-sm hover:border-slate-300 min-h-[120px] placeholder:text-slate-300"
                    placeholder="Describe field findings, visits, or borrower situation..."
                    value={newRemark}
                    onChange={e => setNewRemark(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {editingRemark && (
                    <button
                      type="button"
                      onClick={() => { setEditingRemark(null); setNewRemark(''); setPtpDate(''); setFollowUpDate(''); }}
                      className="absolute top-4 right-4 text-[9px] font-black text-white bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-black transition-all uppercase tracking-widest"
                    >
                      Cancel Edit
                    </button>
                  )}
                  {isPTPSuggested && (
                    <div className="absolute bottom-4 right-4 animate-fadeIn">
                       <button
                         type="button"
                         onClick={() => {
                           const picker = document.getElementById('ptp-picker') as HTMLInputElement;
                           if (picker) picker.showPicker();
                         }}
                         className="flex items-center gap-2 bg-amber-500 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all"
                       >
                         ✨ Set PTP Date?
                       </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. Promise to Pay Card (Stacked) */}
                <div className="group relative bg-[#FFF7ED] border-2 border-[#FDBA74] p-4 rounded-[12px] shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ease-out duration-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-amber-200 text-amber-700 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                      <div>
                        <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Promise to Pay (PTP)</p>
                        <p className="text-[10px] font-medium text-[#6B7280]">Sets borrower commitment date</p>
                      </div>
                    </div>
                    <input
                      id="ptp-picker"
                      type="date"
                      className="bg-white border border-[#E5E7EB] rounded-[8px] px-4 py-2 text-xs font-black text-amber-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer relative"
                      value={ptpDate}
                      onChange={e => setPtpDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* 2. Follow Up Date Card (Stacked) */}
                <div className="group relative bg-[#EFF6FF] border-2 border-[#93C5FD] p-4 rounded-[12px] shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ease-out duration-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-blue-200 text-blue-700 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                      <div>
                        <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Set Follow Up Date</p>
                        <p className="text-[10px] font-medium text-[#6B7280]">Schedule next visit or action</p>
                      </div>
                    </div>
                    <input
                      type="date"
                      className="bg-white border border-[#E5E7EB] rounded-[8px] px-4 py-2 text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer relative"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {errorFeedback && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="text-xs text-red-600 font-medium">{errorFeedback}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (!newRemark.trim() && !ptpDate && !followUpDate)}
                className="w-full py-6 bg-emerald-600 text-white font-black rounded-[2rem] shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 uppercase tracking-widest text-xs"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    {editingRemark ? 'Update Intelligence' : 'Log Field Intel'}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* C. FULL HISTORY SECTION (Separator) */}
          {loan.remarks.length > 2 && (
            <div className="pt-10 border-t border-slate-100 flex flex-col items-center">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-8">Previous Field Logs</span>
               <div className="w-full space-y-8">
                  {loan.remarks.slice().reverse().slice(2).map(remark => (
                    <div key={remark.id} className="relative pl-8 border-l-2 border-slate-100 bg-white group">
                      <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-slate-300 shadow-sm transition-colors group-hover:bg-emerald-500"></div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <span className="text-slate-600 font-black">{remark.collector}</span>
                          <span className="text-slate-200">•</span>
                          {new Date(remark.timestamp).toLocaleDateString()}
                        </span>
                        <span>{new Date(remark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        {remark.text}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {remark.ptpDate && (
                            <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                              PTP: {new Date(remark.ptpDate).toLocaleDateString()}
                            </span>
                          )}
                          {remark.followUpDate && (
                            <span className="bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1.5">
                              Follow-up: {new Date(remark.followUpDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {loan.remarks.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
               <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-3xl animate-bounce">📄</div>
               <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">No field activity yet</h4>
                  <p className="text-xs text-slate-400 font-medium max-w-[200px]">Start by adding a remark or setting a follow-up action.</p>
               </div>
            </div>
          )}
        </div>
      </div>

      <SuccessModal
        isOpen={!!successFeedback}
        title={successFeedback?.title || ''}
        message={successFeedback?.message || ''}
        onConfirm={() => setSuccessFeedback(null)}
      />
    </div>
  );
};

export default RemarksModal;
