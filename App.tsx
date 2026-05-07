
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, UserStatus, PriorityLevel, DemandLetterStatus, DemandLetterType, Branch } from './types.ts';
import { store } from './services/dataStore.ts';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import LoanGrid from './components/LoanGrid.tsx';
import PaymentForm from './components/PaymentForm.tsx';
import Reports from './components/Reports.tsx';
import UserManagement from './components/UserManagement.tsx';
import ClientUpdate from './components/ClientUpdate.tsx';
import Collectors from './components/Collectors.tsx';
import CollectionSheet from './components/CollectionSheet.tsx';
import LoginPage from './components/LoginPage.tsx';
import DemandLetterComponent from './components/DemandLetter.tsx';
import BackupRestore from './components/BackupRestore.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import DailyCollectionReport from './components/DailyCollectionReport.tsx';
import ThemeToggle from './components/ThemeToggle.tsx';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch>(Branch.ALL);

  useEffect(() => {
    const savedUser = localStorage.getItem('melann_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setSelectedBranch(user.role === UserRole.SUPER_ADMIN ? (localStorage.getItem('melann_selected_branch') as Branch || Branch.ALL) : user.branch);
    }

    // Subscribe to store changes (especially for async DB loads)
    const unsubscribe = store.subscribe(() => {
      // Trigger a re-render when data arrives from DB
      setIsAppLoading(false);
    });

    // Initial refresh to trigger load from DB
    store.refresh();

    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('melann_user', JSON.stringify(user));
    const initialBranch = user.role === UserRole.SUPER_ADMIN ? Branch.ALL : user.branch;
    setSelectedBranch(initialBranch);
  };

  const handleBranchChange = (branch: Branch) => {
    setSelectedBranch(branch);
    if (currentUser?.role === UserRole.SUPER_ADMIN) {
      localStorage.setItem('melann_selected_branch', branch);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('melann_user');
    setCurrentUser(null);
    window.location.reload();
  };

  const notifications = useMemo(() => {
    if (!currentUser) return [];
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

    return [...loanMsgs, ...dlMsgs].slice(0, 5);
  }, [selectedBranch, currentUser]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-[#064e3b] dark:bg-[#022c22] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-2xl w-full max-w-md border-t-4 border-emerald-600 transition-colors duration-300">
          <div className="flex justify-center mb-6">
            <div className="text-5xl animate-bounce">📊</div>
          </div>
          <h1 className="text-2xl font-black text-center text-[#1e293b] dark:text-white mb-2 uppercase tracking-tighter transition-colors duration-300">
            Melann Lending<br />
            <span className="text-lg text-emerald-600 dark:text-emerald-400 block mt-1">Past Due and Report Monitoring</span>
          </h1>
          <p className="text-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8 transition-colors duration-300">System Initializing...</p>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 dark:border-emerald-400"></div>
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role}
        onLogout={handleLogout}
        username={currentUser.username}
        selectedBranch={selectedBranch}
      />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? 'ml-72' : 'ml-20'}`}>
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg text-slate-500 dark:text-slate-400 transition-colors duration-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest transition-colors duration-300">
                {activeTab.replace(/-/g, ' ')}
              </h2>
            </div>

            {currentUser.role === UserRole.SUPER_ADMIN && (
              <div className="ml-8 flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl gap-1 transition-colors duration-300">
                {[Branch.ALL, Branch.NAVAL, Branch.ORMOC].map((b) => (
                  <button
                    key={b}
                    onClick={() => handleBranchChange(b)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${selectedBranch === b ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-slate-600'
                      }`}
                  >
                    {b === Branch.ALL ? 'All Branches' : b.replace(' Branch', '')}
                  </button>
                ))}
              </div>
            )}
            {currentUser.role !== UserRole.SUPER_ADMIN && (
              <div className="ml-8 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors duration-300">
                📍 {currentUser.branch}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-xl transition-all duration-300 relative ${showNotifications ? 'bg-emerald-50 dark:bg-slate-700/50 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 dark:bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slideDown z-50">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notifications</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs font-medium">No alerts for today.</div>
                    ) : notifications.map((n, i) => (
                      <div key={i} className="group p-4 hover:bg-emerald-50 dark:hover:bg-slate-700/50 border-b border-slate-50 dark:border-slate-700 transition-all duration-300 cursor-pointer last:border-0 hover:pl-5">
                        <p className={`text-[10px] font-black uppercase mb-1 transition-colors duration-300 ${n.type === 'TOP' ? 'text-red-500 group-hover:text-red-600 dark:text-red-400 dark:group-hover:text-red-300' : 'text-blue-500 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300'}`}>{n.title}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors duration-300">{n.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] font-black tracking-widest text-white px-3 py-1.5 bg-emerald-600 rounded-lg shadow-sm">
              {currentUser.role.replace('_', ' ')}
            </span>
          </div>
        </header>

        <div className="p-8">
          <ErrorBoundary>
            {activeTab.startsWith('dashboard') && <Dashboard selectedBranch={selectedBranch} />}
            {activeTab.startsWith('loans') && <LoanGrid currentUser={currentUser} selectedBranch={selectedBranch} activeAction={activeTab === 'loans' ? null : activeTab.replace('loans-', '') as 'import' | 'add'} onActionComplete={() => setActiveTab('loans')} />}
            {activeTab.startsWith('client-update') && <ClientUpdate currentUser={currentUser} selectedBranch={selectedBranch} activeView={activeTab === 'client-update' ? 'All' : activeTab === 'client-update-advance' ? 'Follow-up' : activeTab === 'client-update-critical' ? 'Priority' : activeTab === 'client-update-monitoring' ? 'Monitoring' : 'Updates Log'} />}
            {activeTab.startsWith('receive-payment') && <PaymentForm currentUser={currentUser} selectedBranch={selectedBranch} activeView={activeTab === 'receive-payment-reverse' ? 'reverse' : 'post'} />}
            {activeTab === 'collection-sheet' && <CollectionSheet currentUser={currentUser} selectedBranch={selectedBranch} />}
            {activeTab === 'dcr' && <DailyCollectionReport selectedBranch={selectedBranch} />}
            {activeTab.startsWith('reports') && <Reports selectedBranch={selectedBranch} activeView={activeTab === 'reports-monthly' ? 'monthly-performance' : activeTab === 'reports-aging' ? 'aging' : 'performance'} />}
            {activeTab === 'demand-letters' && <DemandLetterComponent currentUser={currentUser} selectedBranch={selectedBranch} />}
            {activeTab === 'collectors' && <Collectors selectedBranch={selectedBranch} />}
            {activeTab === 'users' && currentUser.role === UserRole.SUPER_ADMIN && <UserManagement currentUser={currentUser} />}
            {activeTab === 'database' && <BackupRestore currentUser={currentUser} selectedBranch={selectedBranch} />}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default App;
