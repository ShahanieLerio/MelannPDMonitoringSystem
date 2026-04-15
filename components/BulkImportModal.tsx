
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { store } from '../services/dataStore.ts';
import { Loan, Branch, User, UserRole, MovingStatus, LocationStatus, PriorityLevel } from '../types.ts';
import { formatReportedMonth } from '../constants.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface BulkImportModalProps {
    currentUser: User;
    onClose: () => void;
    selectedBranch: Branch;
}

interface ImportRow {
    'Client Code': string | number;
    'First Name': string;
    'Last Name': string;
    'Collector': string;
    'Area': string;
    'City': string;
    'Barangay': string;
    'Full Address': string;
    'Reported Month': string;
    'Due Date': string;
    'Outstanding Balance': number | string;
    'Located Status': string;
    'Moving Status': string;
    'Assigned Branch': string;
}

interface ProcessedRow {
    data: Partial<Loan>;
    isValid: boolean;
    errors: string[];
    original: any;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ currentUser, onClose, selectedBranch }) => {
    const [importType, setImportType] = useState<'portfolio' | 'address'>('portfolio');
    const [importMode, setImportMode] = useState<'replace' | 'wipe' | 'new-only'>('replace');
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ProcessedRow[]>([]);
    const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [summary, setSummary] = useState<{ total: number; success: number; failed: number; deleted?: number; skipped?: number } | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to table after preview data is loaded
    React.useEffect(() => {
        if (previewData.length > 0 && tableContainerRef.current) {
            tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [previewData.length]);

    const handleCloseRequest = () => {
        if (file || previewData.length > 0) {
            setShowExitConfirm(true);
        } else {
            onClose();
        }
    };

    // Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'i') setFilter('invalid');
            if (e.altKey && e.key.toLowerCase() === 'v') setFilter('valid');
            if (e.altKey && e.key.toLowerCase() === 'a') setFilter('all');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            processFile(selectedFile);
        }
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                const allLoans = store.getLoans(Branch.ALL);
                const allCollectors = store.getCollectors(Branch.ALL);

                // Helper to convert Excel Date/Serial to JS String (YYYY-MM-DD)
                const excelDateToJS = (val: any) => {
                    if (!val) return '';
                    if (val instanceof Date) {
                        return val.toISOString().split('T')[0];
                    }
                    if (typeof val === 'number') {
                        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                        return d.toISOString().split('T')[0];
                    }
                    if (typeof val === 'string' && val.includes('-')) return val;
                    return String(val);
                };

                const seenNames = new Set();
                const processed = json.map((row, index): ProcessedRow => {
                    const errors: string[] = [];

                    // ... existing val helper logic ...
                    const val = (key: string) => {
                        const aliases: Record<string, string[]> = {
                            'collector': ['collector', 'coll', 'agent', 'personnel'],
                            'area': ['area', 'location', 'base'],
                            'city': ['city', 'town', 'municipality', 'muni'],
                            'barangay': ['barangay', 'brgy', 'village'],
                            'code': ['clientcode', 'code', 'id', 'accountno', 'acctno', 'clientid'],
                            'firstname': ['firstname', 'fname', 'givenname'],
                            'lastname': ['lastname', 'lname', 'surname', 'familyname'],
                            'borrowername': ['borrowername', 'borrowersname', 'name', 'clientname', 'borrower', 'fullname'],
                            'reported': ['reportedmonth', 'monthreported', 'reported', 'datereported', 'month', 'date'],
                            'due': ['duedate', 'due', 'expiry', 'maturity'],
                            'balance': ['outstandingbalance', 'outstanding', 'balance', 'osbalance', 'principal', 'amountdue'],
                            'status': ['movingstatus', 'status', 'moving'],
                            'loc': ['locatedstatus', 'loc', 'locationstatus'],
                            'address': ['address', 'fulladdress'],
                            'contactnumber': ['contactnumber', 'contact', 'phone', 'phonenumber', 'mobile', 'cellphone']
                        };

                        const targetClean = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const targetAliases = (aliases[targetClean] || [targetClean]).map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));

                        const foundKey = Object.keys(row).find(k => {
                            const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return targetAliases.includes(cleanK);
                        });

                        return foundKey ? row[foundKey] : undefined;
                    };

                    if (importType === 'address') {
                        const code = String(val('code') || '').trim();
                        const fullBorrowerName = String(val('borrowername') || '').trim();
                        const address = String(val('address') || val('Full Address') || '').trim();
                        
                        if (!code) errors.push(`Missing: Code`);
                        if (!address) errors.push(`Missing: Address`);
                        
                        const existingByCode = allLoans.find(l => l.code === code);
                        if (!existingByCode && code) {
                            errors.push(`Not Found: Client Code ${code} does not exist in database`);
                        }
                        
                        const displayData = existingByCode ? { ...existingByCode, fullAddress: address, borrowerName: fullBorrowerName || existingByCode.borrowerName } : { code, borrowerName: fullBorrowerName || 'N/A', fullAddress: address, outstandingBalance: 0 } as any;

                        return {
                            data: displayData as Loan,
                            isValid: errors.length === 0,
                            errors,
                            original: {
                                'Code': code,
                                'BorrowerName': fullBorrowerName,
                                'Address': address
                            }
                        };
                    }

                    const rowBranch = (val('Assigned Branch') || (selectedBranch !== Branch.ALL ? selectedBranch : '')) as Branch;

                    // 1. Branch Restriction
                    if (currentUser.role !== UserRole.SUPER_ADMIN && rowBranch !== currentUser.branch) {
                        errors.push(`Unauthorized branch: ${rowBranch || 'No Branch Specified'}`);
                    }
                    if (selectedBranch !== Branch.ALL && rowBranch && rowBranch !== selectedBranch) {
                        errors.push(`Row branch (${rowBranch}) doesn't match selected branch (${selectedBranch})`);
                    }

                    // 2. Collector Validation
                    const collectorNickname = String(val('Collector') || '').trim().toUpperCase();
                    const collector = allCollectors.find(c =>
                        (c.nickname && c.nickname.trim().toUpperCase() === collectorNickname) ||
                        (c.name && c.name.trim().toUpperCase() === collectorNickname)
                    );

                    if (!collectorNickname) {
                        errors.push(`Collector name is missing`);
                    } else if (!collector) {
                        errors.push(`Collector "${collectorNickname}" not recognized`);
                    } else if (collector.branch !== rowBranch && rowBranch !== Branch.ALL && rowBranch) {
                        errors.push(`Collector "${collectorNickname}" exists but belongs to ${collector.branch}, not ${rowBranch}`);
                    }

                    // 3. Duplicate Detection Sets (Reset per row in map, but use persistence outside)
                    // (Actually seenCodes and seenNames are defined outside the map in the actual implementation)

                    const code = String(val('code') || '').trim();
                    const outstandingValue = val('balance');
                    const outstanding = typeof outstandingValue === 'number' ? outstandingValue : parseFloat(String(outstandingValue || 0).replace(/[^0-9.]/g, '')) || 0;

                    let firstName = String(val('firstname') || val('fname') || '').trim();
                    let lastName = String(val('lastname') || val('lname') || '').trim();
                    const fullBorrowerName = String(val('borrowername') || '').trim();

                    if ((firstName === 'undefined' || !firstName) && (lastName === 'undefined' || !lastName) && fullBorrowerName) {
                        if (fullBorrowerName.includes(',')) {
                            const parts = fullBorrowerName.split(',');
                            lastName = parts[0]?.trim() || '';
                            firstName = parts.slice(1).join(',').trim() || '';
                        } else {
                            const parts = fullBorrowerName.split(' ');
                            if (parts.length >= 2) {
                                firstName = parts[0];
                                lastName = parts.slice(1).join(' ');
                            } else {
                                firstName = fullBorrowerName;
                                lastName = '---';
                            }
                        }
                    }

                    const borrowerLabel = (lastName && firstName && lastName !== '---') ? `${lastName}, ${firstName}` : (fullBorrowerName || firstName || 'N/A');
                    const isFileDuplicateName = seenNames.has(borrowerLabel.toUpperCase());
                    if (borrowerLabel !== 'N/A') seenNames.add(borrowerLabel.toUpperCase());

                    const existingByName = allLoans.some(l => l.borrowerName.toUpperCase() === borrowerLabel.toUpperCase() && l.status !== MovingStatus.PAID);
                    const existingByCode = allLoans.some(l => l.code === code);

                    const reportedDate = excelDateToJS(val('reported'));
                    const dueDate = excelDateToJS(val('due'));

                    // --- CONSOLIDATED VALIDATION ---

                    if (!code) errors.push(`Missing: Client Code`);
                    if (isFileDuplicateName) errors.push(`Duplicate: Name "${borrowerLabel}" exists in this file`);
                    
                    if (importMode === 'replace') {
                        // In replace mode, if they exist by name but have a different code, we might want to flag it?
                        // Or if they exist by code, it's an update, so it's valid.
                        if (existingByName && !existingByCode) {
                            errors.push(`Duplicate Name Warning: ${borrowerLabel} has an active account under a different code`);
                        }
                    } else if (importMode === 'wipe') {
                        // In wipe mode, existing database records do not matter since they will be deleted.
                    } else {
                        // Fallback/Legacy
                        if (existingByName) errors.push(`Duplicate: ${borrowerLabel} has an active account`);
                    }

                    if (!firstName || firstName === 'undefined') errors.push(`Missing: First Name`);
                    if (!lastName || lastName === 'undefined') errors.push(`Missing: Last Name`);
                    if (!reportedDate) errors.push(`Missing: Reported Month`);
                    if (!dueDate) errors.push(`Missing: Due Date`);
                    if (!outstandingValue && outstanding === 0) errors.push(`Missing: O/S Balance`);
                    if (!val('area')) errors.push(`Missing: Area`);
                    if (!val('city')) errors.push(`Missing: City`);
                    if (!val('barangay')) errors.push(`Missing: Barangay`);

                    const loanData: Loan = {
                        id: Math.random().toString(36).substring(2, 9),
                        code,
                        firstName,
                        lastName,
                        borrowerName: (lastName && firstName && lastName !== '---') ? `${lastName}, ${firstName}` : (fullBorrowerName || firstName || 'N/A'),
                        collector: collector?.nickname || collector?.name || collectorNickname || 'N/A',
                        area: String(val('area') || 'N/A'),
                        city: String(val('city') || 'N/A'),
                        barangay: String(val('barangay') || 'N/A'),
                        fullAddress: String(val('Full Address') || val('Address') || ''),
                        monthReported: reportedDate.substring(0, 7),
                        dueDate: dueDate,
                        outstandingBalance: outstanding,
                        amountCollected: 0,
                        runningBalance: outstanding,
                        status: (val('status') === 'M' ? MovingStatus.MOVING : (val('status') || MovingStatus.MOVING)) as MovingStatus,
                        location: (val('loc') || 'L') as LocationStatus || LocationStatus.LOCATED,
                        branch: rowBranch,
                        contactNumber: String(val('contactnumber') || 'N/A'),
                        aiPriority: PriorityLevel.LOWEST,
                        payments: [],
                        remarks: [],
                        history: []
                    };

                    // For display consistency in the preview table
                    const displayData = {
                        ...loanData,
                        original: {
                            'Collector': collectorNickname,
                            'Area': val('area'),
                            'City': val('city'),
                            'Barangay': val('barangay'),
                            'Client Code': code,
                            'FirstName': firstName,
                            'LastName': lastName,
                            'ReportedMonth': reportedDate,
                            'DueDate': dueDate,
                            'OutstandingBalance': outstanding,
                            'LocatedStatus': val('loc'),
                            'MovingStatus': val('status'),
                            'ContactNumber': val('contactnumber')
                        }
                    };

                    return {
                        data: loanData,
                        isValid: errors.length === 0,
                        errors,
                        original: displayData.original
                    };
                });

                setPreviewData(processed);
                setIsProcessing(false);
            } catch (err) {
                console.error("Parse Error:", err);
                setIsProcessing(false);
                alert("Failed to parse file. Please ensure it's a valid Excel/CSV file.");
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        const validRows = previewData.filter(p => p.isValid).map(p => p.data as Loan);
        if (validRows.length === 0) return;

        setIsUploading(true);
        try {
            if (importType === 'address') {
                const addresses = validRows.map(l => ({ code: l.code, address: l.fullAddress }));
                await store.bulkUpdateAddresses(addresses, currentUser.username, currentUser.role, importMode);
                setSummary({
                    total: previewData.length,
                    success: validRows.length,
                    failed: previewData.length - validRows.length
                });
            } else {
                const result = await store.bulkAddLoans(validRows, currentUser.username, currentUser.role, importMode, selectedBranch);
                setSummary({
                    total: previewData.length,
                    success: result.importedCount,
                    failed: previewData.length - validRows.length,
                    deleted: result.deletedCount,
                    skipped: result.skippedCount
                });
            }
        } catch (err: any) {
            console.error("Import Error:", err);
            alert(err.message || "Failed to import records.");
        } finally {
            setIsUploading(false);
        }
    };

    const downloadErrorReport = () => {
        const errorData = previewData.filter(p => !p.isValid).map(p => ({
            ...p.original,
            'ERROR REASONS': p.errors.join('; ')
        }));

        if (errorData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(errorData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Errors");
        XLSX.writeFile(wb, `Import_Errors_${new Date().getTime()}.xlsx`);
    };

    if (summary) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 text-center animate-slideUp">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-4xl mb-6">✅</div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Import Complete</h2>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Processed</p>
                            <p className="text-xl font-black text-slate-800">{summary.total}</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Imported</p>
                            <p className="text-xl font-black text-emerald-700">{summary.success}</p>
                        </div>
                    </div>

                    {(summary.deleted !== undefined || summary.skipped !== undefined || summary.failed > 0) && (
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {summary.deleted !== undefined && summary.deleted > 0 && (
                                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Wiped</p>
                                    <p className="text-lg font-bold text-red-600">{summary.deleted}</p>
                                </div>
                            )}
                            {summary.skipped !== undefined && summary.skipped > 0 && (
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Skipped</p>
                                    <p className="text-lg font-bold text-blue-600">{summary.skipped}</p>
                                </div>
                            )}
                            {summary.failed > 0 && (
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Errors</p>
                                    <p className="text-lg font-bold text-orange-600">{summary.failed}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {summary.failed > 0 && (
                        <button
                            onClick={downloadErrorReport}
                            className="mt-6 text-xs font-bold text-orange-500 hover:underline"
                        >
                            Download Error Report
                        </button>
                    )}
                    <button
                        onClick={() => {
                            store.refresh();
                            onClose();
                        }}
                        className="w-full mt-10 py-4 bg-[#064e3b] text-white font-black rounded-2xl shadow-md shadow-emerald-900/10 transition-all duration-300 hover:bg-black hover:-translate-y-0.5 hover:shadow-xl uppercase tracking-widest text-xs"
                    >
                        Finish & View Grid
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-50 w-full max-w-7xl h-[90vh] rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col animate-slideUp border border-white/20">
                {/* --- HEADER --- */}
                <div className="bg-[#064e3b] p-8 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight uppercase">Bulk Client Import</h2>
                        <p className="text-emerald-100/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                            Auditing Portfolio Data • Branch: {selectedBranch}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={downloadErrorReport}
                            disabled={!previewData.some(p => !p.isValid)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Export Errors
                        </button>
                        <button
                            onClick={handleCloseRequest}
                            className="p-3 hover:bg-white/10 rounded-2xl transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-10">
                    {/* SECTION A: IMPORT SETTINGS */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">1. Import Configuration</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Import Type Selector */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Protocol Selection</p>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => { setImportType('portfolio'); setPreviewData([]); setFile(null); }}
                                        className={`flex-1 p-6 rounded-[2rem] border-2 transition-all text-left ${importType === 'portfolio' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-900/5' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${importType === 'portfolio' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>📁</div>
                                            <p className={`text-sm font-black uppercase tracking-tight ${importType === 'portfolio' ? 'text-emerald-900' : 'text-slate-400'}`}>Full Portfolio</p>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Upload master client records with balances, status, and collector info.</p>
                                    </button>
                                    <button 
                                        onClick={() => { setImportType('address'); setPreviewData([]); setFile(null); }}
                                        className={`flex-1 p-6 rounded-[2rem] border-2 transition-all text-left ${importType === 'address' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-900/5' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${importType === 'address' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>📍</div>
                                            <p className={`text-sm font-black uppercase tracking-tight ${importType === 'address' ? 'text-emerald-900' : 'text-slate-400'}`}>Address Only</p>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Supplement existing loans with detailed field addresses using code lookup.</p>
                                    </button>
                                </div>
                            </div>

                            {/* Handling Mode Selector */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Conflict Management</p>
                                <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                    <button 
                                        onClick={() => setImportMode('replace')}
                                        className={`flex flex-col items-center justify-center p-4 rounded-[1.5rem] transition-all gap-2 ${importMode === 'replace' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:bg-slate-50'}`}
                                    >
                                        <span className="text-lg">🔄</span>
                                        <p className="text-[9px] font-black uppercase tracking-widest">Replace</p>
                                    </button>
                                    <button 
                                        onClick={() => setImportMode('wipe')}
                                        className={`flex flex-col items-center justify-center p-4 rounded-[1.5rem] transition-all gap-2 ${importMode === 'wipe' ? 'bg-red-500 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:bg-red-50'}`}
                                    >
                                        <span className="text-lg">💥</span>
                                        <p className="text-[9px] font-black uppercase tracking-widest">Wipe All</p>
                                    </button>
                                    <button 
                                        onClick={() => setImportMode('new-only')}
                                        className={`flex flex-col items-center justify-center p-4 rounded-[1.5rem] transition-all gap-2 ${importMode === 'new-only' ? 'bg-blue-500 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:bg-blue-50'}`}
                                    >
                                        <span className="text-lg">➕</span>
                                        <p className="text-[9px] font-black uppercase tracking-widest">Append</p>
                                    </button>
                                </div>
                                <p className="px-5 text-[9px] font-bold text-slate-400 uppercase text-center tracking-widest">
                                    {importMode === 'replace' ? 'Updates matched records. Keeps unique ones.' : 
                                     importMode === 'wipe' ? '⚠️ PERMANENTLY deletes branch records before import.' : 
                                     'Only adds new records. Skips existing codes.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION B: FILE UPLOAD */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">2. Binary Source Upload</h3>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex-1 h-36 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group ${file ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/10'}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                                <div className="p-3 rounded-2xl bg-slate-50 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-slate-400 group-hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{file ? file.name : 'Drop Portfolio File Here'}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Supports EXCEL (.XLSX) or CSV formats</p>
                                </div>
                            </div>

                            <div className="w-full md:w-72 bg-[#f8fbfa] p-8 rounded-[2.5rem] border border-emerald-100/50 flex flex-col justify-center items-center text-center">
                                <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.25em] mb-4">Structure Guide</p>
                                <button
                                    onClick={() => {
                                        const template = importType === 'address' ? [
                                            ['Code', 'Borrower\'s Name', 'Address'],
                                            ['1001', 'DELA CRUZ, JUAN', '123 Main St, Brgy. San Bartolome']
                                        ] : [
                                            ['Client Code', 'First Name', 'Last Name', 'Collector', 'Area', 'City', 'Barangay', 'Full Address', 'Reported Month', 'Due Date', 'Outstanding Balance', 'Located Status', 'Moving Status', 'Assigned Branch'],
                                            ['873', 'ARLEN', 'ABAÑO', 'ALDIE', 'Ormoc', 'Ormoc', 'Linao', 'Linao, Ormoc City', '2018-08', '2018-06-03', '1637', 'L', 'M', selectedBranch === Branch.ALL ? Branch.NAVAL : selectedBranch]
                                        ];
                                        const ws = XLSX.utils.aoa_to_sheet(template);
                                        const wb = XLSX.utils.book_new();
                                        XLSX.utils.book_append_sheet(wb, ws, "Template");
                                        XLSX.writeFile(wb, "Client_Import_Template.xlsx");
                                    }}
                                    className="w-full py-4 bg-white border-2 border-emerald-100 text-emerald-600 font-black rounded-2xl hover:bg-emerald-50 transition-all uppercase tracking-widest text-[10px] shadow-sm hover:shadow-md"
                                >
                                    📥 Download CSV Template
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SECTION C: DATA PREVIEW TABLE */}
                    <div ref={tableContainerRef} className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">3. Pre-Import Audit Preview</h3>
                            </div>
                            
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden flex divide-x divide-slate-100 shadow-sm transition-all hover:shadow-md">
                                <div className="px-5 py-2.5 flex items-center gap-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viewing Protocol:</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>All</button>
                                        <button onClick={() => setFilter('valid')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'valid' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Valid</button>
                                        <button onClick={() => setFilter('invalid')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'invalid' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Failures</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-[500px]">
                            {previewData.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-20 gap-4">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-4xl shadow-inner animate-pulse">📊</div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Ready for ingestion</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Upload a binary file to populate the audit grid.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto custom-scrollbar relative">
                                    <table className="w-full text-[11px] text-left border-collapse table-fixed">
                                        <thead className="sticky top-0 z-[50] bg-[#064e3b] text-white shadow-xl">
                                            <tr>
                                                <th className="sticky left-0 bg-[#063b2c] z-[60] px-6 py-5 font-black uppercase tracking-widest w-[120px] shadow-[4px_0_10px_-2px_rgba(0,0,0,0.1)]">Client Code</th>
                                                <th className="px-6 py-5 font-black uppercase tracking-widest w-[180px]">Borrower Name</th>
                                                {importType === 'portfolio' && (
                                                    <>
                                                        <th className="px-6 py-5 font-black uppercase tracking-widest w-[110px]">Collector</th>
                                                        <th className="px-6 py-5 font-black uppercase tracking-widest w-[100px]">Area</th>
                                                        <th className="px-6 py-5 font-black uppercase tracking-widest w-[100px]">City</th>
                                                        <th className="px-6 py-5 font-black uppercase tracking-widest w-[110px]">Reported</th>
                                                        <th className="px-6 py-5 font-black uppercase tracking-widest w-[120px] text-right">O/S Balance</th>
                                                    </>
                                                )}
                                                {importType === 'address' && <th className="px-6 py-5 font-black uppercase tracking-widest w-[400px]">Physical Address</th>}
                                                <th className="px-6 py-5 font-black uppercase tracking-widest w-[180px] text-center">Audit Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData
                                                .filter(p => filter === 'all' ? true : filter === 'valid' ? p.isValid : !p.isValid)
                                                .map((row, i) => (
                                                    <tr key={i} className={`group transition-all hover:bg-slate-50 ${!row.isValid ? 'bg-red-50/20' : 'bg-white'}`}>
                                                        <td className={`sticky left-0 z-10 px-6 py-5 font-black transition-colors ${!row.isValid ? 'bg-red-50 text-red-700' : 'bg-white group-hover:bg-slate-100 text-emerald-600'} shadow-[4px_0_10px_-2px_rgba(0,0,0,0.05)]`}>
                                                            {row.data.code}
                                                        </td>
                                                        <td className="px-6 py-5 font-bold text-slate-800 uppercase truncate" title={row.data.borrowerName}>{row.data.borrowerName}</td>
                                                        {importType === 'portfolio' && (
                                                            <>
                                                                <td className="px-6 py-5 font-black text-emerald-700/60 uppercase truncate">{row.data.collector}</td>
                                                                <td className="px-6 py-5 text-slate-500 font-bold uppercase truncate">{row.data.area}</td>
                                                                <td className="px-6 py-5 text-slate-500 font-bold uppercase truncate">{row.data.city}</td>
                                                                <td className="px-6 py-5 text-slate-500 font-bold">{formatReportedMonth(row.data.monthReported)}</td>
                                                                <td className="px-6 py-5 text-right font-black text-slate-800">₱{row.data.outstandingBalance?.toLocaleString()}</td>
                                                            </>
                                                        )}
                                                        {importType === 'address' && (
                                                            <td className="px-6 py-5 text-slate-600 font-bold max-w-[400px] truncate" title={row.data.fullAddress}>{row.data.fullAddress}</td>
                                                        )}
                                                        <td className="px-6 py-5">
                                                            <div className="flex flex-col items-center">
                                                                {row.isValid ? (
                                                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> READY
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1.5 items-center">
                                                                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-200">❌ REJECTED</span>
                                                                        <span className="text-[8px] text-red-500 font-black italic max-w-[140px] text-center leading-none uppercase">{row.errors[0]}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- FOOTER / ACTIONS --- */}
                <div className="p-10 bg-slate-100/50 border-t border-slate-200 shrink-0 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex gap-6">
                        <button onClick={() => setFilter('all')} className={`group flex items-center gap-6 p-5 rounded-3xl border-2 transition-all ${filter === 'all' ? 'bg-slate-900 border-slate-900 shadow-xl scale-105' : 'bg-white border-white hover:border-slate-200 shadow-sm'}`}>
                            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-xl ${filter === 'all' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'}`}>📑</div>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-2 ${filter === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>Total Scanned</p>
                                <p className={`text-2xl font-black leading-none ${filter === 'all' ? 'text-white' : 'text-slate-900'}`}>{previewData.length}</p>
                            </div>
                        </button>

                        <button onClick={() => setFilter('valid')} className={`group flex items-center gap-6 p-5 rounded-3xl border-2 transition-all ${filter === 'valid' ? 'bg-emerald-600 border-emerald-600 shadow-xl scale-105' : 'bg-white border-white hover:border-emerald-100 shadow-sm'}`}>
                            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-xl ${filter === 'valid' ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-500'}`}>✅</div>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-2 ${filter === 'valid' ? 'text-emerald-100' : 'text-slate-400'}`}>Audited Clean</p>
                                <p className={`text-2xl font-black leading-none ${filter === 'valid' ? 'text-white' : 'text-emerald-600'}`}>{previewData.filter(p => p.isValid).length}</p>
                            </div>
                        </button>

                        <button onClick={() => setFilter('invalid')} className={`group flex items-center gap-6 p-5 rounded-3xl border-2 transition-all ${filter === 'invalid' ? 'bg-red-600 border-red-600 shadow-xl scale-105' : 'bg-white border-white hover:border-red-100 shadow-sm'}`}>
                            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-xl ${filter === 'invalid' ? 'bg-white/10 text-white' : 'bg-red-50 text-red-500'}`}>❌</div>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-2 ${filter === 'invalid' ? 'text-red-100' : 'text-slate-400'}`}>Audit Failures</p>
                                <p className={`text-2xl font-black leading-none ${filter === 'invalid' ? 'text-white' : 'text-red-600'}`}>{previewData.filter(p => !p.isValid).length}</p>
                            </div>
                        </button>
                    </div>

                    <div className="flex gap-4 items-center">
                        <button
                            onClick={handleCloseRequest}
                            className="px-10 py-5 font-black text-slate-400 hover:text-slate-800 transition-all uppercase tracking-[0.2em] text-xs"
                        >
                            Abort Sync
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={previewData.length === 0 || previewData.some(p => !p.isValid) || isUploading}
                            className="px-16 py-6 bg-emerald-600 text-white font-black rounded-3xl shadow-xl shadow-emerald-900/20 transition-all duration-500 hover:bg-emerald-700 hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] uppercase tracking-[0.25em] text-[11px] disabled:opacity-30 disabled:grayscale disabled:hover:translate-y-0"
                        >
                            {isUploading ? (
                                <span className="flex items-center gap-4">
                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Syncing to Ledger...
                                </span>
                            ) : (
                                "Initiate Data Sync"
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={showExitConfirm}
                title="Exit Bulk Import"
                message="Are you sure you want to exit the Bulk Client Import? Any uploaded file or previewed data will be lost."
                onConfirm={onClose}
                onCancel={() => setShowExitConfirm(false)}
                type="danger"
                confirmLabel="Yes, Exit"
                cancelLabel="Cancel"
            />
        </div>
    );
};

export default BulkImportModal;
