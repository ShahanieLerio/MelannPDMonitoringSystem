import React, { useState, useMemo } from 'react';
import { Loan, MovingStatus, Branch, Remark } from '../types.ts';
import { formatReportedMonth, formatMMDDYYYY } from '../constants.tsx';
import { store } from '../services/dataStore.ts';

interface ClientModalProps {
  loan: Loan;
  onClose: () => void;
}

const ClientModal: React.FC<ClientModalProps> = ({ loan, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'remarks'>('info');

  const enrollmentHistory = useMemo(() => {
    return store.getLoans(Branch.ALL)
      .filter(l => l.code === loan.code)
      .sort((a, b) => b.monthReported.localeCompare(a.monthReported));
  }, [loan.code]);

  const sortedPayments = useMemo(() => {
    return [...loan.payments].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;

      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });
  }, [loan.payments]);

  const activeRecord = enrollmentHistory.find(l => l.status !== MovingStatus.PAID) || enrollmentHistory[0];

  const getStatusBadge = (status: MovingStatus) => {
    if (status === MovingStatus.PAID) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === MovingStatus.MOVING) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === MovingStatus.NM) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (status === MovingStatus.NMSR) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const statusLabel = activeRecord.status === MovingStatus.PAID ? 'FULLY PAID' : `ACTIVE: ${activeRecord.status}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-50 w-full max-w-4xl rounded-[16px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header (Top) */}
        <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(activeRecord.status)}`}>
                {statusLabel}
              </span>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wider border border-slate-200">
                Code: {loan.code}
              </span>
              {enrollmentHistory.length > 1 && (
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">
                  Renewed ({enrollmentHistory.length}x)
                </span>
              )}
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{loan.borrowerName}</h2>
            <p className="text-slate-500 mt-1 flex items-center gap-1.5 font-medium text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              {loan.barangay}, {loan.city} | {loan.branch}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'info' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Profile Analytics
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Payment Stream ({loan.payments.length})
          </button>
          <button
            onClick={() => setActiveTab('remarks')}
            className={`px-6 py-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${activeTab === 'remarks' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Field Intel ({loan.remarks.length})
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              
              {/* Layout for Details (Left) and Financials (Right) */}
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* C. CLIENT DETAILS (LEFT SIDE) */}
                <div className="flex-1 space-y-4">
                  <div className="bg-white p-5 rounded-[16px] shadow-sm border border-slate-200 hover:-translate-y-1 hover:shadow-md hover:border-slate-300 transition-all duration-300 ease-in-out">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Client Details</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <DetailItem 
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                        label="Assigned Collector"
                        value={activeRecord.collector}
                      />
                      <DetailItem
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        label="Month Reported"
                        value={formatReportedMonth(activeRecord.monthReported)}
                      />
                      {activeRecord.dateRelease && (
                        <DetailItem
                          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                          label="Date Release"
                          value={formatMMDDYYYY(activeRecord.dateRelease)}
                        />
                      )}
                      <DetailItem
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                        label="Maturity Date"
                        value={formatMMDDYYYY(activeRecord.dueDate)}
                      />
                      <DetailItem
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        label="Reported Amount"
                        value={`₱${activeRecord.outstandingBalance.toLocaleString()}`}
                      />
                      <DetailItem
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        label="Location Status" 
                        value={activeRecord.location === 'LOCATED' ? 'Located' : activeRecord.location} 
                      />
                      {activeRecord.promiseToPayDate && (
                        <DetailItem 
                          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                          label="Promise to Pay (PTP)" 
                          value={activeRecord.promiseToPayDate} 
                        />
                      )}
                    </div>

                    <div className="mt-4 space-y-4">
                      {/* Box for Address */}
                      <div>
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Full Address
                        </span>
                        <div className="bg-white border border-slate-200 p-3 rounded-[12px] text-sm text-slate-900 font-semibold shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-default">
                          {activeRecord.fullAddress || "—"}
                        </div>
                      </div>

                      {/* Box for Contact Number */}
                      <div>
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          Contact Number
                        </span>
                        <div className="bg-white border border-slate-200 p-3 rounded-[12px] text-sm text-slate-900 font-semibold shadow-sm flex items-center gap-2 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-default">
                          {activeRecord.contactNumber ? (
                             <>
                               <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                               <span>{activeRecord.contactNumber}</span>
                             </>
                          ) : (
                             <span className="text-slate-400 italic font-medium">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B. FINANCIAL SUMMARY (RIGHT SIDE) */}
                <div className="lg:w-[350px] shrink-0">
                  <div className="bg-slate-50/80 p-5 rounded-[16px] shadow-sm border border-slate-200 flex flex-col gap-5 h-full hover:-translate-y-1 hover:shadow-md hover:border-slate-300 transition-all duration-300 ease-in-out">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Financial Summary</h3>
                    
                    {activeRecord.principal != null && (
                      <div className="bg-white p-4 rounded-[12px] border border-slate-200 shadow-sm flex flex-col justify-center hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-default">
                        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Principal</span>
                        <span className="text-lg font-bold text-slate-900">₱{activeRecord.principal.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="bg-white p-4 rounded-[12px] border border-slate-200 shadow-sm flex flex-col justify-center hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-default">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Loan</span>
                      <span className="text-lg font-bold text-slate-900">₱{(activeRecord.totalLoan != null ? activeRecord.totalLoan : activeRecord.outstandingBalance).toLocaleString()}</span>
                    </div>

                    <div className="bg-white p-4 rounded-[12px] border border-slate-200 shadow-sm flex flex-col justify-center hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-default">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Remitted</span>
                      <span className="text-lg font-bold text-emerald-600">₱{activeRecord.amountCollected.toLocaleString()}</span>
                    </div>

                    <div className="bg-white p-5 rounded-[16px] border border-red-100 shadow-sm flex flex-col justify-center bg-gradient-to-br from-red-50/50 to-white mt-auto hover:border-red-200 hover:shadow-md transition-all duration-200 cursor-default">
                      <span className="text-[12px] font-bold text-red-800/70 uppercase tracking-wider mb-1">Current Exposure</span>
                      <span className="text-3xl font-black text-red-600 tracking-tight">
                        {activeRecord.runningBalance < 0 ? '-' : ''}₱{Math.abs(activeRecord.runningBalance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Enrollment History Section */}
              <div className="bg-white p-5 rounded-[16px] shadow-sm border border-slate-200 hover:-translate-y-1 hover:shadow-md hover:border-slate-300 transition-all duration-300 ease-in-out">
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Enrollment & Renewal History</h3>
                <div className="space-y-3">
                  {enrollmentHistory.map((h, idx) => (
                    <div key={h.id} className={`flex items-center justify-between p-4 rounded-[12px] border ${h.status === MovingStatus.PAID ? 'bg-slate-50/50 border-slate-200 opacity-70' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${h.status === MovingStatus.PAID ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                          {enrollmentHistory.length - idx}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Reported: {formatReportedMonth(h.monthReported)}</p>
                          <p className="text-xs font-medium text-slate-500">Initial Balance: ₱{h.outstandingBalance.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(h.status)}`}>
                          {h.status}
                        </span>
                        <div className="text-right min-w-[100px]">
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Remitted</p>
                          <p className="text-sm font-bold text-emerald-600">₱{h.amountCollected.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'remarks' ? (
            <div className="space-y-6">
              {loan.remarks.length === 0 ? (
                <div className="py-20 text-center text-slate-400 italic font-medium uppercase tracking-wider text-sm bg-white rounded-[16px] border border-slate-200">No field intelligence recorded.</div>
              ) : (
                <div className="space-y-4">
                  {[...loan.remarks].reverse().map((remark, idx) => (
                    <div key={remark.id} className="bg-white p-6 rounded-[20px] shadow-sm border border-slate-200 hover:border-emerald-200 transition-all flex gap-5">
                      <div className="flex flex-col items-center gap-2">
                         <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center font-black text-emerald-600 text-xs">
                           {(remark.collector || 'Sys').charAt(0).toUpperCase()}
                         </div>
                         <div className="w-0.5 flex-1 bg-slate-100 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{remark.collector}</span>
                              <h4 className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                                {new Date(remark.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(remark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </h4>
                           </div>
                           {remark.ptpDate && (
                              <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5 shadow-sm">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                PTP: {new Date(remark.ptpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                           )}
                           {remark.followUpDate && (
                              <span className="bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1.5 shadow-sm">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                Follow-up: {new Date(remark.followUpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                           )}
                        </div>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 italic">
                          "{remark.text}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loan.payments.length === 0 ? (
                <div className="py-20 text-center text-slate-400 italic font-medium uppercase tracking-wider text-sm bg-white rounded-[16px] border border-slate-200">No historical payments detected.</div>
              ) : (
                <div className="overflow-hidden rounded-[16px] border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Transaction Date</th>
                        <th className="px-6 py-4">Ref Number</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-right">Running</th>
                        <th className="px-6 py-4">Recorder</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedPayments.map((p, idx) => (
                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${p.status === 'REVERSED' ? 'bg-red-50/30' : ''}`}>
                          <td className="px-6 py-4 text-slate-800 font-semibold">{formatMMDDYYYY(p.date)}</td>
                          <td className="px-6 py-4 font-bold text-emerald-700">{p.orNumber}</td>
                          <td className={`px-6 py-4 text-right font-bold ${p.status === 'REVERSED' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                            ₱{p.amount.toLocaleString()}
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${p.balanceAfter < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {p.balanceAfter < 0 ? '-' : ''}₱{Math.abs(p.balanceAfter).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-semibold">{p.recorder}</td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${p.status === 'REVERSED' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                              {p.status}
                            </span>
                            {idx === 0 && p.status !== 'REVERSED' && (
                              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter animate-pulse shadow-sm">
                                LATEST
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 flex justify-end gap-4 bg-white shrink-0 rounded-b-[16px]">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 transition-all duration-300 hover:shadow-lg active:scale-95 text-sm"
          >
            Review Complete
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable 2-column detail item
const DetailItem: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex flex-col gap-1.5 p-2 rounded-xl hover:bg-slate-50 transition-colors duration-200 cursor-default">
    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
      {icon} {label}
    </span>
    <span className={`text-sm font-semibold text-slate-900 tracking-tight ${icon ? 'ml-5' : ''}`}>{value}</span>
  </div>
);

export default ClientModal;
