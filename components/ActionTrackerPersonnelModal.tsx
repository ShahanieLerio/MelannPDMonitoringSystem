import React, { useState, useEffect } from 'react';
import { Branch, ActionPersonnel } from '../types.ts';
import { store } from '../services/dataStore.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface ActionTrackerPersonnelModalProps {
  isOpen: boolean;
  selectedBranch: Branch;
  onClose: () => void;
}

const DEFAULT_ROLES = [
  'Account Officer',
  'Field Collector',
  'Remedial Staff',
  'Supervisor',
  'Branch Manager',
  'Credit Investigator'
];

export const ActionTrackerPersonnelModal: React.FC<ActionTrackerPersonnelModalProps> = ({
  isOpen,
  selectedBranch,
  onClose
}) => {
  const [personnelList, setPersonnelList] = useState<ActionPersonnel[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<ActionPersonnel | null>(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [branch, setBranch] = useState<Branch>(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
  const [role, setRole] = useState(DEFAULT_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const refresh = () => {
    setPersonnelList(store.getActionPersonnel(selectedBranch));
  };

  useEffect(() => {
    if (isOpen) {
      refresh();
      const unsub = store.subscribe(refresh);
      return () => unsub();
    }
  }, [isOpen, selectedBranch]);

  if (!isOpen) return null;

  const filteredPersonnel = personnelList.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.nickname && p.nickname.toLowerCase().includes(term)) ||
      (p.role && p.role.toLowerCase().includes(term)) ||
      p.branch.toLowerCase().includes(term)
    );
  });

  const handleOpenAdd = () => {
    setEditingPersonnel(null);
    setName('');
    setNickname('');
    setBranch(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
    setRole(DEFAULT_ROLES[0]);
    setCustomRole('');
    setContactNumber('');
    setNotes('');
    setFeedback(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: ActionPersonnel) => {
    setEditingPersonnel(p);
    setName(p.name);
    setNickname(p.nickname || '');
    setBranch(p.branch);
    if (DEFAULT_ROLES.includes(p.role || '')) {
      setRole(p.role || DEFAULT_ROLES[0]);
      setCustomRole('');
    } else {
      setRole('Other');
      setCustomRole(p.role || '');
    }
    setContactNumber(p.contactNumber || '');
    setNotes(p.notes || '');
    setFeedback(null);
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setFeedback('Full Name is required.');
      return;
    }
    const finalRole = role === 'Other' ? customRole.trim() || 'Account Officer' : role;

    try {
      if (editingPersonnel) {
        await store.updateActionPersonnel(
          editingPersonnel.id,
          name.trim(),
          branch,
          nickname.trim().toUpperCase(),
          finalRole,
          contactNumber.trim(),
          notes.trim()
        );
      } else {
        await store.addActionPersonnel(
          name.trim(),
          branch,
          nickname.trim().toUpperCase(),
          finalRole,
          contactNumber.trim(),
          notes.trim()
        );
      }
      setIsEditModalOpen(false);
      refresh();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to save personnel.');
    }
  };

  const handleDelete = (id: string, pName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Personnel',
      message: `Are you sure you want to remove "${pName}" from the Action Tracker personnel list?`,
      onConfirm: async () => {
        await store.deleteActionPersonnel(id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-slideUp">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 md:p-8 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl border border-white/20 shadow-inner">
              👥
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">Action Tracker Personnel</h2>
              <p className="text-indigo-200/80 text-xs font-bold uppercase tracking-widest mt-0.5">
                Personnel Reference for Contact & Visit Logs • <span className="text-white">{selectedBranch}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Action Controls & Search */}
        <div className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder="Search personnel name, nickname, role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Add Personnel
          </button>
        </div>

        {/* Personnel Records Grid */}
        <div className="p-6 overflow-y-auto max-h-[55vh] space-y-3">
          {filteredPersonnel.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPersonnel.map(p => (
                <div
                  key={p.id}
                  className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-base shrink-0 border border-indigo-200/60 dark:border-indigo-800">
                      {(p.nickname || p.name).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-tight truncate">{p.name}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {p.nickname && (
                          <span className="text-[9px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest bg-indigo-100/80 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded">
                            @{p.nickname}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded">
                          {p.role || 'Account Officer'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          • {p.branch}
                        </span>
                      </div>
                      {p.notes && (
                        <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
                      title="Edit Personnel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
                      title="Delete Personnel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
              <div className="text-3xl mb-2">📋</div>
              <p className="font-bold text-slate-400 dark:text-slate-500 text-sm">No Action Tracker personnel added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add personnel names here so they appear in the Contact Log and Visit Log dropdowns.</p>
              <button
                onClick={handleOpenAdd}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                + Add First Personnel
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Done
          </button>
        </div>

        {/* Inner Add/Edit Personnel Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingPersonnel ? 'Edit Personnel' : 'Add New Personnel'}
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              {feedback && (
                <div className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs font-bold rounded-xl">
                  {feedback}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Active Nickname (Short)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JUAN"
                    value={nickname}
                    onChange={e => setNickname(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Branch
                    </label>
                    <select
                      value={branch}
                      onChange={e => setBranch(e.target.value as Branch)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={Branch.NAVAL}>Naval Branch</option>
                      <option value={Branch.ORMOC}>Ormoc Branch</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Role / Designation
                    </label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DEFAULT_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  </div>
                </div>

                {role === 'Other' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Specify Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Legal Assistant"
                      value={customRole}
                      onChange={e => setCustomRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Notes / Scope (Optional)
                  </label>
                  <textarea
                    placeholder="e.g. Assigned to Ormoc field visits and phone reminders..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md shadow-indigo-900/20 active:scale-95"
                >
                  Verify & Save
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
          type="danger"
        />
      </div>
    </div>
  );
};

export default ActionTrackerPersonnelModal;