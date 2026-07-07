import React, { useState, useEffect, useRef } from 'react';

interface SecureDeleteModalProps {
    isOpen: boolean;
    clientName: string;
    clientCode: string;
    outstandingBalance: number;
    onConfirm: () => void;
    onCancel: () => void;
}

const generateSecureCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const SecureDeleteModal: React.FC<SecureDeleteModalProps> = ({
    isOpen,
    clientName,
    clientCode,
    outstandingBalance,
    onConfirm,
    onCancel
}) => {
    const [secureCode, setSecureCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSecureCode(generateSecureCode());
            setInputCode('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isMatch = inputCode.trim().toUpperCase() === secureCode;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn outline-none"
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
                if (e.key === 'Enter' && isMatch) {
                    e.preventDefault();
                    onConfirm();
                }
            }}
            tabIndex={0}
        >
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl relative overflow-hidden animate-slideUp border border-red-100 dark:border-red-900/30">
                <div className="bg-red-50 dark:bg-red-900/20 p-6 flex items-center gap-4 border-b border-red-100 dark:border-red-900/30">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                        🛡️
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-red-700 dark:text-red-400 leading-tight">Secure Deletion</h3>
                        <p className="text-xs font-bold text-red-500/80 dark:text-red-400/80 uppercase tracking-wider">Restricted Action</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client</span>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{clientName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Code</span>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{clientCode}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Balance</span>
                            <span className="text-sm font-black text-red-600 dark:text-red-400">₱{outstandingBalance.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-slate-600 dark:text-slate-400 text-center font-medium">
                            To permanently delete this client, type the security code below to confirm.
                        </p>
                        
                        <div className="flex justify-center select-none">
                            <div className="bg-slate-100 dark:bg-slate-900 px-6 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 tracking-[0.5em] font-mono text-2xl font-black text-slate-800 dark:text-white">
                                {secureCode}
                            </div>
                        </div>

                        <input
                            ref={inputRef}
                            type="text"
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                            placeholder="Enter code here"
                            className={`w-full text-center tracking-[0.3em] font-mono font-bold text-lg p-4 rounded-xl border-2 outline-none transition-all duration-300 bg-white dark:bg-slate-800
                                ${isMatch 
                                    ? 'border-emerald-500 ring-4 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                                    : 'border-slate-200 dark:border-slate-700 focus:border-red-400 focus:ring-4 focus:ring-red-400/20 text-slate-800 dark:text-white'
                                }`}
                            maxLength={6}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!isMatch}
                            className={`flex-1 py-4 font-black rounded-xl transition-all duration-300 uppercase tracking-widest text-xs
                                ${isMatch 
                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 active:scale-95' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            Delete Client
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecureDeleteModal;
