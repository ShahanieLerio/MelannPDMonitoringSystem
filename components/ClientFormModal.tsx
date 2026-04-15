
import React, { useState, useEffect } from 'react';
import { Loan, LocationStatus, MovingStatus, Branch, User, Collector } from '../types.ts';
import { store } from '../services/dataStore.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import SuccessModal from './SuccessModal.tsx';

interface ClientFormModalProps {
  loan?: Loan;
  currentUser: User;
  selectedBranch: Branch;
  onClose: () => void;
  onViewProfile?: (loan: Loan) => void;
}

const ClientFormModal: React.FC<ClientFormModalProps> = ({ loan, currentUser, selectedBranch, onClose, onViewProfile }) => {
  const isEdit = !!loan;
  const [formData, setFormData] = useState({
    code: '',
    firstName: '',
    lastName: '',
    monthReported: '',
    dueDate: '',
    outstandingBalance: '' as string | number,
    area: '',
    city: '',
    barangay: '',
    fullAddress: '',
    location: LocationStatus.LOCATED,
    status: MovingStatus.MOVING,
    collector: '',
    contactNumber: '',
    branch: Branch.NAVAL as Branch,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [allCollectors, setAllCollectors] = useState<Collector[]>(store.getCollectors(Branch.ALL));
  const [warningConfig, setWarningConfig] = useState({
    isOpen: false,
    message: '',
    type: 'warning' as 'warning' | 'danger' | 'info',
    showViewProfile: false,
    targetLoan: null as Loan | null
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successConfig, setSuccessConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    // Sync collectors list with store
    const unsubscribe = store.subscribe(() => {
      setAllCollectors(store.getCollectors(Branch.ALL));
    });

    if (loan) {
      // Resolve nickname if stored as full name (legacy)
      const currentCollectors = store.getCollectors(Branch.ALL);
      const collectorNick = currentCollectors.find(c => c.name === loan.collector || c.nickname === loan.collector)?.nickname || loan.collector;

      setFormData({
        code: loan.code,
        firstName: loan.firstName,
        lastName: loan.lastName,
        monthReported: loan.monthReported,
        dueDate: loan.dueDate,
        outstandingBalance: loan.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
        area: loan.area,
        city: loan.city,
        barangay: loan.barangay,
        fullAddress: loan.fullAddress,
        location: loan.location,
        status: loan.status,
        collector: collectorNick,
        contactNumber: loan.contactNumber || '',
        branch: loan.branch,
      });
    } else {
      setFormData(prev => ({
        ...prev,
        branch: selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch
      }));
    }

    return () => unsubscribe();
  }, [loan, selectedBranch]);

  const handleCodeChange = (val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
      setFormData({ ...formData, code: val });
      setFieldErrors(prev => ({ ...prev, code: '' }));
    } else {
      setFieldErrors(prev => ({ ...prev, code: 'Client Code must be PURE NUMBERS ONLY (digits 0-9)' }));
    }
  };

  const handleContactChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 11) {
      let formatted = digits;
      if (digits.length > 7) {
        formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      } else if (digits.length > 4) {
        formatted = `${digits.slice(0, 4)} ${digits.slice(4)}`;
      }
      setFormData({ ...formData, contactNumber: formatted });
      if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
        setFieldErrors(prev => ({ ...prev, contactNumber: 'Contact Number must be 10-11 digits' }));
      } else {
        setFieldErrors(prev => ({ ...prev, contactNumber: '' }));
      }
    }
  };

  const handleBalanceChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    
    setFieldErrors(prev => ({ ...prev, outstandingBalance: '' }));
    setFormData({ ...formData, outstandingBalance: clean });
  };

  const formatWithCommas = (val: string | number) => {
    const s = val.toString();
    if (!s) return '';
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };


  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.code) errors.code = 'Client Code is required';
    if (!/^\d+$/.test(formData.code)) errors.code = 'Client Code must contain only numbers';
    
    if (!formData.firstName.trim()) errors.firstName = 'First Name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last Name is required';
    
    if (!formData.monthReported) errors.monthReported = 'Reporting month is required';
    if (!formData.dueDate) errors.dueDate = 'Due Date is required';
    
    const balance = parseFloat(formData.outstandingBalance.toString().replace(/,/g, ''));
    if (isNaN(balance) || balance < 0) errors.outstandingBalance = 'Valid initial balance is required';

    if (!formData.area.trim()) errors.area = 'Area is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.barangay.trim()) errors.barangay = 'Barangay is required';
    if (!formData.fullAddress.trim()) errors.fullAddress = 'Detailed address is required';

    const inputCollector = formData.collector.trim().toUpperCase();
    const collectorMatch = allCollectors.find(c =>
      (c.nickname && c.nickname.trim().toUpperCase() === inputCollector) ||
      (c.name && c.name.trim().toUpperCase() === inputCollector)
    );
    if (!formData.collector.trim()) errors.collector = 'Collector assignment is required';
    else if (!collectorMatch) errors.collector = 'Collector not found';

    const digits = formData.contactNumber.replace(/\D/g, '');
    if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
      errors.contactNumber = 'Contact Number must be 10-11 digits';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Find the first invalid field and scroll to it
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setFormData({
      code: '',
      firstName: '',
      lastName: '',
      monthReported: '',
      dueDate: '',
      outstandingBalance: '',
      area: '',
      city: '',
      barangay: '',
      fullAddress: '',
      location: LocationStatus.LOCATED,
      status: MovingStatus.MOVING,
      collector: '',
      contactNumber: '',
      branch: selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch
    });
    setFieldErrors({});
    setSuccessConfig(prev => ({ ...prev, isOpen: false }));
  };

  // ⏱️ Auto-redirect Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (successConfig.isOpen && successConfig.type === 'success' && !isEdit) {
      timer = setTimeout(() => {
        onClose();
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [successConfig.isOpen, successConfig.type, isEdit, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setSuccessConfig({
        isOpen: true,
        title: 'Missing Required Fields',
        message: 'Please fill in all required fields and check for invalid input formats highlighted below.',
        type: 'error'
      });
      return;
    }

    // 🔍 Duplicate Record Detection Rule (Pre-check)
    if (!isEdit) {
      const allLoans = store.getLoans(Branch.ALL);
      const activeLoan = allLoans.find(l => l.code === formData.code && l.status !== MovingStatus.PAID);

      if (activeLoan) {
        setFieldErrors(prev => ({ ...prev, code: 'Client Code already exists as an active record' }));
        setWarningConfig({
          isOpen: true,
          message: "A client with this Client Code already exists as an active record. Please use a different code or close the existing record first.",
          type: 'danger',
          showViewProfile: true,
          targetLoan: activeLoan
        });
        return;
      }
    }

    const input = formData.collector.trim().toUpperCase();
    const collectorMatch = allCollectors.find(c =>
      (c.nickname && c.nickname.trim().toUpperCase() === input) ||
      (c.name && c.name.trim().toUpperCase() === input)
    )!; // We know it exists because validateForm passed

    // Always prioritize storing the Nickname if it exists
    const finalData = {
      ...formData,
      outstandingBalance: parseFloat(formData.outstandingBalance.toString().replace(/,/g, '')) || 0,
      collector: collectorMatch.nickname || collectorMatch.name
    };

    const performSave = async () => {
      setIsSaving(true);
      try {
        if (isEdit && loan) {
          await store.updateLoan(loan.id, finalData, currentUser.username, currentUser.role);
          setSuccessConfig({
            isOpen: true,
            title: 'Client Record Updated',
            message: 'The client record has been successfully updated in the system.',
            type: 'success'
          });
        } else {
          await store.addLoan(finalData, currentUser.username, currentUser.role);
          setSuccessConfig({
            isOpen: true,
            title: 'Client Successfully Created',
            message: 'The client has been successfully registered in the system.',
            type: 'success'
          });
        }
      } catch (err: any) {
        console.error('Failed to save client:', err);
        
        let errorTitle = 'Server Error';
        let errorMessage = err.message || 'Something went wrong while connecting to the server. Please try again.';
        
        // Handle specific server-side errors
        if (err.message.includes('409') || err.message.includes('already exists')) {
          errorTitle = 'Client Already Exists';
          errorMessage = 'A client with this Client Code already exists in the system. Please use a unique code.';
          setFieldErrors(prev => ({ ...prev, code: 'Client Code already exists' }));
        } else if (err.message.includes('API Error:')) {
          // Extract the actual error from the API response if available
          try {
             const apiErr = JSON.parse(err.message.replace('API Error: ', ''));
             errorMessage = apiErr.error || errorMessage;
          } catch(e) {}
        }

        setSuccessConfig({
          isOpen: true,
          title: errorTitle,
          message: errorMessage,
          type: 'error'
        });
      } finally {
        setIsSaving(false);
      }
    };

    performSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        const form = e.currentTarget;
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        if (target !== submitBtn) {
          e.preventDefault();
          const focusable = Array.from(form.querySelectorAll('input, select, textarea, button[type="submit"]')) as HTMLElement[];
          const index = focusable.indexOf(target);
          if (index > -1 && index < focusable.length - 1) {
            focusable[index + 1].focus();
          }
        }
      }
    }
  };

  const floatingInputStyle = "peer w-full bg-white border border-gray-200 px-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder-transparent";
  const floatingLabelStyle = "absolute left-3 top-1 text-[10px] font-medium text-gray-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1 peer-focus:text-[10px] pointer-events-none";
  
  const floatingIconInputStyle = "peer w-full bg-white border border-gray-200 pl-10 pr-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder-transparent";
  const floatingIconLabelStyle = "absolute left-10 top-1 text-[10px] font-medium text-gray-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1 peer-focus:text-[10px] pointer-events-none";

  const activeFixedIconLabelStyle = "absolute left-10 top-1 text-[10px] font-medium text-gray-400 pointer-events-none";
  const activeFixedLabelStyle = "absolute left-3 top-1 text-[10px] font-medium text-gray-400 pointer-events-none";
  const nativeDatePickerClass = "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-[#F5F7FA] w-full max-w-3xl rounded-2xl shadow-xl relative overflow-hidden animate-slideUp border border-gray-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 flex-shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Update Client Record' : 'Register New Client'}</h2>
            <p className="text-gray-500 text-sm mt-1">Please ensure all required fields are accurate for reporting.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="client-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
            
            {/* 1. BASIC INFORMATION */}
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">1</div>
                <h3 className="font-bold text-gray-800 text-sm tracking-wide">BASIC INFORMATION</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    name="code"
                    placeholder="e.g. 1001"
                    className={`${floatingInputStyle} ${fieldErrors.code ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    value={formData.code}
                    onChange={e => handleCodeChange(e.target.value)}
                  />
                  <label className={floatingLabelStyle}>Client Code <span className="text-red-500">*</span></label>
                  {fieldErrors.code && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.code}</p>}
                </div>

                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <input
                    name="contactNumber"
                    placeholder="09XX XXX XXXX"
                    className={`${floatingIconInputStyle} ${fieldErrors.contactNumber ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    value={formData.contactNumber}
                    onChange={e => handleContactChange(e.target.value)}
                  />
                  <label className={floatingIconLabelStyle}>Contact Number</label>
                  {fieldErrors.contactNumber && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.contactNumber}</p>}
                </div>

                <div className="relative">
                  <input
                    name="firstName"
                    placeholder="Enter first name"
                    className={`${floatingInputStyle} ${fieldErrors.firstName ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    value={formData.firstName}
                    onChange={e => {
                      setFormData({ ...formData, firstName: e.target.value });
                      if (fieldErrors.firstName) setFieldErrors(p => ({ ...p, firstName: '' }));
                    }}
                  />
                  <label className={floatingLabelStyle}>First Name <span className="text-red-500">*</span></label>
                  {fieldErrors.firstName && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.firstName}</p>}
                </div>
                
                <div className="relative">
                  <input
                    name="lastName"
                    placeholder="Enter last name"
                    className={`${floatingInputStyle} ${fieldErrors.lastName ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                    value={formData.lastName}
                    onChange={e => {
                      setFormData({ ...formData, lastName: e.target.value });
                      if (fieldErrors.lastName) setFieldErrors(p => ({ ...p, lastName: '' }));
                    }}
                  />
                  <label className={floatingLabelStyle}>Last Name <span className="text-red-500">*</span></label>
                  {fieldErrors.lastName && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.lastName}</p>}
                </div>
              </div>
            </div>

            {/* 2. LOAN DETAILS */}
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="font-bold text-gray-800 text-sm tracking-wide">LOAN DETAILS</h3>
              </div>
              
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <label className={activeFixedIconLabelStyle}>Monthly Reported <span className="text-red-500">*</span></label>
                  <input
                    name="monthReported"
                    type="month"
                    className={`peer w-full bg-white border ${fieldErrors.monthReported ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200'} pl-10 pr-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all ${nativeDatePickerClass}`}
                    value={formData.monthReported}
                    onChange={e => {
                      setFormData({ ...formData, monthReported: e.target.value });
                      if (fieldErrors.monthReported) setFieldErrors(p => ({ ...p, monthReported: '' }));
                    }}
                  />
                  {fieldErrors.monthReported && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.monthReported}</p>}
                </div>

                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <label className={activeFixedIconLabelStyle}>Due Date <span className="text-red-500">*</span></label>
                  <input
                    name="dueDate"
                    type="date"
                    className={`peer w-full bg-white border ${fieldErrors.dueDate ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-200'} pl-10 pr-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all ${nativeDatePickerClass}`}
                    value={formData.dueDate}
                    onChange={e => {
                      setFormData({ ...formData, dueDate: e.target.value });
                      if (fieldErrors.dueDate) setFieldErrors(p => ({ ...p, dueDate: '' }));
                    }}
                  />
                  {fieldErrors.dueDate && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.dueDate}</p>}
                </div>
                
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.outstandingBalance ? 'text-red-600' : 'text-emerald-700'} font-black z-10`}>₱</span>
                  <label className={`absolute left-10 top-1 text-[10px] font-medium ${fieldErrors.outstandingBalance ? 'text-red-600' : 'text-emerald-600'} pointer-events-none z-10`}>Outstanding Balance <span className="text-red-500">*</span></label>
                  <input
                    name="outstandingBalance"
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter amount"
                    className={`w-full ${fieldErrors.outstandingBalance ? 'bg-red-50 border-red-500 text-red-800' : 'bg-[#ECFDF5] border-emerald-200 text-emerald-800'} border px-3 pl-10 pt-5 pb-2 rounded-xl font-bold text-sm focus:ring-2 ${fieldErrors.outstandingBalance ? 'focus:ring-red-500/30 focus:border-red-500' : 'focus:ring-emerald-500/30 focus:border-emerald-500'} outline-none transition-all placeholder-gray-400 text-right`}
                    value={formatWithCommas(formData.outstandingBalance)}
                    onFocus={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      setFormData({ ...formData, outstandingBalance: raw });
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      setFormData({ ...formData, outstandingBalance: raw });
                      if (!raw) setFieldErrors(p => ({ ...p, outstandingBalance: 'Initial balance is required' }));
                    }}
                    onChange={e => handleBalanceChange(e.target.value)}
                  />
                  {fieldErrors.outstandingBalance && (
                    <p className="text-[11px] text-red-500 font-medium px-1 mt-1 flex items-center gap-1.5 justify-end">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       {fieldErrors.outstandingBalance}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <label className={activeFixedLabelStyle}>Located Status</label>
                  <select
                    className="peer w-full bg-white border border-gray-200 px-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value as LocationStatus })}
                  >
                    <option value={LocationStatus.LOCATED}>Located (L)</option>
                    <option value={LocationStatus.NOT_LOCATED}>Not Located (NL)</option>
                  </select>
                </div>
               </div>
            </div>

            {/* 3. LOCATION DETAILS */}
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">3</div>
                <h3 className="font-bold text-gray-800 text-sm tracking-wide">LOCATION DETAILS</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <input
                    name="area"
                    placeholder="Enter Area"
                    className={`${floatingIconInputStyle} ${fieldErrors.area ? 'border-red-500 bg-red-50' : ''}`}
                    value={formData.area}
                    onChange={e => {
                      setFormData({ ...formData, area: e.target.value });
                      if (fieldErrors.area) setFieldErrors(p => ({ ...p, area: '' }));
                    }}
                  />
                  <label className={floatingIconLabelStyle}>Area <span className="text-red-500">*</span></label>
                  {fieldErrors.area && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.area}</p>}
                </div>

                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <input
                    name="city"
                    placeholder="Enter City"
                    className={`${floatingIconInputStyle} ${fieldErrors.city ? 'border-red-500 bg-red-50' : ''}`}
                    value={formData.city}
                    onChange={e => {
                      setFormData({ ...formData, city: e.target.value });
                      if (fieldErrors.city) setFieldErrors(p => ({ ...p, city: '' }));
                    }}
                  />
                  <label className={floatingIconLabelStyle}>City <span className="text-red-500">*</span></label>
                  {fieldErrors.city && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.city}</p>}
                </div>

                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <input
                    name="barangay"
                    placeholder="Enter Brgy."
                    className={`${floatingIconInputStyle} ${fieldErrors.barangay ? 'border-red-500 bg-red-50' : ''}`}
                    value={formData.barangay}
                    onChange={e => {
                      setFormData({ ...formData, barangay: e.target.value });
                      if (fieldErrors.barangay) setFieldErrors(p => ({ ...p, barangay: '' }));
                    }}
                  />
                  <label className={floatingIconLabelStyle}>Barangay <span className="text-red-500">*</span></label>
                  {fieldErrors.barangay && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.barangay}</p>}
                </div>
              </div>

              <div className="relative">
                <textarea
                  name="fullAddress"
                  rows={2}
                  placeholder="House No., Street..."
                  className={`peer w-full bg-white border ${fieldErrors.fullAddress ? 'border-red-500 bg-red-50' : 'border-gray-200'} px-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder-transparent`}
                  value={formData.fullAddress}
                  onChange={e => {
                    setFormData({ ...formData, fullAddress: e.target.value });
                    if (fieldErrors.fullAddress) setFieldErrors(p => ({ ...p, fullAddress: '' }));
                  }}
                />
                <label className={floatingLabelStyle}>Full Address <span className="text-red-500">*</span></label>
                {fieldErrors.fullAddress && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.fullAddress}</p>}
              </div>
            </div>

            {/* 4. ASSIGNMENT STATES */}
            <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">4</div>
                <h3 className="font-bold text-gray-800 text-sm tracking-wide">ASSIGNMENT</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <input
                    name="collector"
                    placeholder="Collector Nickname"
                    className={`${floatingIconInputStyle} ${fieldErrors.collector ? 'border-red-500 bg-red-50' : ''}`}
                    value={formData.collector}
                    onChange={e => {
                      setFormData({ ...formData, collector: e.target.value });
                      if (fieldErrors.collector) setFieldErrors(p => ({ ...p, collector: '' }));
                    }}
                  />
                  <label className={floatingIconLabelStyle}>Collector Assigned <span className="text-red-500">*</span></label>
                  {fieldErrors.collector && <p className="text-[11px] text-red-500 font-medium px-1 mt-1">{fieldErrors.collector}</p>}
                </div>

                <div className="relative">
                  <label className={activeFixedLabelStyle}>Assigned Branch</label>
                  <select
                    disabled={selectedBranch !== Branch.ALL && !isEdit}
                    className="peer w-full bg-white border border-gray-200 px-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none disabled:bg-gray-50 disabled:text-gray-400"
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value as Branch })}
                  >
                    <option value={Branch.NAVAL}>Naval Branch</option>
                    <option value={Branch.ORMOC}>Ormoc Branch</option>
                  </select>
                </div>


                <div className="relative">
                  <label className={activeFixedLabelStyle}>Moving Status</label>
                  <select
                    className="peer w-full bg-white border border-gray-200 px-3 pt-5 pb-2 rounded-xl text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as MovingStatus })}
                  >
                    {Object.values(MovingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Form Footer Action */}
            <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-[#F5F7FA] pb-2 z-20">
              <button
                type="button"
                onClick={onClose}
                className="w-full md:w-auto px-8 py-3.5 font-semibold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full md:w-full h-12 bg-emerald-600 text-white font-bold rounded-full shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all text-sm tracking-wide disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  isEdit ? 'Save Changes' : 'Create Client'
                )}
              </button>
            </div>
            
          </form>
        </div>
      </div>

      <SuccessModal
        isOpen={successConfig.isOpen}
        title={successConfig.title}
        message={successConfig.message}
        type={successConfig.type}
        autoRedirectLabel={successConfig.type === 'success' && !isEdit ? "Auto-redirecting to Loan Grid in 2nd..." : undefined}
        onConfirm={() => {
          setSuccessConfig(prev => ({ ...prev, isOpen: false }));
          if (successConfig.type === 'success') onClose();
        }}
        actions={successConfig.type === 'success' && !isEdit ? [
          { 
            label: 'Add Another Client', 
            onClick: resetForm,
            variant: 'outline'
          },
          { 
            label: 'Go to Loan Grid', 
            onClick: onClose,
            variant: 'primary'
          }
        ] : undefined}
      />

      <ConfirmationModal
        isOpen={warningConfig.isOpen}
        title={warningConfig.showViewProfile ? "Active Record Detected" : "Collector Validation"}
        message={warningConfig.message}
        onConfirm={() => {
          if (warningConfig.showViewProfile && warningConfig.targetLoan && onViewProfile) {
            onViewProfile(warningConfig.targetLoan);
          }
          setWarningConfig({ ...warningConfig, isOpen: false });
        }}
        onCancel={() => setWarningConfig({ ...warningConfig, isOpen: false })}
        confirmLabel={warningConfig.showViewProfile ? "View Client Profile" : "OK"}
        cancelLabel={warningConfig.showViewProfile ? "Cancel" : "Close"}
        type={warningConfig.type}
      />
    </div>
  );
};

export default ClientFormModal;
