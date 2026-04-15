
import React, { useState, useRef } from 'react';
import { store } from '../services/dataStore.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { User, Branch } from '../types.ts';

interface BackupRestoreProps {
    currentUser: User;
    selectedBranch: Branch;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ currentUser, selectedBranch }) => {
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ type: 'none', message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

    const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'warning') => {
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

    const handleBackup = () => {
        try {
            const data = store.exportData(currentUser, selectedBranch);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.href = url;
            link.download = `melann_backup_${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setStatus({ type: 'success', message: 'Backup file generated and download started.' });
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to generate backup.' });
        }
    };

    const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        askConfirm(
            "Are you sure you want to restore data?",
            "Restoring will overwrite all current data. This action cannot be undone.",
            () => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    const result = store.importData(content, currentUser, selectedBranch);
                    if (result.success) {
                        setStatus({ type: 'success', message: 'Data restored successfully. Refreshing application...' });
                        setTimeout(() => window.location.reload(), 2000);
                    } else {
                        setStatus({ type: 'error', message: result.message || 'Critical Error: Invalid backup file format.' });
                    }
                };
                reader.readAsText(file);
            },
            'danger'
        );

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-4xl mx-auto animate-fadeIn transition-colors duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                <div className="p-10 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">System Data Management</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium transition-colors duration-300">Securely backup your loan records or restore from a previous session.</p>
                </div>

                <div className="p-12 space-y-12">
                    {status.type !== 'none' && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-slideIn transition-colors duration-300 ${status.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/50' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${status.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <p className="text-sm font-bold uppercase tracking-wider">{status.message}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Backup Card */}
                        <div className="group p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2.5rem] hover:border-emerald-500/30 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-900/5 dark:hover:shadow-emerald-900/20">
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                📥
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-3 transition-colors duration-300">Create Data Backup</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8 transition-colors duration-300">Export all loan portfolios, payments, collector records, and demand letters into a encrypted JSON file for safekeeping.</p>
                            <button
                                onClick={handleBackup}
                                className="w-full py-4 bg-emerald-600 dark:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-emerald-900/20 dark:shadow-emerald-900/40"
                            >
                                Download Backup File
                            </button>
                        </div>

                        {/* Restore Card */}
                        <div className="group p-8 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2.5rem] hover:border-blue-500/30 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5 dark:hover:shadow-blue-900/20">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                📤
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-3 transition-colors duration-300">Restore from File</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8 transition-colors duration-300">Upload a previously exported backup file to synchronize the system. <span className="text-red-500 dark:text-red-400 font-bold transition-colors duration-300">Caution: This will overwrite current data.</span></p>
                            <label className="block w-full cursor-pointer">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleRestore}
                                    className="hidden"
                                    ref={fileInputRef}
                                />
                                <div className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl flex items-center justify-center font-black text-xs uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-slate-600 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20 dark:shadow-black/40 text-center">
                                    Select Backup File
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 p-8 rounded-[2rem] flex items-start gap-5 transition-colors duration-300">
                        <div className="text-3xl">⚠️</div>
                        <div>
                            <h4 className="font-black text-amber-800 dark:text-amber-400 uppercase text-xs tracking-widest mb-2 transition-colors duration-300">Important Security Note</h4>
                            <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed font-medium transition-colors duration-300">Backup files contain highly sensitive financial data and borrower information. Ensure all exports are stored in secure, encrypted environments. Never share backup files through unencrypted channels.</p>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={closeConfirm}
                type={confirmConfig.type}
            />
        </div>
    );
};

export default BackupRestore;
