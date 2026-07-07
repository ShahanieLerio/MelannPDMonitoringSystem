
import React, { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info' | 'success';
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    confirmText?: string;
    cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    type = 'warning',
    variant,
    confirmLabel,
    cancelLabel,
    confirmText,
    cancelText
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const modalType = variant || type;
    const confirmButtonText = confirmLabel ?? confirmText ?? 'Yes';
    const cancelButtonText = cancelLabel ?? cancelText ?? 'No';

    useEffect(() => {
        if (isOpen) {
            modalRef.current?.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel, onConfirm]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (modalType) {
            case 'danger': return '!';
            case 'success': return 'OK';
            case 'info': return 'i';
            default: return '!';
        }
    };

    const getButtonStyles = () => {
        switch (modalType) {
            case 'danger': return 'danger bg-red-600 hover:bg-red-700 shadow-red-900/10';
            case 'success': return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10';
            case 'info': return 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/10';
            default: return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10';
        }
    };

    const getIconContainerStyles = () => {
        switch (modalType) {
            case 'danger': return 'bg-red-50 text-red-500';
            case 'success': return 'bg-emerald-50 text-emerald-500';
            case 'info': return 'bg-blue-50 text-blue-500';
            default: return 'bg-amber-50 text-amber-500';
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn outline-none"
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                }
            }}
            tabIndex={0}
            ref={modalRef}
        >
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slideUp border border-white/20 p-8 space-y-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto ${getIconContainerStyles()}`}>
                    {getIcon()}
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-slate-800">{title}</h3>
                    <div className="text-sm text-slate-500 font-medium">
                        {message}
                    </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                    <button
                        onClick={onConfirm}
                        autoFocus
                        className={`w-full py-4 text-white font-black rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl shadow-md active:scale-95 uppercase tracking-widest text-[10px] ${getButtonStyles()}`}
                    >
                        {confirmButtonText}
                    </button>
                    {cancelButtonText !== '' && (
                    <button
                        onClick={onCancel}
                        className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]"
                    >
                        {cancelButtonText}
                    </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
