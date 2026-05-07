
import React, { useState, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Collector, Branch } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface CollectorsProps {
  selectedBranch: Branch;
}

const Collectors: React.FC<CollectorsProps> = ({ selectedBranch }) => {
  const [collectors, setCollectors] = useState(store.getCollectors(selectedBranch));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'warning') => {
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

  const refresh = () => setCollectors(store.getCollectors(selectedBranch));

  useEffect(() => {
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => unsubscribe();
  }, [selectedBranch]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const branchToUse = selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch;

    const finalName = name.trim();
    const finalNick = nickname.trim().toUpperCase();

    try {
      if (editingCollector) {
        await store.updateCollector(editingCollector.id, finalName, branchToUse, address.trim(), finalNick);
        showSuccess("Collector successfully updated!");
      } else {
        await store.addCollector(finalName, branchToUse, address.trim(), finalNick);
        showSuccess("Collector successfully added!");
      }
      closeModal();
      refresh();
    } catch (error) {
      console.error('Failed to save collector:', error);
    }
  };

  const handleDelete = (id: string, name: string) => {
    askConfirm(
      "Are you sure you want to delete this record?",
      `Personnel "${name}" will be removed from active selection. Historical links will remain for auditing.`,
      () => {
        store.deleteCollector(id);
        refresh();
      },
      'danger'
    );
  };

  const openModal = (c?: Collector) => {
    if (c) {
      setEditingCollector(c);
      setName(c.name);
      setNickname(c.nickname || '');
      setAddress(c.address || '');
    } else {
      setEditingCollector(null);
      setName('');
      setNickname('');
      setAddress('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCollector(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn transition-colors duration-300">
      <div className="flex justify-between items-center transition-colors duration-300">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Personnel Management</h2>
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1 transition-colors duration-300">
            Displaying for: <span className="font-black text-slate-800 dark:text-slate-200">{selectedBranch}</span>
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-md shadow-emerald-900/10 dark:shadow-emerald-900/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Add Personnel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {collectors.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 group hover:border-emerald-500 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-900/10 dark:hover:shadow-emerald-900/20">
            <div className="flex justify-between items-start mb-3 transition-colors duration-300">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-base group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                {c.name.charAt(0)}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(c)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all active:scale-90">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all active:scale-90">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>
            <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight transition-colors duration-300">{c.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5 transition-colors duration-300">
              {c.nickname && <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded transition-colors duration-300">@{c.nickname}</span>}
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border border-slate-100 dark:border-slate-700 px-1.5 py-0.5 rounded transition-colors duration-300">{c.branch}</span>
            </div>
            {c.address && (
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-[12px] font-medium flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                <svg className="w-3.5 h-3.5 shrink-0 text-slate-300 dark:text-slate-600 mt-0.5 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                <span className="leading-snug">{c.address}</span>
              </p>
            )}
          </div>
        ))}
        {collectors.length === 0 && (
          <div className="col-span-full py-12 bg-white dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center transition-colors duration-300">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center text-2xl mb-3 transition-colors duration-300">👥</div>
            <p className="font-bold text-slate-400 dark:text-slate-500 italic text-sm transition-colors duration-300">No field personnel records in {selectedBranch}.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn transition-colors duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl relative overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700 transition-colors duration-300">
            <div className="bg-[#064e3b] dark:bg-slate-800 p-10 text-white transition-colors duration-300">
              <h2 className="text-2xl font-black tracking-tight">{editingCollector ? 'Update Record' : 'Enroll Personnel'}</h2>
              <p className="text-emerald-100/60 dark:text-emerald-400/60 text-xs font-bold uppercase tracking-widest mt-1 transition-colors duration-300">Assigning to: {selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch}</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Full Identity Name</label>
                <input
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-black text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Active Nickname (Short)</label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-black text-emerald-600 dark:text-emerald-400 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={nickname}
                  onChange={e => setNickname(e.target.value.toUpperCase())}
                  placeholder="e.g. ALDIE"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Deployment Description</label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 dark:text-slate-300 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  rows={3}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Specified branch, area, or base location..."
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button onClick={closeModal} className="flex-1 py-4 font-black text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Cancel</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 dark:shadow-emerald-900/50 hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all uppercase tracking-widest text-[10px] active:scale-95">Verify & Save</button>
              </div>
            </div>
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
      />

      {successMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp border border-emerald-500/50">
          <div className="bg-white/20 p-1.5 rounded-full">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <p className="font-black text-sm tracking-wide">{successMessage}</p>
        </div>
      )}
    </div>
  );
};

export default Collectors;
