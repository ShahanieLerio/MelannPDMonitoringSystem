import React, { useState } from 'react';
import { Loan, User, DispositionType, DispositionStatus } from '../types.ts';
import { store } from '../services/dataStore.ts';
import SuccessModal from './SuccessModal.tsx';

interface ManagementDispositionModalProps {
  loan: Loan;
  currentUser: User;
  onClose: () => void;
}

const EVIDENCE_OPTIONS = [
  'Collector visit confirms no activity',
  'Client unreachable',
  'Claims already paid',
  'Deceased borrower',
  'Business closed',
  'Relocated/Not located'
];

const ManagementDispositionModal: React.FC<ManagementDispositionModalProps> = ({ loan, currentUser, onClose }) => {
  const [type, setType] = useState<DispositionType | ''>('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [managementName, setManagementName] = useState(currentUser.fullName || currentUser.username);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState<string | null>(null);

  const toggleEvidence = (ev: string) => {
    setEvidence(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const handleSubmit = async () => {
    if (!type) {
      setErrorFeedback('Please select a disposition type.');
      return;
    }
    if (!reason.trim()) {
      setErrorFeedback('Please provide a reason or justification.');
      return;
    }

    if (!managementName.trim()) {
      setErrorFeedback('Please provide the name of the deciding management officer.');
      return;
    }

    setIsSubmitting(true);
    setErrorFeedback(null);

    try {
      await store.addDisposition(loan.id, type as DispositionType, reason, evidence, managementName.trim(), currentUser.role);
      
      // Auto-update Lifecycle Stage if applicable
      const stageMap: Record<DispositionType, string> = {
          [DispositionType.PROSPECT_WRITE_OFF]: 'For Write-Off',
          [DispositionType.RECOMMEND_LEGAL]: 'For Legal Action',
          [DispositionType.FOR_RESTRUCTURING]: 'Active / Cooperative', // or specific
          [DispositionType.SETTLEMENT_NEGOTIATION]: 'Non-Cooperative',
          [DispositionType.RETAIN_COLLECTION]: 'Needs Follow-Up',
          [DispositionType.DEAD_ACCOUNT]: 'For Write-Off' // Dead account often leads to write-off
      };

      const mappedStage = stageMap[type as DispositionType];
      
      const updatedLoan = { 
          ...loan, 
          actionStage: mappedStage, 
          actionNote: `Management Disposition: ${type} - ${reason}`
      };
      await store.updateLoan(loan.id, updatedLoan, currentUser.username, currentUser.role);

      setShowSuccess(true);
    } catch (err: any) {
      console.error('Failed to submit disposition:', err);
      setShowErrorPopup(err.message || 'Failed to save disposition. Please check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <SuccessModal
        isOpen={true}
        title="Decision Recorded"
        message={`The account has been tagged for "${type}". Status is Pending Review.`}
        onConfirm={onClose}
      />
    );
  }

  if (showErrorPopup) {
    return (
      <SuccessModal
        isOpen={true}
        type="error"
        title="Submission Failed"
        message={showErrorPopup}
        onConfirm={() => setShowErrorPopup(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[70] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              Management Disposition
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{loan.borrowerName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorFeedback && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/50">
              {errorFeedback}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deciding Management Officer</label>
            <input 
              type="text"
              value={managementName} 
              onChange={e => setManagementName(e.target.value)}
              placeholder="e.g., Sir Alvin, Ma'am Melann, Board of Directors"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Disposition Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as DispositionType)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="">-- Select Decision --</option>
              {Object.values(DispositionType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reason / Justification</label>
            <textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              placeholder="Provide context for this management decision..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 min-h-[100px] resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Supporting Evidence</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EVIDENCE_OPTIONS.map(ev => (
                <label key={ev} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={evidence.includes(ev)} 
                    onChange={() => toggleEvidence(ev)}
                    className="w-4 h-4 text-rose-500 rounded focus:ring-rose-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{ev}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Saving...' : 'Submit Decision'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ManagementDispositionModal;
