
import React from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  type?: 'success' | 'error';
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }[];
  autoRedirectLabel?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  type = 'success',
  actions,
  autoRedirectLabel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={() => {
          if (actions && actions.length > 0) return; // Prevent backdrop click if multiple actions exist
          if (onConfirm) onConfirm();
        }}
      ></div>
      
      {/* Modal Card */}
      <div className="bg-white w-full max-w-sm rounded-[20px] shadow-2xl relative overflow-hidden animate-in zoom-in-95 fade-in duration-300 border border-gray-100 p-8 flex flex-col items-center text-center">
        
        {/* Icon Container */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${type === 'success' ? 'bg-emerald-50 text-[#10B981]' : 'bg-red-50 text-red-500'}`}>
          {type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </div>

        {/* Text Content */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          {message}
        </p>

        {autoRedirectLabel && (
          <p className="text-[11px] text-gray-400 font-medium mb-6 italic animate-pulse">
            {autoRedirectLabel}
          </p>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          {actions && actions.length > 0 ? (
            actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-md active:scale-95 ${
                  action.variant === 'secondary' 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-none'
                    : action.variant === 'outline'
                    ? 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 shadow-none'
                    : type === 'success' 
                    ? 'bg-[#10B981] text-white hover:bg-[#059669] shadow-emerald-200' 
                    : 'bg-red-500 text-white hover:bg-red-600 shadow-red-200'
                }`}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button
              onClick={onConfirm}
              className={`w-full py-3.5 font-bold text-white rounded-xl transition-all shadow-md active:scale-95 ${type === 'success' ? 'bg-[#10B981] hover:bg-[#059669] shadow-emerald-200' : 'bg-red-500 hover:bg-red-600 shadow-red-200'}`}
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
