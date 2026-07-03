
import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { User, UserRole, UserStatus, PriorityLevel, DemandLetterStatus, DemandLetterType, Branch, canAccessPayments, canManageUsers, getUserRoleLabel, isAllBranchRole } from './types.ts';
import { store } from './services/dataStore.ts';
import Sidebar from './components/Sidebar.tsx';
import LoginPage from './components/LoginPage.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import ThemeToggle from './components/ThemeToggle.tsx';

const Dashboard = React.lazy(() => import('./components/Dashboard.tsx'));
const LoanGrid = React.lazy(() => import('./components/LoanGrid.tsx'));
const PaymentForm = React.lazy(() => import('./components/PaymentForm.tsx'));
const Reports = React.lazy(() => import('./components/Reports.tsx'));
const UserManagement = React.lazy(() => import('./components/UserManagement.tsx'));
const ClientUpdate = React.lazy(() => import('./components/ClientUpdate.tsx'));
const PTPEscalation = React.lazy(() => import('./components/PTPEscalation.tsx'));
const Collectors = React.lazy(() => import('./components/Collectors.tsx'));
const CollectionSheet = React.lazy(() => import('./components/CollectionSheet.tsx'));
const DemandLetterComponent = React.lazy(() => import('./components/DemandLetter.tsx'));
const ClientActionTracker = React.lazy(() => import('./components/ClientActionTracker.tsx'));
const WriteOff = React.lazy(() => import('./components/WriteOff.tsx'));
const BackupRestore = React.lazy(() => import('./components/BackupRestore.tsx'));
const DailyCollectionReport = React.lazy(() => import('./components/DailyCollectionReport.tsx'));
const Documentation = React.lazy(() => import('./components/Documentation.tsx'));
const RecycleBin = React.lazy(() => import('./components/RecycleBin.tsx'));
const MigrationCenter = React.lazy(() => import('./components/MigrationCenter.tsx'));
const UserProfileSettings = React.lazy(() => import('./components/UserProfileSettings.tsx'));

type LegendItem = {
  term: string;
  meaning: string;
};

const commonLoanLegend: LegendItem[] = [
  { term: 'M', meaning: 'Moving account' },
  { term: 'NM', meaning: 'Not Moving' },
  { term: 'NMSR', meaning: 'Not Moving Since Release' },
  { term: 'L', meaning: 'Located' },
  { term: 'NL', meaning: 'Not Located' },
];

const getModuleLegend = (activeTab: string): LegendItem[] => {
  if (activeTab.startsWith('dashboard')) {
    return [
      { term: 'KPI', meaning: 'Key Performance Indicator' },
      { term: 'NM', meaning: 'Not Moving' },
      { term: 'NMSR', meaning: 'Not Moving Since Release' },
      { term: 'PTP', meaning: 'Promise to Pay' },
      { term: 'FU', meaning: 'Follow-up' },
      { term: 'AI', meaning: 'Artificial Intelligence advisor' },
      { term: 'Avg', meaning: 'Average' },
      { term: 'Accts', meaning: 'Accounts' },
    ];
  }

  if (activeTab.startsWith('loans')) {
    return [
      ...commonLoanLegend,
      { term: 'Loc', meaning: 'Location status' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
      { term: 'XLSX', meaning: 'Excel workbook file' },
    ];
  }

  if (activeTab.startsWith('client-update')) {
    return [
      { term: 'PTP', meaning: 'Promise to Pay' },
      { term: 'FU', meaning: 'Follow-up' },
      { term: 'DL', meaning: 'Demand Letter' },
      { term: 'VL', meaning: 'Visit Log' },
      { term: 'Pymnt', meaning: 'Payment' },
      { term: 'AI', meaning: 'Artificial Intelligence priority' },
      { term: 'CRIT', meaning: 'Critical or priority cases' },
      { term: 'MON', meaning: 'Close monitoring' },
      { term: 'F/U', meaning: 'Scheduled follow-up' },
      { term: 'NONE', meaning: 'No activity or no update yet' },
      { term: 'INTRX', meaning: 'Interactions or total update count' },
      { term: 'CMT', meaning: 'Commitment' },
      { term: 'Payment Cmt.', meaning: 'Payment commitment' },
      { term: 'ACTIVE', meaning: 'Has active payment posted today' },
      { term: '1st/2nd/3rd DL', meaning: 'Demand Letter stage' },
      { term: 'Outcome', meaning: 'Result of the commitment update' },
    ];
  }

  if (activeTab === 'ptp-escalation') {
    return [
      { term: 'PTP', meaning: 'Promise to Pay' },
      { term: 'FU', meaning: 'Follow-up' },
      { term: 'Super Action', meaning: 'Required management-level action' },
      { term: 'Missed', meaning: 'Commitment date passed without a good payment' },
      { term: 'Schedule', meaning: 'Recurring scheduled payment' },
    ];
  }

  if (activeTab.startsWith('receive-payment')) {
    return [
      { term: 'OR', meaning: 'Official Receipt number' },
      { term: 'PHP', meaning: 'Philippine Peso' },
      { term: 'GOOD', meaning: 'Active or valid payment' },
      { term: 'REVERSED', meaning: 'Voided payment record' },
      { term: 'L', meaning: 'Located' },
      { term: 'NL', meaning: 'Not Located' },
    ];
  }

  if (activeTab === 'collection-sheet') {
    return [
      { term: 'CS', meaning: 'Collection Sheet' },
      { term: 'RB', meaning: 'Running Balance' },
      { term: 'Accts', meaning: 'Accounts' },
      { term: 'XLSX', meaning: 'Excel workbook file' },
    ];
  }

  if (activeTab === 'dcr') {
    return [
      { term: 'DCR', meaning: 'Daily Collection Report' },
      { term: 'OR', meaning: 'Official Receipt number' },
      { term: 'RB', meaning: 'Running Balance' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
    ];
  }

  if (activeTab.startsWith('reports')) {
    return [
      { term: 'Accts', meaning: 'Accounts' },
      { term: 'Avg', meaning: 'Average' },
      { term: 'DWO', meaning: 'Dead Write-Off' },
      { term: 'Recon', meaning: 'Reconstructed account payment remark' },
      { term: 'RB', meaning: 'Running Balance' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
    ];
  }

  if (activeTab === 'demand-letters') {
    return [
      { term: 'DL', meaning: 'Demand Letter' },
      { term: 'PTP', meaning: 'Promise to Pay' },
      { term: 'FU', meaning: 'Follow-up' },
      { term: '1st/2nd/3rd', meaning: 'Demand letter stage' },
    ];
  }

  if (activeTab === 'action-tracker') {
    return [
      { term: 'PTP', meaning: 'Promise to Pay' },
      { term: 'FU', meaning: 'Follow-up' },
      { term: 'DL', meaning: 'Demand Letter' },
      { term: 'WO', meaning: 'Write-Off' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
      ...commonLoanLegend,
    ];
  }

  if (activeTab === 'write-off') {
    return [
      { term: 'WO', meaning: 'Write-Off' },
      { term: 'PHP', meaning: 'Philippine Peso' },
      { term: 'DWO', meaning: 'Dead Write-Off' },
      { term: 'NL', meaning: 'Not Located' },
    ];
  }

  if (activeTab === 'migration') {
    return [
      { term: 'JCASH', meaning: 'External payment/source system' },
      { term: 'SYNC', meaning: 'Synchronize or migrate records' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
      { term: 'DB', meaning: 'Database' },
    ];
  }

  if (activeTab === 'documentation') {
    return [
      { term: 'DOC', meaning: 'Documentation' },
      { term: 'DCR', meaning: 'Daily Collection Report' },
      { term: 'OR', meaning: 'Official Receipt number' },
      { term: 'AI', meaning: 'Artificial Intelligence' },
    ];
  }

  if (activeTab === 'users') {
    return [
      { term: 'SUPER_ADMIN', meaning: 'Full user-management access' },
      { term: 'ROLE', meaning: 'Account role selected during registration' },
      { term: 'BRANCH', meaning: 'Assigned data branch for branch-scoped users' },
    ];
  }

  if (activeTab === 'database') {
    return [
      { term: 'DB', meaning: 'Database' },
      { term: 'CSV', meaning: 'Comma-Separated Values file' },
      { term: 'Backup', meaning: 'Saved copy of system data' },
    ];
  }

  if (activeTab === 'profile-settings') {
    return [
      { term: 'Role', meaning: 'System access level assigned to the account' },
      { term: 'Branch', meaning: 'Data branch assigned to the user account' },
      { term: 'Status', meaning: 'Current login access state' },
    ];
  }

  return [];
};

const AbbreviationLegend: React.FC<{ items: LegendItem[] }> = ({ items }) => {
  if (items.length === 0) return null;

  const uniqueItems = Array.from(new Map(items.map(item => [item.term, item])).values());

  return (
    <div className="no-print mb-4 rounded-xl border border-slate-200/80 bg-white/75 px-4 py-2.5 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800/75 dark:text-slate-400">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Legend</span>
        {uniqueItems.map(item => (
          <span key={item.term} className="inline-flex items-baseline gap-1 leading-5">
            <span className="font-black uppercase text-slate-800 dark:text-slate-100">{item.term}</span>
            <span>=</span>
            <span>{item.meaning}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const getInitialBranchForUser = (user: User): Branch => {
  if (isAllBranchRole(user.role)) {
    return (localStorage.getItem('melann_selected_branch') as Branch) || Branch.ALL;
  }

  return user.branch === Branch.ALL ? Branch.ORMOC : user.branch;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch>(Branch.ALL);
  const [migrationBadgeCount, setMigrationBadgeCount] = useState(0);
  const [storeVersion, setStoreVersion] = useState(0);
  const [hasVisitedMigration, setHasVisitedMigration] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('melann_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setSelectedBranch(getInitialBranchForUser(user));
    }

    // Subscribe to store changes (especially for async DB loads)
    const unsubscribe = store.subscribe(() => {
      // Trigger a re-render when data arrives from DB
      setIsAppLoading(false);
      setStoreVersion(version => version + 1);
    });

    // Initial refresh to trigger load from DB
    store.refresh();

    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('melann_user', JSON.stringify(user));
    setSelectedBranch(getInitialBranchForUser(user));
  };

  const handleBranchChange = (branch: Branch) => {
    setSelectedBranch(branch);
    if (currentUser && isAllBranchRole(currentUser.role)) {
      localStorage.setItem('melann_selected_branch', branch);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('melann_user');
    setCurrentUser(null);
    setMigrationBadgeCount(0);
    setHasVisitedMigration(false);
  };

  const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('melann_user', JSON.stringify(user));
  };

  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    const refreshMigrationBadge = async () => {
      try {
        const batches = await store.getMigrationBatches();
        if (!isMounted) return;
        setMigrationBadgeCount(batches.reduce((sum, batch) => sum + batch.detectedCount, 0));
      } catch (err) {
        console.error('Migration badge load failed:', err);
      }
    };

    refreshMigrationBadge();
    return () => { isMounted = false; };
  }, [currentUser]);

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    const pendingUserCount = canManageUsers(currentUser.role)
      ? store.getUsers().filter(user => user.status === UserStatus.PENDING).length
      : 0;
    const loans = store.getLoans(selectedBranch);
    const demandLetters = store.getDemandLetters(selectedBranch);
    const date = new Date();
    const todayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const loanMsgs = loans.flatMap(l => {
      const msgs = [];
      if (l.aiPriority === PriorityLevel.TOP) {
        msgs.push({ type: 'TOP', title: 'Action Needed', body: `${l.borrowerName} is marked as TOP Priority.` });
      }
      if (l.followUpDate === todayStr) {
        msgs.push({ type: 'FOLLOW_UP', title: 'Follow-up Today', body: `Scheduled visit for ${l.borrowerName} today.` });
      }
      if (l.dueDate === todayStr) {
        msgs.push({ type: 'DUE', title: 'Payment Due', body: `${l.borrowerName}'s payment is due today.` });
      }
      return msgs;
    });

    const dlMsgs = demandLetters.flatMap(dl => {
      const msgs = [];
      const isSettled = dl.status === DemandLetterStatus.SETTLED;
      if (!isSettled) {
        if (dl.followUpDate && dl.followUpDate <= todayStr) {
          msgs.push({ type: 'TOP', title: 'Demand Letter Follow-up', body: `${dl.borrowerName} is due for follow-up (${dl.type}).` });
        } else if (dl.type === DemandLetterType.THIRD) {
          msgs.push({ type: 'TOP', title: 'Constant Follow-up', body: `${dl.borrowerName} requires constant follow-up (3rd DL).` });
        }
      }
      return msgs;
    });

    const userMsgs = pendingUserCount > 0
      ? [{
        type: 'PENDING_USERS',
        title: 'Pending Account Approval',
        body: `${pendingUserCount} account${pendingUserCount === 1 ? '' : 's'} waiting for administration approval.`
      }]
      : [];

    return [...userMsgs, ...loanMsgs, ...dlMsgs].slice(0, 5);
  }, [selectedBranch, currentUser, storeVersion]);

  const pendingUserCount = useMemo(() => {
    if (!currentUser || !canManageUsers(currentUser.role)) return 0;
    return store.getUsers().filter(user => user.status === UserStatus.PENDING).length;
  }, [currentUser, storeVersion]);

  useEffect(() => {
    if (activeTab === 'migration') {
      setHasVisitedMigration(true);
    }
  }, [activeTab]);

  const shouldKeepMigrationMounted = hasVisitedMigration || activeTab === 'migration';

  const moduleLegend = useMemo(() => getModuleLegend(activeTab), [activeTab]);
  const canUsePayments = currentUser ? canAccessPayments(currentUser.role) : false;

  useEffect(() => {
    if (activeTab.startsWith('receive-payment') && !canUsePayments) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canUsePayments]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-[#064e3b] dark:bg-[#022c22] flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 melann-shell-grid"></div>
        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-teal-200/10 blur-3xl"></div>
        <div className="bg-white/95 dark:bg-slate-800/95 p-10 rounded-3xl shadow-2xl shadow-emerald-950/30 w-full max-w-md border border-white/70 dark:border-slate-700/80 border-t-4 border-t-emerald-500 transition-colors duration-300 relative">
          <div className="flex justify-center mb-6">
            <div className="text-5xl animate-bounce">📊</div>
          </div>
          <h1 className="text-2xl font-black text-center text-[#1e293b] dark:text-white mb-2 uppercase tracking-tighter transition-colors duration-300">
            Melann Lending<br />
            <span className="text-lg text-emerald-600 dark:text-emerald-400 block mt-1">Past Due and Report Monitoring</span>
          </h1>
          <p className="text-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8 transition-colors duration-300">System Initializing...</p>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-9 w-9 border-4 border-emerald-100 border-t-emerald-600 dark:border-slate-700 dark:border-t-emerald-400"></div>
            <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors duration-300">Secure Handshake</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#eef4f2] dark:bg-slate-950 overflow-hidden transition-colors duration-300 melann-shell-grid">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role}
        onLogout={handleLogout}
        username={currentUser.username}
        selectedBranch={selectedBranch}
        migrationCount={migrationBadgeCount}
        pendingUserCount={pendingUserCount}
      />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <header className="melann-glass-header border-b border-white/80 dark:border-slate-700/80 min-h-16 flex items-center justify-between gap-4 px-5 md:px-8 sticky top-0 z-40 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.8)] transition-colors duration-300">
          <div className="flex items-center gap-4 md:gap-6 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl text-slate-500 dark:text-slate-400 transition-all duration-300 border border-transparent hover:border-emerald-100 dark:hover:border-slate-600"
              title={isSidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span className="hidden sm:block h-8 w-1 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.45)]"></span>
              <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300 truncate">
                {activeTab.replace(/-/g, ' ')}
              </h2>
            </div>

            {isAllBranchRole(currentUser.role) && (
              <div className="hidden lg:flex ml-2 xl:ml-8 bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 p-1 rounded-xl gap-1 transition-colors duration-300 shadow-inner">
                {[Branch.ALL, Branch.NAVAL, Branch.ORMOC].map((b) => (
                  <button
                    key={b}
                    onClick={() => handleBranchChange(b)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${selectedBranch === b ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/20' : 'text-slate-500 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-slate-700'
                      }`}
                  >
                    {b === Branch.ALL ? 'All Branches' : b.replace(' Branch', '')}
                  </button>
                ))}
              </div>
            )}
            {!isAllBranchRole(currentUser.role) && (
              <div className="hidden lg:block ml-2 xl:ml-8 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors duration-300 border border-emerald-100 dark:border-emerald-800/50">
                📍 {selectedBranch}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2.5 rounded-xl transition-all duration-300 relative border ${showNotifications ? 'bg-emerald-50 dark:bg-slate-700/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-slate-600' : 'text-slate-400 dark:text-slate-500 border-transparent hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-100 dark:hover:border-slate-600'}`}
                title="Notifications"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 dark:bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-[calc(100vw-2rem)] max-w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 dark:border-slate-700 overflow-hidden animate-slideDown z-50">
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notifications</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs font-medium">No alerts for today.</div>
                    ) : notifications.map((n, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          if (n.type === 'PENDING_USERS') {
                            setActiveTab('users');
                            setShowNotifications(false);
                          }
                        }}
                        className="group p-4 hover:bg-emerald-50 dark:hover:bg-slate-700/50 border-b border-slate-50 dark:border-slate-700 transition-all duration-300 cursor-pointer last:border-0 hover:pl-5"
                      >
                        <p className={`text-[10px] font-black uppercase mb-1 transition-colors duration-300 ${n.type === 'TOP' || n.type === 'PENDING_USERS' ? 'text-red-500 group-hover:text-red-600 dark:text-red-400 dark:group-hover:text-red-300' : 'text-blue-500 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300'}`}>{n.title}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors duration-300">{n.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setActiveTab('profile-settings');
                setShowNotifications(false);
              }}
              className={`p-2.5 rounded-xl transition-all duration-300 relative border ${
                activeTab === 'profile-settings'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-900/20'
                  : 'text-slate-400 dark:text-slate-500 border-transparent hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-100 dark:hover:border-slate-600'
              }`}
              title="Profile Settings"
              aria-label="Profile Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.75 8.25v3m1.5-1.5h-3" />
              </svg>
            </button>
            <span className="hidden sm:inline-flex text-[10px] font-black tracking-widest text-white px-3 py-1.5 bg-emerald-600 rounded-lg shadow-sm shadow-emerald-900/20 whitespace-nowrap">
              {getUserRoleLabel(currentUser.role)}
            </span>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <AbbreviationLegend items={moduleLegend} />
          <ErrorBoundary>
            <Suspense fallback={<div className="p-8 text-center text-xs font-black uppercase tracking-widest text-slate-400">Loading module...</div>}>
              {activeTab.startsWith('dashboard') && <Dashboard selectedBranch={selectedBranch} />}
              {activeTab.startsWith('loans') && <LoanGrid currentUser={currentUser} selectedBranch={selectedBranch} activeAction={activeTab === 'loans' ? null : activeTab.replace('loans-', '') as 'import' | 'add'} onActionComplete={() => setActiveTab('loans')} />}
              {activeTab.startsWith('client-update') && <ClientUpdate currentUser={currentUser} selectedBranch={selectedBranch} activeView={activeTab === 'client-update' ? 'Updates Log' : activeTab === 'client-update-advance' ? 'Follow-up' : activeTab === 'client-update-critical' ? 'Priority' : activeTab === 'client-update-monitoring' ? 'Monitoring' : activeTab === 'client-update-no-activity' ? 'No Commitments' : 'Updates Log'} />}
              {activeTab === 'ptp-escalation' && <PTPEscalation currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab.startsWith('receive-payment') && canUsePayments && <PaymentForm currentUser={currentUser} selectedBranch={selectedBranch} activeView={activeTab === 'receive-payment-reverse' ? 'reverse' : 'post'} />}
              {activeTab === 'collection-sheet' && <CollectionSheet currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'dcr' && <DailyCollectionReport selectedBranch={selectedBranch} />}
              {activeTab.startsWith('reports') && <Reports selectedBranch={selectedBranch} activeView={activeTab === 'reports-monthly' ? 'monthly-performance' : activeTab === 'reports-aging' ? 'aging' : activeTab === 'reports-dead' ? 'dead-write-off' : activeTab === 'reports-reconstructed' ? 'reconstructed' : 'performance'} />}
              {activeTab === 'demand-letters' && <DemandLetterComponent currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'action-tracker' && <ClientActionTracker currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'write-off' && <WriteOff currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'collectors' && <Collectors selectedBranch={selectedBranch} />}
              {activeTab === 'documentation' && <Documentation selectedBranch={selectedBranch} role={currentUser.role} />}
              {shouldKeepMigrationMounted && (
                <div className={activeTab === 'migration' ? 'block' : 'hidden'}>
                  <MigrationCenter currentUser={currentUser} onMigrationChange={setMigrationBadgeCount} />
                </div>
              )}
              {activeTab === 'users' && canManageUsers(currentUser.role) && <UserManagement currentUser={currentUser} />}
              {activeTab === 'database' && <BackupRestore currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'recycle-bin' && <RecycleBin currentUser={currentUser} selectedBranch={selectedBranch} />}
              {activeTab === 'profile-settings' && <UserProfileSettings currentUser={currentUser} selectedBranch={selectedBranch} onUserUpdate={handleUserUpdate} onNavigate={setActiveTab} />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default App;

