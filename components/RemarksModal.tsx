
import React, { useEffect, useState } from 'react';
import { Loan, PriorityLevel, User, Remark, RecurringSchedule } from '../types.ts';
import { store } from '../services/dataStore.ts';
import { analyzeRemarkPriority } from '../services/geminiService.ts';
import SuccessModal from './SuccessModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

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
  const [deletingRemarkId, setDeletingRemarkId] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<{ title: string, message: string } | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [recurringEnabled, setRecurringEnabled] = useState(loan.recurringSchedule?.enabled || false);
  const [scheduleType, setScheduleType] = useState<'monthly' | 'weekly' | 'everyday'>(loan.recurringSchedule?.type || 'monthly');
  const [selectedDays, setSelectedDays] = useState<number[]>(loan.recurringSchedule?.days || []);
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>(loan.recurringSchedule?.weekDays || []);
  const scheduleSignature = JSON.stringify(loan.recurringSchedule || null);

  // Get the most up-to-date loan data from the store
  const currentLoanData = store.getLoans().find(l => l.id === loan.id) || loan;
  const currentRemarks = currentLoanData.remarks || [];

  useEffect(() => {
    setRecurringEnabled(loan.recurringSchedule?.enabled || false);
    setScheduleType(loan.recurringSchedule?.type || 'monthly');
    setSelectedDays(loan.recurringSchedule?.days || []);
    setSelectedWeekDays(loan.recurringSchedule?.weekDays || []);
  }, [loan.id, scheduleSignature]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b));
  };

  const toggleWeeklyDay = (dayIndex: number) => {
    setSelectedWeekDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort((a, b) => a - b));
  };

  const getLocalISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const computeLocalNextDue = (days: number[]): string => {
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

  const computeLocalNextWeeklyDue = (weekDays: number[]): string => {
    const sorted = [...weekDays].sort((a, b) => a - b);
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    for (const day of sorted) {
      if (day >= currentDayOfWeek) {
        today.setDate(today.getDate() + (day - currentDayOfWeek));
        return getLocalISODate(today);
      }
    }
    today.setDate(today.getDate() + (7 - currentDayOfWeek + sorted[0]));
    return getLocalISODate(today);
  };

  const computeLocalNextEverydayDue = (afterDate = new Date()): string => {
    const next = new Date(afterDate);
    while (next.getDay() === 0) {
      next.setDate(next.getDate() + 1);
    }
    return getLocalISODate(next);
  };

  const formatDaySuffix = (d: number) => {
    if (d >= 11 && d <= 13) return d + 'th';
    switch (d % 10) {
      case 1: return d + 'st';
      case 2: return d + 'nd';
      case 3: return d + 'rd';
      default: return d + 'th';
    }
  };

  const isPTPSuggested = !ptpDate && (
    newRemark.toLowerCase().includes('pay') ||
    newRemark.toLowerCase().includes('babayad') ||
    newRemark.toLowerCase().includes('promise')
  );

  const showRemarkWarning = (!newRemark.trim() && (ptpDate || followUpDate));

  const isSameSchedule = (existing: RecurringSchedule | null | undefined) => {
    if (!existing?.enabled || existing.type !== scheduleType) return false;
    const nextDaysValue = scheduleType === 'everyday' ? [1, 2, 3, 4, 5, 6] : selectedDays;
    const nextWeekDaysValue = scheduleType === 'everyday' ? [1, 2, 3, 4, 5, 6] : selectedWeekDays;
    const existingDays = [...(existing.days || [])].sort((a, b) => a - b).join(',');
    const nextDays = [...nextDaysValue].sort((a, b) => a - b).join(',');
    const existingWeekDays = [...(existing.weekDays || [])].sort((a, b) => a - b).join(',');
    const nextWeekDays = [...nextWeekDaysValue].sort((a, b) => a - b).join(',');
    return existingDays === nextDays && existingWeekDays === nextWeekDays;
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasValidRecurringSchedule = recurringEnabled && (
      scheduleType === 'everyday' ||
      (scheduleType === 'monthly' && selectedDays.length > 0) ||
      (scheduleType === 'weekly' && selectedWeekDays.length > 0)
    );
    const isDisablingRecurringSchedule = !recurringEnabled && !!loan.recurringSchedule?.enabled;
    if (!newRemark.trim() && !ptpDate && !followUpDate && !hasValidRecurringSchedule && !isDisablingRecurringSchedule) return;

    setIsSubmitting(true);
    setErrorFeedback(null);
    try {
      const hasRemarkContent = newRemark.trim() !== '' || ptpDate !== '' || followUpDate !== '';

      if (hasRemarkContent) {
        const priority = await analyzeRemarkPriority(newRemark || 'Schedule updated');

        if (editingRemark) {
          await store.updateRemark(loan.id, editingRemark.id, newRemark, priority, currentUser.username, currentUser.role, ptpDate || null, followUpDate || null);
          setEditingRemark(null);
        } else {
          await store.addRemark(loan.id, newRemark || 'Schedule updated', currentUser.username, priority, currentUser.username, currentUser.role, ptpDate || null, followUpDate || null);
        }
      }

      // Save recurring schedule BEFORE showing success feedback
      // This ensures the schedule is committed to DB as part of the transactional flow
      if (hasValidRecurringSchedule) {
        const nextDue = scheduleType === 'everyday'
          ? computeLocalNextEverydayDue()
          : scheduleType === 'monthly'
            ? computeLocalNextDue(selectedDays)
            : computeLocalNextWeeklyDue(selectedWeekDays);
        const today = getLocalISODate(new Date());
        const scheduleStartDate = isSameSchedule(loan.recurringSchedule)
          ? (loan.recurringSchedule?.startDate || today)
          : today;
        const schedule: RecurringSchedule = {
          enabled: true,
          type: scheduleType,
          days: scheduleType === 'everyday' ? [1, 2, 3, 4, 5, 6] : selectedDays,
          weekDays: scheduleType === 'everyday' ? [1, 2, 3, 4, 5, 6] : selectedWeekDays,
          nextDueDate: nextDue,
          startDate: scheduleStartDate,
          lastPaidDate: loan.recurringSchedule?.lastPaidDate
        };
        await store.updateLoan(loan.id, { recurringSchedule: schedule, promiseToPayDate: nextDue }, currentUser.username, currentUser.role);
      } else if (!recurringEnabled && loan.recurringSchedule?.enabled) {
        // User disabled recurring
        await store.updateLoan(loan.id, { recurringSchedule: { ...loan.recurringSchedule, enabled: false } }, currentUser.username, currentUser.role);
      }

      // Show success only AFTER all data (remark + schedule) has been persisted
      setSuccessFeedback({
        title: editingRemark ? "Field Intel Updated" : "Field Intel Logged",
        message: editingRemark 
          ? "The intelligence remarks have been successfully updated and synced."
          : "The new field intelligence has been successfully saved to the client profile."
      });

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

  const handleDeleteRemark = async () => {
    if (!deletingRemarkId) return;
    setIsSubmitting(true);
    try {
      await store.deleteRemark(loan.id, deletingRemarkId, currentUser.username, currentUser.role);
      setSuccessFeedback({
        title: "Field Intel Deleted",
        message: "The remark has been successfully removed."
      });
    } catch (err: any) {
      setErrorFeedback(err.message || 'Failed to delete remark.');
    } finally {
      setIsSubmitting(false);
      setDeletingRemarkId(null);
    }
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
          {currentRemarks.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Recent Activity Context
              </p>
              <div className="space-y-3">
                {currentRemarks.slice().reverse().slice(0, 2).map(remark => (
                  <div key={remark.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:border-emerald-100 hover:shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">{remark.collector}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400">{new Date(remark.timestamp).toLocaleDateString()}</span>
                        <button onClick={() => handleEditClick(remark)} className="p-1 hover:bg-emerald-50 rounded text-slate-300 hover:text-emerald-600 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onClick={() => setDeletingRemarkId(remark.id)} className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-600 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic line-clamp-2">"{remark.text}"</p>
                  </div>
                ))}
                {currentRemarks.length > 2 && (
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center pt-1">+ {currentRemarks.length - 2} More entries below</p>
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

                {/* 3. Recurring Payment Schedule Card */}
                <div className={`group relative p-4 rounded-[12px] shadow-sm transition-all hover:shadow-md ease-out duration-200 border-2 ${
                  recurringEnabled ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${
                        recurringEnabled ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-500'
                      }`}>
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
                      {/* Mode Toggle */}
                      <div className="grid grid-cols-3 bg-slate-200/50 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setScheduleType('monthly')}
                          className={`py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${scheduleType === 'monthly' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleType('weekly')}
                          className={`py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${scheduleType === 'weekly' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Weekly
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleType('everyday')}
                          className={`py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${scheduleType === 'everyday' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Everyday
                        </button>
                      </div>

                      {scheduleType === 'monthly' ? (
                        <>
                          <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest pt-1">Select days of the month</p>
                          <div className="grid grid-cols-7 gap-1.5">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={`w-full aspect-square rounded-lg text-[11px] font-black transition-all duration-200 border ${
                                  selectedDays.includes(day)
                                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm scale-105'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : scheduleType === 'weekly' ? (
                        <>
                          <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest pt-1">Select days of the week</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleWeeklyDay(idx)}
                                className={`w-full py-2.5 rounded-lg text-[11px] font-black transition-all duration-200 border ${
                                  selectedWeekDays.includes(idx)
                                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
                                }`}
                              >
                                {dayName}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="bg-white p-3 rounded-xl border border-violet-200 space-y-1">
                          <p className="text-[11px] font-black text-violet-800">
                            Everyday, Monday to Saturday
                          </p>
                          <p className="text-[10px] font-bold text-violet-500">
                            No Sunday collection. Escalates after 3 unpaid scheduled days.
                          </p>
                        </div>
                      )}

                      {/* Display Data Output Block */}
                      {scheduleType === 'monthly' && selectedDays.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-violet-200 space-y-1">
                          <p className="text-[11px] font-black text-violet-800">
                            📅 Every {selectedDays.map(d => formatDaySuffix(d)).join(' & ')} of the month
                          </p>
                          <p className="text-[10px] font-bold text-violet-500">
                            Next Due: {new Date(computeLocalNextDue(selectedDays)).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {scheduleType === 'weekly' && selectedWeekDays.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-violet-200 space-y-1">
                          <p className="text-[11px] font-black text-violet-800">
                            📅 Every {selectedWeekDays.map(n => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][n]).join(' & ')}
                          </p>
                          <p className="text-[10px] font-bold text-violet-500">
                            Next Due: {new Date(computeLocalNextWeeklyDue(selectedWeekDays)).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {scheduleType === 'everyday' && (
                        <div className="bg-white p-3 rounded-xl border border-violet-200 space-y-1">
                          <p className="text-[11px] font-black text-violet-800">
                            Everyday: Monday to Saturday
                          </p>
                          <p className="text-[10px] font-bold text-violet-500">
                            Next Due: {new Date(computeLocalNextEverydayDue()).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      )}

                      {((scheduleType === 'monthly' && selectedDays.length === 0) || (scheduleType === 'weekly' && selectedWeekDays.length === 0)) && (
                        <p className="text-[10px] font-bold text-violet-400 text-center py-2">Select days above to set recurring target</p>
                      )}
                    </div>
                  )}

                  {!recurringEnabled && loan.recurringSchedule?.enabled && (
                    <p className="text-[9px] font-bold text-slate-400 mt-1">
                      Currently active: {loan.recurringSchedule.type === 'everyday'
                        ? 'Everyday, Monday to Saturday'
                        : loan.recurringSchedule.type === 'weekly'
                          ? `Every ${loan.recurringSchedule.weekDays?.map(n => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(' & ')}`
                          : `Every ${loan.recurringSchedule.days?.map(d => formatDaySuffix(d)).join(' & ')}`}. Toggle to modify.
                    </p>
                  )}
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
                disabled={isSubmitting || (
                  !newRemark.trim() &&
                  !ptpDate &&
                  !followUpDate &&
                  !(recurringEnabled && (scheduleType === 'everyday' || (scheduleType === 'monthly' && selectedDays.length > 0) || (scheduleType === 'weekly' && selectedWeekDays.length > 0))) &&
                  !(!recurringEnabled && loan.recurringSchedule?.enabled)
                )}
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
          {currentRemarks.length > 2 && (
            <div className="pt-10 border-t border-slate-100 flex flex-col items-center">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-8">Previous Field Logs</span>
               <div className="w-full space-y-8">
                  {currentRemarks.slice().reverse().slice(2).map(remark => (
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

          {currentRemarks.length === 0 && (
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

      <ConfirmationModal
        isOpen={!!deletingRemarkId}
        title="Delete Field Intel"
        message="Are you sure you want to delete this remark? This action cannot be undone."
        onConfirm={handleDeleteRemark}
        onCancel={() => setDeletingRemarkId(null)}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default RemarksModal;
