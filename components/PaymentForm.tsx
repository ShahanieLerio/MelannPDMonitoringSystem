
import React, { useState, useEffect, useRef } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, User, Branch, Payment, PaymentStatus } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface PaymentFormProps {
  currentUser: User;
  selectedBranch: Branch;
  activeView?: 'post' | 'reverse';
}

interface RecentPost {
  time: string;
  code: string;
  borrowerName: string;
  amount: number;
  collector: string;
  remarks: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ currentUser, selectedBranch, activeView }) => {
  const activeTab = activeView || 'post';

  // Post Payment States
  const [code, setCode] = useState('');
  const [loan, setLoan] = useState<Loan | null>(null);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Recent Posts State
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('melann_recent_payments');
    if (saved) {
      try {
        setRecentPosts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load recent payments", e);
      }
    }
  }, []);

  useEffect(() => {
    setError('');
    setSuccess('');
    if (activeTab === 'post') {
      setTimeout(() => codeRef.current?.focus(), 100);
    } else {
      setTimeout(() => revOrRef.current?.focus(), 100);
    }
  }, [activeTab]);

  // Reverse Payment States
  const [revOrNumber, setRevOrNumber] = useState('');
  const [revReason, setRevReason] = useState('');
  const [revLoan, setRevLoan] = useState<Loan | null>(null);
  const [revPayment, setRevPayment] = useState<Payment | null>(null);
  const [showRevConfirm, setShowRevConfirm] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirm = () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    // If we were in post tab and cancelled same-day, refocus amount
    if (activeTab === 'post') setTimeout(() => amountRef.current?.focus(), 0);
  };

  const askConfirm = (
    title: string, 
    message: string | React.ReactNode, 
    onConfirm: () => void, 
    type: 'danger' | 'warning' | 'info' = 'warning',
    confirmLabel?: string,
    cancelLabel?: string
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      },
      type,
      confirmLabel,
      cancelLabel
    });
  };

  const codeRef = React.useRef<HTMLInputElement>(null);
  const amountRef = React.useRef<HTMLInputElement>(null);
  const revOrRef = React.useRef<HTMLInputElement>(null);

  // Real-time preview calculation
  const typedAmount = parseFloat(amount) || 0;
  const previewBalanceRaw = loan ? loan.runningBalance - typedAmount : 0;
  const previewBalance = Math.max(0, previewBalanceRaw);
  const isOverpaid = previewBalanceRaw < 0;
  const isFullyPaid = loan && previewBalance === 0 && typedAmount > 0;

  const handleSearch = () => {
    setError('');
    const found = store.getLoanByCode(code);
    if (!found || (selectedBranch !== Branch.ALL && found.branch !== selectedBranch)) {
      setError(`Client code not found in ${selectedBranch}.`);
      setLoan(null);
      setTimeout(() => codeRef.current?.focus(), 0);
      return null;
    } else {
      setLoan(found);
      setTimeout(() => {
        amountRef.current?.focus();
      }, 100);
      return found;
    }
  };

  const handleRecentPostClick = (post: RecentPost) => {
    setCode(post.code);
    setError('');
    const found = store.getLoanByCode(post.code);
    if (!found || (selectedBranch !== Branch.ALL && found.branch !== selectedBranch)) {
      setError(`Client code not found in ${selectedBranch}.`);
      setLoan(null);
    } else {
      setLoan(found);
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  };

  const confirmSubmit = async () => {
    if (!loan) return;
    const paymentAmount = parseFloat(amount);

    setIsSaving(true);
    setError('');

    try {
      const updated = await store.recordPayment(
        loan.id,
        paymentAmount,
        paymentDate,
        remarks,
        currentUser.username,
        currentUser.role
      );

      if (updated) {
        showSuccess(`Payment of ₱${paymentAmount.toLocaleString()} received for ${loan.borrowerName}.`);

      // Update Recent Posts
      const newPost: RecentPost = {
        time: new Date().toISOString(),
        code: loan.code,
        borrowerName: loan.borrowerName,
        amount: paymentAmount,
        collector: loan.collector,
        remarks: remarks
      };

      const updatedRecent = [newPost, ...recentPosts].slice(0, 10);
      setRecentPosts(updatedRecent);
      localStorage.setItem('melann_recent_payments', JSON.stringify(updatedRecent));

        setLoan(null);
        setCode('');
        setAmount('');
        setRemarks('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setTimeout(() => {
          codeRef.current?.focus();
        }, 0);
      }
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      setError(err.message || 'Server error: Failed to save payment. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid amount.');
      setTimeout(() => amountRef.current?.focus(), 0);
      return;
    }

    const duplicatePayment = loan.payments.find(p => p.date === paymentDate && p.status !== 'REVERSED');

    if (duplicatePayment) {
      const historyMatch = loan.history.slice().reverse().find(
        h => h.type === 'Payment Received' && h.description.includes(duplicatePayment.orNumber)
      );
      const timeStr = historyMatch 
        ? new Date(historyMatch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Time unavailable';

      const warningMessage = (
        <div className="text-left space-y-3 mt-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
          <p className="font-bold text-amber-900 border-b border-amber-200/50 pb-2">This client already has a posted payment for the selected date.</p>
          <ul className="space-y-1.5 text-amber-800">
            <li className="flex justify-between items-center bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Client</span>
              <span className="font-bold">{loan.borrowerName}</span>
            </li>
            <li className="flex justify-between items-center bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Last Payment Time</span>
              <span className="font-bold">{timeStr}</span>
            </li>
            <li className="flex justify-between items-center bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Last Payment Amount</span>
              <span className="font-black text-emerald-600">₱{duplicatePayment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </li>
          </ul>
        </div>
      );

      askConfirm(
        "⚠️ Duplicate Payment Warning",
        warningMessage,
        confirmSubmit,
        'warning',
        '✅ Proceed Anyway',
        '❌ Cancel'
      );
    } else {
      askConfirm(
        "Confirm Payment Posting",
        `Are you sure you want to post a payment of ₱${paymentAmount.toLocaleString()} for ${loan.borrowerName}?`,
        confirmSubmit,
        'info'
      );
    }
  };

  const handleVerifyOR = () => {
    setError('');
    setSuccess('');
    setRevLoan(null);
    setRevPayment(null);

    if (!revOrNumber.trim()) {
      setError('Please enter an OR Number.');
      return;
    }

    setIsVerifying(true);
    // Simulate a small delay for better UX
    setTimeout(() => {
      const result = store.getPaymentByOR(revOrNumber);
      setIsVerifying(false);

      if (!result) {
        askConfirm(
          "OR Number Not Found",
          "The OR Number you entered does not exist in our records. Please verify the number and try again.",
          () => { }, // Just close
          'warning'
        );
        return;
      }

      setRevLoan(result.loan);
      setRevPayment(result.payment);
    }, 300);
  };

  const confirmReverse = async () => {
    if (!revOrNumber.trim()) return;

    try {
      const result = await store.reversePayment(revOrNumber, revReason, currentUser.username, currentUser.role);
      if (result.success) {
        showSuccess(result.message);
        setRevOrNumber('');
        setRevReason('');
        setRevLoan(null);
        setRevPayment(null);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reverse payment.");
    }
  };

  const handleReverse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revPayment || revPayment.status === PaymentStatus.REVERSED || !revReason.trim()) return;

    askConfirm(
      "Confirm Reversal",
      `Are you sure you want to reverse this payment of ₱${revPayment.amount.toLocaleString()}? This action will roll back the financial impact.`,
      confirmReverse,
      'danger'
    );
  };

  // Tab switching handled by props now

  // Auditory Feedback Utility (Browser-Native Ping)
  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    playSuccessSound();
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fadeIn pb-20 relative">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-8 items-start">
        
        {/* MAIN PANEL (LEFT) */}
        <div className="space-y-8">
          {activeTab === 'post' ? (
            <div className={`animate-slideUp ${loan ? 'grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start' : 'space-y-8'}`}>
              <div className={loan ? 'space-y-6 xl:sticky xl:top-24' : ''}>
              
              {/* STEP 1: LOOKUP CLIENT CARD */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-emerald-900/20">1</div>
                   <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300">Step 1: Find Client</h3>
                </div>

                <div className="relative">
                  <div className="flex flex-col sm:flex-row items-stretch gap-3 p-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus-within:border-emerald-500 transition-all duration-300 group">
                    <div className="flex items-center pl-3">
                      <svg className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                      ref={codeRef}
                      type="text"
                      placeholder="Enter Client Code (e.g. 101010)"
                      className="min-w-0 flex-1 bg-transparent border-none focus:ring-0 font-bold text-base text-slate-800 dark:text-white py-3 transition-colors duration-300"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isVerifying || isSaving}
                      className="px-6 py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying ? 'Wait...' : 'Verify'}
                    </button>
                  </div>
                  {error && (
                    <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/40 rounded-xl animate-shake">
                      <span className="text-xl">⚠️</span>
                      <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                </div>
              </div>

              {loan && (
                <>
                  
                  {/* STEP 2: CLIENT INFO SUMMARY */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[1.5rem] shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-black">2</div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300">Step 2: Client Profile</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Borrower Name</p>
                        <p className="text-base font-black text-slate-800 dark:text-white leading-tight">{loan.borrowerName}</p>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 transition-colors duration-300">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Running Balance</p>
                        <div className="flex flex-col min-h-[42px]">
                          <p className={`text-xl font-black transition-colors duration-300 ${isFullyPaid ? 'text-emerald-500 scale-105' : 'text-red-600'}`}>
                            ₱{previewBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </p>
                          {isFullyPaid && (
                            <span className="mt-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-emerald-200 animate-fadeIn flex items-center gap-1 shadow-sm">
                              ✨ Fully Paid
                            </span>
                          )}
                          {isOverpaid && (
                            <span className="mt-1 bg-red-100 text-red-700 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-red-200 animate-pulse flex items-center gap-1 shadow-sm">
                              ⚠️ Overpayment (₱{Math.abs(previewBalanceRaw).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-1">👤 COLLECTOR</p>
                        <p className="text-base font-black text-slate-800 dark:text-slate-300 truncate">{loan.collector || 'Unassigned'}</p>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Location Status</p>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${loan.location === 'LOCATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {loan.location}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              </div>

              {loan && (
                <div className="animate-slideUp">
                  {/* STEP 3: PAYMENT INPUT */}
                  <div className="bg-white dark:bg-slate-800 p-6 lg:p-8 rounded-[1.75rem] shadow-2xl shadow-emerald-900/5 border-2 border-emerald-500/20 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-emerald-900/20">3</div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300">Step 3: Entry</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Payment Amount (PHP)</label>
                          <div className="flex gap-2">
                             {[100, 500, 1000].map(val => (
                               <button
                                type="button"
                                key={val}
                                onClick={() => setAmount(val.toString())}
                                className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-[10px] font-black text-slate-600 dark:text-slate-300 rounded-lg hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                               >
                                 +{val}
                               </button>
                             ))}
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-300 dark:text-emerald-700">₱</span>
                          <input
                            ref={amountRef}
                            type="text"
                            inputMode="decimal"
                            required
                            className="w-full pl-14 pr-8 py-8 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-3xl focus:border-emerald-500 focus:ring-0 font-black text-5xl text-emerald-600 dark:text-emerald-400 transition-all duration-300 placeholder:text-slate-200"
                            placeholder="0"
                            autoComplete="off"
                            value={amount}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setAmount('');
                                return;
                              }
                              if (val === '.') {
                                setAmount('0.');
                                return;
                              }
                              const regex = /^\d*\.?\d{0,2}$/;
                              if (regex.test(val)) {
                                setAmount(val);
                              }
                            }}
                          />
                        </div>
                        {false && typedAmount > 0 && (
                          <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/40 animate-slideUp">
                             <span className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest">Calculated New Balance:</span>
                             <span className={`font-black text-lg ${previewBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                               ₱{previewBalance.toLocaleString()}
                             </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Effective Date</label>
                          <input
                            type="date"
                            required
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700 dark:text-slate-300 transition-all duration-300"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Processing Agent</label>
                          <div className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 dark:text-slate-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <span className="text-lg">👤</span> {currentUser.username}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Collection Remarks</label>
                        <textarea
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-slate-800 dark:text-white transition-colors duration-300"
                          rows={3}
                          placeholder="Collector notes or specific receipt details..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-6 bg-emerald-600 text-white font-black text-lg rounded-[2rem] hover:bg-emerald-700 transition-all duration-300 shadow-xl shadow-emerald-900/20 hover:-translate-y-1 active:scale-95 uppercase tracking-[0.25em]"
                      >
                        ✅ Post Payment Now
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-slideUp">
              {/* REVERSE PAYMENT UI */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-red-900/20">!</div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300">Audit: Reverse Transaction</h3>
                </div>

                <div className="relative group">
                  <div className="flex items-stretch gap-4 p-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus-within:border-red-500 transition-all duration-300">
                    <div className="flex items-center pl-3">
                      <svg className="w-5 h-5 text-slate-400 group-focus-within:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <input
                      ref={revOrRef}
                      type="text"
                      placeholder="Enter OR Number to verify..."
                      className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-lg text-slate-800 dark:text-white py-3 transition-colors duration-300"
                      value={revOrNumber}
                      onChange={(e) => setRevOrNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleVerifyOR())}
                    />
                    <button
                      onClick={handleVerifyOR}
                      disabled={isVerifying}
                      className="px-8 bg-slate-800 text-white font-black rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      {isVerifying ? 'Verifying...' : 'Search'}
                    </button>
                  </div>
                </div>

                {isVerifying && (
                  <div className="mt-8 flex flex-col items-center justify-center py-12 animate-pulse">
                     <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Searching Transaction History...</p>
                  </div>
                )}

                {!isVerifying && revPayment && revLoan && (
                  <div className="mt-8 space-y-8 animate-slideUp">
                    <div className="bg-red-50 dark:bg-red-900/10 p-8 rounded-[2rem] border border-red-100 dark:border-red-900/40">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                           <p className="text-[9px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Transaction Data</p>
                           <h4 className="text-xl font-black text-slate-800 dark:text-white">{revLoan.borrowerName}</h4>
                           <span className="text-xs font-bold text-slate-500">{revLoan.code} • {revLoan.branch}</span>
                        </div>
                        <div className="text-right">
                           <p className="text-[11px] font-black text-red-600 tracking-wider">₱{revPayment.amount.toLocaleString()}</p>
                           <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">{revPayment.date}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-red-100/50 shadow-sm transition-colors duration-300">
                        <InfoSmall label="Collector" value={revLoan.collector} />
                        <InfoSmall label="Receipt OR" value={revPayment.orNumber} />
                        <InfoSmall 
                          label="Current Status" 
                          value={revPayment.status === 'GOOD' ? 'ACTIVE' : 'ALREADY REVERSED'} 
                          color={revPayment.status === 'GOOD' ? 'text-emerald-600' : 'text-red-500'}
                        />
                         <InfoSmall label="Processed by" value={currentUser.username} />
                      </div>

                      <div className="mt-6 space-y-4">
                         <label className="block text-[10px] font-black text-red-800/60 uppercase tracking-widest px-1">Reason for reversal required *</label>
                         <textarea
                          className="w-full px-6 py-4 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl focus:ring-2 focus:ring-red-500 font-medium text-sm text-slate-800 dark:text-white transition-colors duration-300"
                          rows={2}
                          placeholder="State why this record must be rolled back..."
                          value={revReason}
                          onChange={(e) => setRevReason(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleReverse}
                        disabled={!revReason.trim() || revPayment.status === 'REVERSED'}
                        className="w-full mt-8 py-5 bg-red-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-red-700 transition-all duration-300 shadow-xl shadow-red-900/20 active:scale-95 disabled:opacity-30 disabled:grayscale"
                      >
                        ⚠️ Authenticate & Reverse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIDE BAR (RIGHT) */}
        <div className="space-y-8">
           <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl shadow-slate-900/5 border border-slate-200 dark:border-slate-700 transition-colors duration-300 sticky top-24">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Recent Posts</h3>
                </div>
                {recentPosts.length > 0 && (
                   <button 
                    onClick={() => { setRecentPosts([]); localStorage.removeItem('melann_recent_payments'); }}
                    className="text-[9px] font-black text-slate-300 hover:text-red-500 transition-colors uppercase"
                   >
                     Clear
                   </button>
                )}
              </div>

              {recentPosts.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 text-center transition-colors duration-300">
                  <span className="text-4xl filter grayscale opacity-20 mb-4">💸</span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No recent payments yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPosts.map((post, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRecentPostClick(post)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group hover:border-emerald-500 hover:-translate-y-1 hover:shadow-lg ${idx === 0 ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}
                    >
                       <div className="flex justify-between items-start mb-2 group">
                          <div className="min-w-0 flex-1 pr-4">
                             <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-1">
                                {new Date(post.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </p>
                             <h4 className="font-black text-slate-800 dark:text-white text-xs truncate group-hover:text-emerald-600 transition-colors">{post.borrowerName}</h4>
                          </div>
                          <div className="shrink-0 text-right">
                             <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₱{post.amount.toLocaleString()}</p>
                          </div>
                       </div>
                       <div className="flex justify-between items-center text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300 border-t border-slate-200/30 dark:border-slate-700/30 pt-2">
                          <span>{post.code}</span>
                          <span className="text-emerald-600/50">{post.collector}</span>
                       </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                 <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                   Audit Protection
                 </h4>
                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300">
                    Multiple same-day payments for the same client will trigger a duplicate warning.
                 </p>
              </div>
           </div>
        </div>

      </div>

      {/* FLOATING SUCCESS TOAST */}
      {success && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-emerald-900/40 border border-emerald-400 flex items-center gap-4 min-w-[320px]">
             <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl animate-pulse">🎉</div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-0.5">Payment Posted Successfully</p>
                <p className="text-xs font-bold">{success}</p>
             </div>
             <button 
              onClick={() => setSuccess('')}
              className="ml-auto w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
             >
                ✕
             </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={closeConfirm}
        type={confirmConfig.type}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel={confirmConfig.cancelLabel}
      />
    </div>
  );
};

const InfoSmall: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-slate-700 dark:text-slate-300' }) => (
  <div>
    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors duration-300">{label}</p>
    <p className={`text-xs font-bold ${color} transition-colors duration-300`}>{value}</p>
  </div>
);

export default PaymentForm;
