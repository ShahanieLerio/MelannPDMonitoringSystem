
import React, { useState, useEffect } from 'react';
import { Loan, User, ContactLog, ContactMethod } from '../types.ts';
import { store } from '../services/dataStore.ts';

interface ContactLogModalProps {
  loan: Loan;
  currentUser: User;
  onClose: () => void;
}

const METHOD_CONFIG: Record<ContactMethod, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  [ContactMethod.CALL]: {
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  [ContactMethod.TEXT_SMS]: {
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  [ContactMethod.SOCIAL_MEDIA]: {
    icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  [ContactMethod.CHAT_MESSENGER]: {
    icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200'
  },
  [ContactMethod.EMAIL]: {
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  [ContactMethod.OTHER]: {
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200'
  }
};

const ContactLogModal: React.FC<ContactLogModalProps> = ({ loan, currentUser, onClose }) => {
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [contactDate, setContactDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<ContactMethod>(ContactMethod.CALL);
  const [notes, setNotes] = useState('');
  const [clientResponse, setClientResponse] = useState('');
  const [hasResponse, setHasResponse] = useState(false);
  const [personnelAssigned, setPersonnelAssigned] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setContactLogs(store.getContactLogs(loan.id));
  }, [loan.id]);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      setErrorFeedback('Please describe what you communicated or attempted.');
      return;
    }
    if (!personnelAssigned.trim()) {
      setErrorFeedback('Personnel Assigned is required. Please enter the name of the person who made the contact.');
      return;
    }
    setIsSubmitting(true);
    setErrorFeedback(null);
    try {
      await store.addContactLog(
        loan.id,
        contactDate,
        method,
        notes,
        clientResponse,
        hasResponse,
        currentUser.username,
        currentUser.role,
        personnelAssigned.trim()
      );
      setShowSuccess(true);
      setNotes('');
      setClientResponse('');
      setHasResponse(false);
      setPersonnelAssigned('');
      setContactLogs(store.getContactLogs(loan.id));
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      setErrorFeedback(err.message || 'Failed to save contact log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-7 text-white shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")'}}></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">Visit / Contact Log</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <h2 className="text-2xl font-black tracking-tight">{loan.borrowerName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full border border-white/10">{loan.code}</span>
              <span className="text-[10px] font-bold text-indigo-100/60 uppercase tracking-widest">• {loan.collector}</span>
              <span className="text-[10px] font-bold text-indigo-100/40 uppercase tracking-widest">• ₱{loan.runningBalance.toLocaleString()} Balance</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-7 space-y-5 bg-white dark:bg-slate-800 custom-scrollbar">
          {/* Contact History */}
          {contactLogs.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Contact History ({contactLogs.length} {contactLogs.length === 1 ? 'entry' : 'entries'})
              </p>
              <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {contactLogs.map(log => {
                  const config = METHOD_CONFIG[log.method as ContactMethod] || METHOD_CONFIG[ContactMethod.OTHER];
                  return (
                    <div key={log.id} className={`p-4 rounded-2xl border hover:shadow-sm transition-all ${config.bgColor} ${config.borderColor} dark:bg-slate-900/50 dark:border-slate-700`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                            <svg className="w-3 h-3 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={config.icon}></path></svg>
                            {log.method}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                            log.hasResponse 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' 
                              : 'bg-orange-50 text-orange-500 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800'
                          }`}>
                            {log.hasResponse ? '✓ With Response' : '✗ No Response'}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                          {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed mb-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">Notes: </span>
                        "{log.notes}"
                      </p>
                      {log.clientResponse && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest not-italic">Client: </span>
                          "{log.clientResponse}"
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-500 font-bold flex-wrap">
                        <span>Contact: {new Date(log.contactDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>By: {log.loggedBy}</span>
                        {log.personnelAssigned && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                              {log.personnelAssigned}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Contact Log Form */}
          <div className="pt-1">
            <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New Contact Entry
            </p>

            {/* Contact Date & Method */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Contact Date</label>
                <input
                  type="date"
                  value={contactDate}
                  onChange={e => setContactDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Contact Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as ContactMethod)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  disabled={isSubmitting}
                >
                  {Object.values(ContactMethod).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Personnel Assigned */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Personnel Assigned <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <input
                  type="text"
                  value={personnelAssigned}
                  onChange={e => setPersonnelAssigned(e.target.value)}
                  placeholder="Full name of person who contacted the client..."
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Response Toggle */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Client Response Status</label>
              <button
                type="button"
                onClick={() => setHasResponse(!hasResponse)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all border-2 ${
                  hasResponse
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 shadow-sm'
                    : 'bg-orange-50 dark:bg-orange-900/10 text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:border-orange-300'
                }`}
                disabled={isSubmitting}
              >
                {hasResponse ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> Client Responded</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg> No Response / Unanswered</>
                )}
              </button>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Notes / Details <span className="text-red-500">*</span></label>
              <textarea
                autoFocus
                className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-sm font-medium text-slate-800 dark:text-slate-200 resize-none transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600 min-h-[90px] placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="e.g. Called the client, no answer after 3 attempts. Left a text message..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Client Response (optional) */}
            <div className="mb-5">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Client Response / Reply (Optional)</label>
              <textarea
                className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-sm font-medium text-slate-800 dark:text-slate-200 resize-none transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600 min-h-[70px] placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="What did the client say or reply? Any promises, reasons for delay..."
                value={clientResponse}
                onChange={e => setClientResponse(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {errorFeedback && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 mb-4">
                <svg className="w-4 h-4 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errorFeedback}</p>
              </div>
            )}

            {showSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2 mb-4 animate-fadeIn">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Contact logged successfully!</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !notes.trim()}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-[11px]"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  Log Contact Attempt
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactLogModal;
