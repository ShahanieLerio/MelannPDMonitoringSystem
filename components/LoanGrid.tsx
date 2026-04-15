
import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../services/dataStore.ts';
import { Loan, MovingStatus, LocationStatus, Branch, User } from '../types.ts';
import { STATUS_COLORS, formatReportedMonth } from '../constants.tsx';
import ClientModal from './ClientModal.tsx';
import ClientFormModal from './ClientFormModal.tsx';
import RemarksModal from './RemarksModal.tsx';
import HistoryModal from './HistoryModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import BulkImportModal from './BulkImportModal.tsx';
import MultiSelectFilter from './MultiSelectFilter.tsx';

interface LoanGridProps {
  currentUser: User;
  selectedBranch: Branch;
}

const LoanGrid: React.FC<LoanGridProps> = ({ currentUser, selectedBranch }) => {
  const [loans, setLoans] = useState(store.getLoans(selectedBranch));
  const [allCollectors, setAllCollectors] = useState(store.getCollectors(Branch.ALL));
  const [searchTerm, setSearchTerm] = useState('');

  // Filtering States - Multi-Select Support
  const [filterStartDate, setFilterStartDate] = useState({ month: '01', year: '2016' });
  const [filterEndDate, setFilterEndDate] = useState({ month: '12', year: '2030' });

  const [filterCollectors, setFilterCollectors] = useState<string[] | null>(null);
  const [filterLocations, setFilterLocations] = useState<string[] | null>(null);
  const [filterStatuses, setFilterStatuses] = useState<string[] | null>([
    MovingStatus.MOVING, 
    MovingStatus.NM, 
    MovingStatus.NMSR
  ]);
  const [filterAreas, setFilterAreas] = useState<string[] | null>(null);
  const [filterCities, setFilterCities] = useState<string[] | null>(null);
  const [filterBarangays, setFilterBarangays] = useState<string[] | null>(null);

  // UI States
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [remarksLoan, setRemarksLoan] = useState<Loan | null>(null);
  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  useEffect(() => {
    setLoans(store.getLoans(selectedBranch));
    // Subscribe to store updates for real-time sync
    const unsubscribe = store.subscribe(() => {
      setLoans(store.getLoans(selectedBranch));
      setAllCollectors(store.getCollectors(Branch.ALL));
    });
    return () => unsubscribe();
  }, [selectedBranch]);

  // Dynamic filter options for MultiSelect
  const collectorOptions = useMemo(() => {
    const uniqueNames = Array.from(new Set(loans.map(l => l.collector))).sort();
    return uniqueNames.map(name => {
      const coll = allCollectors.find(c => c.name === name);
      return { value: name, label: coll?.nickname || name };
    });
  }, [loans, allCollectors]);

  const areaOptions = useMemo(() =>
    Array.from(new Set(loans.map(l => l.area))).sort().map(a => ({ value: a, label: a })),
    [loans]
  );

  const cityOptions = useMemo(() =>
    Array.from(new Set(loans.map(l => l.city))).sort().map(c => ({ value: c, label: c })),
    [loans]
  );

  const barangayOptions = useMemo(() =>
    Array.from(new Set(loans.map(l => l.barangay))).sort().map(b => ({ value: b, label: b })),
    [loans]
  );

  const locationOptions = [
    { value: LocationStatus.LOCATED, label: 'Located (L)' },
    { value: LocationStatus.NOT_LOCATED, label: 'Not Located (NL)' }
  ];

  const statusOptions = Object.values(MovingStatus).map(s => ({ value: s, label: s }));

  const years = Array.from({ length: 20 }, (_, i) => (2016 + i).toString());
  const months = [
    { label: 'Jan', val: '01' }, { label: 'Feb', val: '02' }, { label: 'Mar', val: '03' },
    { label: 'Apr', val: '04' }, { label: 'May', val: '05' }, { label: 'Jun', val: '06' },
    { label: 'Jul', val: '07' }, { label: 'Aug', val: '08' }, { label: 'Sep', val: '09' },
    { label: 'Oct', val: '10' }, { label: 'Nov', val: '11' }, { label: 'Dec', val: '12' },
  ];

  const refreshData = () => setLoans(store.getLoans(selectedBranch));

  const handleDelete = (id: string, name: string) => {
    askConfirm(
      "Are you sure you want to delete this record?",
      `Client "${name}" and all associated data will be removed.`,
      () => {
        store.deleteLoan(id);
        refreshData();
      },
      'danger'
    );
  };

  const handleEdit = (l: Loan) => {
    askConfirm(
      "Are you sure you want to edit this record?",
      `You are about to modify the profile for ${l.borrowerName}.`,
      () => setEditLoan(l)
    );
  };

  const filteredLoans = useMemo(() => {
    const startStr = `${filterStartDate.year}-${filterStartDate.month}`;
    const endStr = `${filterEndDate.year}-${filterEndDate.month}`;

    return loans.filter(l => {
      // 1. Search Logic
      const matchSearch = l.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.code.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Date Range Logic
      const reportedDate = l.monthReported;
      const matchDate = reportedDate >= startStr && reportedDate <= endStr;

      // 3. Multi-Select Filters Logic (OR logic within filter, AND logic between filters)
      // null means "All Selected", [] means "None Selected" (match nothing)

      const matchCollector = filterCollectors === null || filterCollectors.includes(l.collector);
      const matchLocation = filterLocations === null || filterLocations.includes(l.location);

      // Special handling for Status: if null (All), exclude PAID by default unless explicitly selected?
      // Original logic: "Show only the active / current record. Paid records should NOT clutter the grid."
      // If user Selects All in MultiSelect, it includes PAID.
      // If we want to replicate original behavior where "All Statuses" means "Not Paid", we might need to default the selection to "not paid".
      // But "Excel behavior" usually means "Select All" includes everything.
      // Let's stick to strict filtering: if null (All), it matches everything including PAID.
      // However, the user request says: "Loan Grid results must update to show records that match: Any of the selected values... AND all other active filters"
      // The original code had: `const matchStatus = filterStatus === '' ? l.status !== MovingStatus.PAID : l.status === filterStatus;`
      // This means default was "Everything EXCEPT Paid".
      // To preserve this "De-clutter" behavior while allowing full selection:
      // We should probably initialize `filterStatuses` to exclude PAID if that is the desired default, 
      // OR just accept that "Select All" means truly ALL, including paid.
      // Let's implement strict matching. If user wants to hide Paid, they uncheck "Paid".
      // But wait, the prompt says "Match user expectations from Excel filtering".
      // In Excel, "Select All" selects everything.
      // I will implement standard "Select All = Everything".
      // But I'll initialize the state to exclude 'Paid' if strict matching of previous behavior is critical? 
      // Actually, standardizing on "Select All = Everything" is cleaner. 
      // Use null = All.

      const matchStatus = filterStatuses === null || filterStatuses.includes(l.status);
      const matchArea = filterAreas === null || filterAreas.includes(l.area);
      const matchCity = filterCities === null || filterCities.includes(l.city);
      const matchBarangay = filterBarangays === null || filterBarangays.includes(l.barangay);

      return matchSearch && matchDate && matchCollector && matchLocation && matchStatus && matchArea && matchCity && matchBarangay;
    });
  }, [
    loans, searchTerm, filterStartDate, filterEndDate,
    filterCollectors, filterLocations, filterStatuses, filterAreas, filterCities, filterBarangays
  ]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight transition-colors duration-300">Client Portfolio</h2>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors duration-300">
            Displaying data for: <span className="text-emerald-600">{selectedBranch}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 border border-slate-200 dark:border-slate-700"
          >
            <span className="text-xl">📁</span>
            Import Clients
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-md hover:shadow-xl hover:shadow-emerald-900/20 transition-all duration-300 active:scale-95 hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Add Client
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4 transition-colors duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Search Client</label>
            <input
              type="text"
              placeholder="Numeric code or name..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm text-slate-800 dark:text-white transition-colors duration-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <div className="col-span-1 md:col-span-1 lg:col-span-2 flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">From (Reported)</label>
              <div className="flex gap-1">
                <select className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-2 rounded-lg transition-colors duration-300" value={filterStartDate.month} onChange={e => setFilterStartDate({ ...filterStartDate, month: e.target.value })}>
                  {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <select className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-2 rounded-lg transition-colors duration-300" value={filterStartDate.year} onChange={e => setFilterStartDate({ ...filterStartDate, year: e.target.value })}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">To (Reported)</label>
              <div className="flex gap-1">
                <select className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-2 rounded-lg transition-colors duration-300" value={filterEndDate.month} onChange={e => setFilterEndDate({ ...filterEndDate, month: e.target.value })}>
                  {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <select className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-2 rounded-lg transition-colors duration-300" value={filterEndDate.year} onChange={e => setFilterEndDate({ ...filterEndDate, year: e.target.value })}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <MultiSelectFilter
              label="Collector"
              options={collectorOptions}
              selectedValues={filterCollectors}
              onChange={setFilterCollectors}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <MultiSelectFilter
              label="Located Status"
              options={locationOptions}
              selectedValues={filterLocations}
              onChange={setFilterLocations}
            />
          </div>
          <div>
            <MultiSelectFilter
              label="Moving Status"
              options={statusOptions}
              selectedValues={filterStatuses}
              onChange={setFilterStatuses}
            />
          </div>
          <div>
            <MultiSelectFilter
              label="Area"
              options={areaOptions}
              selectedValues={filterAreas}
              onChange={setFilterAreas}
            />
          </div>
          <div>
            <MultiSelectFilter
              label="City"
              options={cityOptions}
              selectedValues={filterCities}
              onChange={setFilterCities}
            />
          </div>
          <div>
            <MultiSelectFilter
              label="Barangay"
              options={barangayOptions}
              selectedValues={filterBarangays}
              onChange={setFilterBarangays}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-sm transition-colors duration-300">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[100px] transition-colors duration-300">Collector</th>
                <th className="sticky left-[100px] z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[90px] transition-colors duration-300">Area</th>
                <th className="sticky left-[190px] z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[90px] transition-colors duration-300">City</th>
                <th className="sticky left-[280px] z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[100px] transition-colors duration-300">Barangay</th>
                <th className="sticky left-[380px] z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[85px] transition-colors duration-300">Client Code</th>
                <th className="sticky left-[465px] z-30 bg-slate-50 dark:bg-slate-900 px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[160px] transition-colors duration-300">Borrower’s Name</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[100px] transition-colors duration-300">Reported</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[90px] whitespace-nowrap transition-colors duration-300">Due Date</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[110px] text-right transition-colors duration-300">O/S Balance</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[90px] text-right transition-colors duration-300">Collected</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[110px] text-right transition-colors duration-300">Running</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[80px] text-center transition-colors duration-300">Loc</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[80px] text-center transition-colors duration-300">Status</th>
                <th className="px-3 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] border-b dark:border-slate-700 min-w-[130px] text-center transition-colors duration-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-20 text-center text-slate-400 italic font-medium">No records found for this branch matching current filters.</td>
                </tr>
              ) : filteredLoans.map((l) => {
                const collectorNick = allCollectors.find(c => c.name === l.collector)?.nickname || l.collector;
                return (
                  <tr key={l.id} className="group hover:bg-emerald-50 dark:hover:bg-slate-700/50 transition-all duration-300">
                    <td className="sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 font-bold z-10 px-3 py-4 text-emerald-700 dark:text-emerald-400 border-r border-slate-50 dark:border-slate-700 min-w-[100px] truncate transition-colors duration-300" title={l.collector}>{collectorNick}</td>
                    <td className="sticky left-[100px] bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 z-10 px-3 py-4 text-slate-600 dark:text-slate-300 border-r border-slate-50 dark:border-slate-700 min-w-[90px] truncate transition-colors duration-300">{l.area}</td>
                    <td className="sticky left-[190px] bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 z-10 px-3 py-4 text-slate-600 dark:text-slate-300 border-r border-slate-50 dark:border-slate-700 min-w-[90px] truncate transition-colors duration-300">{l.city}</td>
                    <td className="sticky left-[280px] bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 z-10 px-3 py-4 text-slate-600 dark:text-slate-300 border-r border-slate-50 dark:border-slate-700 min-w-[100px] truncate transition-colors duration-300">{l.barangay}</td>
                    <td className="sticky left-[380px] bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 z-10 px-3 py-4 font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-50 dark:border-slate-700 min-w-[85px] transition-colors duration-300">{l.code}</td>
                    <td className="sticky left-[465px] bg-white dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-slate-700/50 z-10 px-3 py-4 font-bold text-slate-700 dark:text-slate-200 cursor-pointer border-r border-slate-50 dark:border-slate-700 min-w-[160px] max-w-[160px] truncate transition-all duration-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:font-black group-hover:underline decoration-emerald-500/30 underline-offset-4" title={`${l.lastName}, ${l.firstName}`} onClick={() => setSelectedLoan(l)}>
                      {l.lastName}, {l.firstName}
                    </td>
                    <td className="px-3 py-4 text-slate-600 dark:text-slate-300">{formatReportedMonth(l.monthReported)}</td>
                    <td className="px-3 py-4 text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">{l.dueDate}</td>
                    <td className="px-3 py-4 text-right text-slate-800 dark:text-white font-black">₱{l.outstandingBalance.toLocaleString()}</td>
                    <td className="px-3 py-4 text-right text-emerald-600 dark:text-emerald-400 font-black">₱{l.amountCollected.toLocaleString()}</td>
                    <td className={`px-3 py-4 text-right font-black ${l.runningBalance < 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {l.runningBalance < 0 ? '-' : ''}₱{Math.abs(l.runningBalance).toLocaleString()}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${STATUS_COLORS[l.location]}`}>
                        {l.location}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${STATUS_COLORS[l.status]}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setRemarksLoan(l)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors relative"
                          title="Remarks"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                          {l.remarks.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>}
                        </button>
                        <button
                          onClick={() => handleEdit(l)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit Client"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button
                          onClick={() => setHistoryLoan(l)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                          title="Activity History"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(l.id, l.borrowerName)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete Client"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && <ClientModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} />}
      {(isAddModalOpen || editLoan) && (
        <ClientFormModal
          loan={editLoan || undefined}
          currentUser={currentUser}
          selectedBranch={selectedBranch}
          onClose={() => { setIsAddModalOpen(false); setEditLoan(null); refreshData(); }}
          onViewProfile={(l) => {
            setIsAddModalOpen(false);
            setEditLoan(null);
            setSelectedLoan(l);
          }}
        />
      )}
      {remarksLoan && (
        <RemarksModal
          loan={remarksLoan}
          currentUser={currentUser}
          onClose={() => { setRemarksLoan(null); refreshData(); }}
        />
      )}
      {historyLoan && (
        <HistoryModal
          loan={historyLoan}
          onClose={() => setHistoryLoan(null)}
        />
      )}



      {isImportModalOpen && (
        <BulkImportModal
          currentUser={currentUser}
          selectedBranch={selectedBranch}
          onClose={() => { setIsImportModalOpen(false); refreshData(); }}
        />
      )}
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

export default LoanGrid;

