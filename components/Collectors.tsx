
import React, { useState, useEffect, useMemo } from 'react';
import { store } from '../services/dataStore.ts';
import { Collector, Supervisor, Branch } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface CollectorsProps {
  selectedBranch: Branch;
}

const Collectors: React.FC<CollectorsProps> = ({ selectedBranch }) => {
  const [activeTab, setActiveTab] = useState<'collector' | 'supervisor'>('collector');

  // Collectors state
  const [collectors, setCollectors] = useState(store.getCollectors(selectedBranch));
  const [isCollectorModalOpen, setIsCollectorModalOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [assignedSupervisor, setAssignedSupervisor] = useState('');
  const [collectorBranch, setCollectorBranch] = useState<Branch>(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
  const [photoUrl, setPhotoUrl] = useState('');

  // Supervisors state
  const [supervisors, setSupervisors] = useState(store.getSupervisors(selectedBranch));
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorBranch, setSupervisorBranch] = useState<Branch>(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
  const [supervisorNickname, setSupervisorNickname] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [supervisorPhotoUrl, setSupervisorPhotoUrl] = useState('');

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

  const refresh = () => {
    setCollectors(store.getCollectors(selectedBranch));
    setSupervisors(store.getSupervisors(selectedBranch));
  };

  useEffect(() => {
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => unsubscribe();
  }, [selectedBranch]);

  const allSupervisors = useMemo(() => store.getSupervisors(Branch.ALL), [supervisors]);

  const arrangedCollectors = useMemo(() => {
    return collectors
      .map((collector, index) => ({ collector, index }))
      .sort((a, b) => {
        const aHasPhoto = Boolean(a.collector.photoUrl);
        const bHasPhoto = Boolean(b.collector.photoUrl);
        if (aHasPhoto === bHasPhoto) return a.index - b.index;
        return aHasPhoto ? -1 : 1;
      })
      .map(({ collector }) => collector);
  }, [collectors]);

  const arrangedSupervisors = useMemo(() => {
    return supervisors
      .map((supervisor, index) => ({ supervisor, index }))
      .sort((a, b) => {
        const aHasPhoto = Boolean(a.supervisor.photoUrl);
        const bHasPhoto = Boolean(b.supervisor.photoUrl);
        if (aHasPhoto === bHasPhoto) return a.index - b.index;
        return aHasPhoto ? -1 : 1;
      })
      .map(({ supervisor }) => supervisor);
  }, [supervisors]);

  // Collector actions
  const handleSaveCollector = async () => {
    if (!name.trim()) return;
    const branchToUse = selectedBranch === Branch.ALL ? collectorBranch : selectedBranch;

    const finalName = name.trim();
    const finalNick = nickname.trim().toUpperCase();
    const finalSupervisor = assignedSupervisor.trim();

    try {
      if (editingCollector) {
        await store.updateCollector(editingCollector.id, finalName, branchToUse, address.trim(), finalNick, photoUrl, finalSupervisor);
        showSuccess("Collector successfully updated!");
      } else {
        await store.addCollector(finalName, branchToUse, address.trim(), finalNick, photoUrl, finalSupervisor);
        showSuccess("Collector successfully added!");
      }
      closeCollectorModal();
      refresh();
    } catch (error) {
      console.error('Failed to save collector:', error);
    }
  };

  const handleDeleteCollector = (id: string, collectorName: string) => {
    askConfirm(
      "Are you sure you want to delete this record?",
      `Personnel "${collectorName}" will be removed from active selection. Historical links will remain for auditing.`,
      () => {
        store.deleteCollector(id);
        refresh();
      },
      'danger'
    );
  };

  const openCollectorModal = (c?: Collector) => {
    if (c) {
      setEditingCollector(c);
      setName(c.name);
      setNickname(c.nickname || '');
      setAddress(c.address || '');
      setAssignedSupervisor(c.assignedSupervisor || '');
      setCollectorBranch(c.branch);
      setPhotoUrl(c.photoUrl || '');
    } else {
      setEditingCollector(null);
      setName('');
      setNickname('');
      setAddress('');
      setAssignedSupervisor('');
      setCollectorBranch(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
      setPhotoUrl('');
    }
    setIsCollectorModalOpen(true);
  };

  const closeCollectorModal = () => {
    setIsCollectorModalOpen(false);
    setEditingCollector(null);
  };

  // Supervisor actions
  const handleSaveSupervisor = async () => {
    if (!supervisorName.trim()) return;
    const branchToUse = selectedBranch === Branch.ALL ? supervisorBranch : selectedBranch;

    try {
      if (editingSupervisor) {
        await store.updateSupervisor(
          editingSupervisor.id,
          supervisorName.trim(),
          branchToUse,
          supervisorNickname.trim().toUpperCase(),
          supervisorPhotoUrl,
          supervisorNotes.trim()
        );
        showSuccess("Supervisor successfully updated!");
      } else {
        await store.addSupervisor(
          supervisorName.trim(),
          branchToUse,
          supervisorNickname.trim().toUpperCase(),
          supervisorPhotoUrl,
          supervisorNotes.trim()
        );
        showSuccess("Supervisor successfully added!");
      }
      closeSupervisorModal();
      refresh();
    } catch (error) {
      console.error('Failed to save supervisor:', error);
    }
  };

  const handleDeleteSupervisor = (id: string, sName: string) => {
    askConfirm(
      "Are you sure you want to delete this supervisor?",
      `Supervisor "${sName}" will be removed. Collectors assigned to this supervisor will be unlinked.`,
      () => {
        store.deleteSupervisor(id);
        refresh();
      },
      'danger'
    );
  };

  const openSupervisorModal = (s?: Supervisor) => {
    if (s) {
      setEditingSupervisor(s);
      setSupervisorName(s.name);
      setSupervisorBranch(s.branch);
      setSupervisorNickname(s.nickname || '');
      setSupervisorNotes(s.notes || '');
      setSupervisorPhotoUrl(s.photoUrl || '');
    } else {
      setEditingSupervisor(null);
      setSupervisorName('');
      setSupervisorBranch(selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch);
      setSupervisorNickname('');
      setSupervisorNotes('');
      setSupervisorPhotoUrl('');
    }
    setIsSupervisorModalOpen(true);
  };

  const closeSupervisorModal = () => {
    setIsSupervisorModalOpen(false);
    setEditingSupervisor(null);
  };

  const handlePhotoUpload = (file: File | undefined, setTarget: (val: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTarget(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  // Get collectors assigned under a supervisor
  const getAssignedCollectorsForSupervisor = (sName: string, sBranch: Branch, sNickname?: string) => {
    return collectors.filter(c => {
      const assigned = (c.assignedSupervisor || '').trim().toUpperCase();
      if (!assigned) return false;
      const isMatched = assigned === sName.trim().toUpperCase() || (sNickname && assigned === sNickname.trim().toUpperCase());
      if (!isMatched) return false;
      return selectedBranch === Branch.ALL ? c.branch === sBranch : true;
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn transition-colors duration-300">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors duration-300">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Personnel Management</h2>
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1 transition-colors duration-300">
            Displaying for: <span className="font-black text-slate-800 dark:text-slate-200">{selectedBranch}</span>
          </p>
        </div>

        {/* Action Button */}
        <div>
          {activeTab === 'collector' ? (
            <button
              onClick={() => openCollectorModal()}
              className="bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-md shadow-emerald-900/10 dark:shadow-emerald-900/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Add Personnel
            </button>
          ) : (
            <button
              onClick={() => openSupervisorModal()}
              className="bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-md shadow-emerald-900/10 dark:shadow-emerald-900/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Add Supervisor
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-700 shadow-sm backdrop-blur">
        <button
          onClick={() => setActiveTab('collector')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'collector'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
              : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span className="text-base">👥</span>
          <span>Collector</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'collector' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}>
            {collectors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('supervisor')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'supervisor'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
              : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span className="text-base">👔</span>
          <span>Supervisor</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'supervisor' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}>
            {supervisors.length}
          </span>
        </button>
      </div>

      {/* COLLECTOR TAB CONTENT */}
      {activeTab === 'collector' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {arrangedCollectors.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 group hover:border-emerald-500 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-900/10 dark:hover:shadow-emerald-900/20">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt={c.name}
                      className="w-20 h-20 rounded-2xl object-cover object-top border-3 border-emerald-50 dark:border-emerald-900/50 shadow-md shadow-slate-900/10 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-emerald-200 dark:group-hover:border-emerald-700"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-2xl border-3 border-emerald-50 dark:border-emerald-900/50 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-end gap-1 mb-2">
                    <button onClick={() => openCollectorModal(c)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all active:scale-90">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onClick={() => handleDeleteCollector(c.id, c.name)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all active:scale-90">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight transition-colors duration-300">{c.name}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 transition-colors duration-300">
                    {c.nickname && <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded transition-colors duration-300">@{c.nickname}</span>}
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border border-slate-100 dark:border-slate-700 px-1.5 py-0.5 rounded transition-colors duration-300">{c.branch}</span>
                  </div>
                  {c.assignedSupervisor && (
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Supervisor: <span className="text-slate-800 dark:text-slate-100">{c.assignedSupervisor}</span>
                    </p>
                  )}
                </div>
              </div>
              {c.address && (
                <p className="mt-3 text-slate-500 dark:text-slate-400 text-[12px] font-medium flex items-start gap-1.5 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
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
      )}

      {/* SUPERVISOR TAB CONTENT */}
      {activeTab === 'supervisor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {arrangedSupervisors.map(s => {
            const supervisedCollectors = getAssignedCollectorsForSupervisor(s.name, s.branch, s.nickname);
            return (
              <div key={s.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 group hover:border-emerald-500 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-900/10 dark:hover:shadow-emerald-900/20">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-20 h-20 rounded-2xl object-cover object-top border-3 border-emerald-50 dark:border-emerald-900/50 shadow-md shadow-slate-900/10 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-emerald-200 dark:group-hover:border-emerald-700"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-2xl border-3 border-emerald-50 dark:border-emerald-900/50 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                        {s.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-end gap-1 mb-2">
                      <button onClick={() => openSupervisorModal(s)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all active:scale-90">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button onClick={() => handleDeleteSupervisor(s.id, s.name)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all active:scale-90">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                    <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight transition-colors duration-300">{s.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 transition-colors duration-300">
                      {s.nickname && (
                        <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded transition-colors duration-300">
                          @{s.nickname}
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border border-slate-100 dark:border-slate-700 px-1.5 py-0.5 rounded transition-colors duration-300">{s.branch}</span>
                    </div>
                  </div>
                </div>

                {/* Supervised collectors section */}
                <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                    <span>Under Supervision</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{supervisedCollectors.length} Collector(s)</span>
                  </div>
                  {supervisedCollectors.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {supervisedCollectors.map(col => (
                        <span key={col.id} className="text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
                          {col.nickname || col.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No assigned collectors yet.</p>
                  )}
                </div>

                {s.notes && (
                  <p className="mt-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-snug px-1">
                    {s.notes}
                  </p>
                )}
              </div>
            );
          })}
          {supervisors.length === 0 && (
            <div className="col-span-full py-12 bg-white dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center transition-colors duration-300">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center text-2xl mb-3 transition-colors duration-300">👔</div>
              <p className="font-bold text-slate-400 dark:text-slate-500 italic text-sm transition-colors duration-300">No supervisor records in {selectedBranch}.</p>
              <button
                onClick={() => openSupervisorModal()}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                + Add First Supervisor
              </button>
            </div>
          )}
        </div>
      )}

      {/* COLLECTOR MODAL */}
      {isCollectorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn transition-colors duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] rounded-[3rem] shadow-2xl relative overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700 transition-colors duration-300 flex flex-col">
            <div className="bg-[#064e3b] dark:bg-slate-800 p-8 text-white transition-colors duration-300">
              <h2 className="text-2xl font-black tracking-tight">{editingCollector ? 'Update Collector' : 'Enroll Collector'}</h2>
              <p className="text-emerald-100/60 dark:text-emerald-400/60 text-xs font-bold uppercase tracking-widest mt-1 transition-colors duration-300">
                Assigning to: {selectedBranch === Branch.ALL ? collectorBranch : selectedBranch}
              </p>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto">
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Collector preview"
                    className="w-20 h-20 rounded-3xl object-cover border-2 border-emerald-100 dark:border-emerald-900/50 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {(name || 'P').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Collector Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e.target.files?.[0], setPhotoUrl)}
                    className="w-full text-xs font-bold text-slate-500 dark:text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:text-white hover:file:bg-emerald-700"
                  />
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>

              {selectedBranch === Branch.ALL && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Branch</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    value={collectorBranch}
                    onChange={e => setCollectorBranch(e.target.value as Branch)}
                  >
                    <option value={Branch.NAVAL}>Naval Branch</option>
                    <option value={Branch.ORMOC}>Ormoc Branch</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Full Identity Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Active Nickname (Short) <span className="text-red-500">*</span></label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-black text-emerald-600 dark:text-emerald-400 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={nickname}
                  onChange={e => setNickname(e.target.value.toUpperCase())}
                  placeholder="e.g. ALDIE"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Assigned Supervisor</label>
                <div className="space-y-2">
                  {allSupervisors.length > 0 && (
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      value={assignedSupervisor}
                      onChange={e => setAssignedSupervisor(e.target.value)}
                    >
                      <option value="">-- Select from Registered Supervisors --</option>
                      {allSupervisors.map(s => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.branch})
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={assignedSupervisor}
                    onChange={e => setAssignedSupervisor(e.target.value)}
                    placeholder="Or type supervisor name..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Deployment Description</label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-slate-700 dark:text-slate-300 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  rows={2}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Specified branch, area, or base location..."
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button onClick={closeCollectorModal} className="flex-1 py-3.5 font-black text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Cancel</button>
                <button onClick={handleSaveCollector} className="flex-[2] py-3.5 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 dark:shadow-emerald-900/50 hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all uppercase tracking-widest text-[10px] active:scale-95">Verify & Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPERVISOR MODAL */}
      {isSupervisorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn transition-colors duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[92vh] rounded-[3rem] shadow-2xl relative overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700 transition-colors duration-300 flex flex-col">
            <div className="bg-[#064e3b] dark:bg-slate-800 p-8 text-white transition-colors duration-300">
              <h2 className="text-2xl font-black tracking-tight">{editingSupervisor ? 'Update Supervisor' : 'Enroll Supervisor'}</h2>
              <p className="text-emerald-100/60 dark:text-emerald-400/60 text-xs font-bold uppercase tracking-widest mt-1 transition-colors duration-300">
                Assigning to: {selectedBranch === Branch.ALL ? supervisorBranch : selectedBranch}
              </p>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto">
              <div className="flex items-center gap-4">
                {supervisorPhotoUrl ? (
                  <img
                    src={supervisorPhotoUrl}
                    alt="Supervisor preview"
                    className="w-20 h-20 rounded-3xl object-cover border-2 border-emerald-100 dark:border-emerald-900/50 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {(supervisorName || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Supervisor Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e.target.files?.[0], setSupervisorPhotoUrl)}
                    className="w-full text-xs font-bold text-slate-500 dark:text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:text-white hover:file:bg-emerald-700"
                  />
                  {supervisorPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setSupervisorPhotoUrl('')}
                      className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>

              {selectedBranch === Branch.ALL && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Branch</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    value={supervisorBranch}
                    onChange={e => setSupervisorBranch(e.target.value as Branch)}
                  >
                    <option value={Branch.NAVAL}>Naval Branch</option>
                    <option value={Branch.ORMOC}>Ormoc Branch</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Supervisor Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={supervisorName}
                  onChange={e => setSupervisorName(e.target.value)}
                  placeholder="e.g. Supervisor Jane Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Active Nickname (Short)</label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-black text-emerald-600 dark:text-emerald-400 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={supervisorNickname}
                  onChange={e => setSupervisorNickname(e.target.value.toUpperCase())}
                  placeholder="e.g. SUP-JANE"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 transition-colors duration-300">Notes / Scope of Supervision</label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-slate-700 dark:text-slate-300 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  rows={2}
                  value={supervisorNotes}
                  onChange={e => setSupervisorNotes(e.target.value)}
                  placeholder="e.g. In-charge of Naval field collectors and account tracking..."
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button onClick={closeSupervisorModal} className="flex-1 py-3.5 font-black text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Cancel</button>
                <button onClick={handleSaveSupervisor} className="flex-[2] py-3.5 bg-emerald-600 dark:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 dark:shadow-emerald-900/50 hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all uppercase tracking-widest text-[10px] active:scale-95">Verify & Save</button>
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
