import React, { useMemo, useState } from 'react';
import { UserRole, Branch } from '../types.ts';
import logo from '../assets/logo.jpg';
import { useClientUpdates } from '../hooks/useClientUpdates.ts';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  onLogout: () => void;
  username: string;
  selectedBranch?: Branch;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeTab, setActiveTab, role, onLogout, username, selectedBranch = Branch.ALL }) => {
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  // Seen IDs state for Client Update Badges
  const [seenAdvance, setSeenAdvance] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_advance') || '[]'));
  const [seenCritical, setSeenCritical] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_critical') || '[]'));
  const [seenMonitoring, setSeenMonitoring] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_monitoring') || '[]'));
  const [seenNoActivity, setSeenNoActivity] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_no_activity') || '[]'));
  const [seenLog, setSeenLog] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_log') || '[]'));

  const { loans, topPriorityList, reminderList, closeMonitoringList, filteredMainList } = useClientUpdates(selectedBranch);

  // Compute Badge Counts
  const advanceIds = reminderList.map((r: any) => r.loan.id);
  const criticalIds = topPriorityList.map((l: any) => l.id);
  const monitoringIds = closeMonitoringList.map((l: any) => l.id);
  const noActivityIds = useMemo(() => loans.filter(l => l.remarks.length === 0).map(l => l.id), [loans]);
  const logIds = filteredMainList.map((l: any) => l.id);

  const newAdvance = advanceIds.filter(id => !seenAdvance.includes(id)).length;
  const newCritical = criticalIds.filter(id => !seenCritical.includes(id)).length;
  const newMonitoring = monitoringIds.filter(id => !seenMonitoring.includes(id)).length;
  const newNoActivity = noActivityIds.filter(id => !seenNoActivity.includes(id)).length;
  const newLog = logIds.filter(id => !seenLog.includes(id)).length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: () => <span className="text-xl">📊</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { 
      id: 'loans', 
      label: 'Loan Grid', 
      icon: () => <span className="text-xl">📋</span>, 
      roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER],
      subItems: [
        { id: 'loans-import', label: 'Import Client' },
        { id: 'loans-add', label: 'Add Client' }
      ]
    },
    { 
      id: 'client-update', 
      label: 'Client Update', 
      icon: () => <span className="text-xl">✍️</span>, 
      roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER],
      subItems: [
        { id: 'client-update-advance', label: 'Advance Reminders' },
        { id: 'client-update-critical', label: 'Critical Action' },
        { id: 'client-update-monitoring', label: 'Close Monitoring' },
        { id: 'client-update-no-activity', label: 'No Activity' }
      ]
    },
    { 
      id: 'receive-payment', 
      label: 'Payments', 
      icon: () => <span className="text-xl">💰</span>, 
      roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER],
      subItems: [
        { id: 'receive-payment-reverse', label: 'Reverse Payment' }
      ]
    },
    { id: 'collection-sheet', label: 'Collection Sheet', icon: () => <span className="text-xl">📄</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'dcr', label: 'DCR', icon: () => <span className="text-xl">📅</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { 
      id: 'reports', 
      label: 'Reports', 
      icon: () => <span className="text-xl">📉</span>, 
      roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER],
      subItems: [
        { id: 'reports-monthly', label: 'Monthly Performance' },
        { id: 'reports-aging', label: 'Aging of Receivables' }
      ]
    },
    { id: 'demand-letters', label: 'Demand Letters', icon: () => <span className="text-xl">✉️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'action-tracker', label: 'Action Tracker', icon: () => <span className="text-xl">🎯</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'collectors', label: 'Collectors', icon: () => <span className="text-xl">👥</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'documentation', label: 'Documentation', icon: () => <span className="text-[10px] font-black tracking-tight">DOC</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'users', label: 'Manage Users', icon: () => <span className="text-xl">⚙️</span>, roles: [UserRole.SUPER_ADMIN] },
    { id: 'database', label: 'Backup & Restore', icon: () => <span className="text-xl">🗄️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
  ];

  const menuItemById = Object.fromEntries(menuItems.map(item => [item.id, item]));
  const menuSections = [
    { label: 'Main', itemIds: ['dashboard'] },
    { label: 'Client & Loan Management', itemIds: ['loans'] },
    { label: 'Monitoring & Follow-Up', itemIds: ['client-update', 'action-tracker', 'demand-letters'] },
    { label: 'Payment & Collection', itemIds: ['receive-payment', 'dcr', 'collection-sheet', 'collectors'] },
    { label: 'Reports', itemIds: ['reports'] },
    { label: 'Administration', itemIds: ['documentation', 'users', 'database'] },
  ];

  const handleMenuClick = (item: any) => {
    if (!isOpen) {
      setIsOpen(true);
    }
    
    if (item.subItems) {
      setExpandedMenus(prev => ({ ...prev, [item.id]: !prev[item.id] }));
      setActiveTab(item.id); // Select parent view (default)
    } else {
      setActiveTab(item.id);
    }
  };

  const handleSubItemClick = (e: React.MouseEvent, subId: string) => {
    e.stopPropagation();
    setActiveTab(subId);

    // Reset badge logic
    if (subId === 'client-update-advance') {
      setSeenAdvance(advanceIds);
      localStorage.setItem('melann_seen_advance', JSON.stringify(advanceIds));
    } else if (subId === 'client-update-critical') {
      setSeenCritical(criticalIds);
      localStorage.setItem('melann_seen_critical', JSON.stringify(criticalIds));
    } else if (subId === 'client-update-monitoring') {
      setSeenMonitoring(monitoringIds);
      localStorage.setItem('melann_seen_monitoring', JSON.stringify(monitoringIds));
    } else if (subId === 'client-update-no-activity') {
      setSeenNoActivity(noActivityIds);
      localStorage.setItem('melann_seen_no_activity', JSON.stringify(noActivityIds));
    } else if (subId === 'client-update-log') {
      setSeenLog(logIds);
      localStorage.setItem('melann_seen_log', JSON.stringify(logIds));
    }
  };

  // Helper to check if a menu is active (either itself or a child)
  const isItemActive = (item: any) => {
    if (activeTab === item.id) return true;
    if (item.subItems) {
      return item.subItems.some((sub: any) => sub.id === activeTab);
    }
    return false;
  };

  return (
    <>
    <style>{`
      @keyframes glowPulse {
        0%   { opacity: 0.6; box-shadow: 0 0 4px rgba(30,215,96,0.4); }
        50%  { opacity: 1;   box-shadow: 0 0 12px rgba(30,215,96,0.7); }
        100% { opacity: 0.6; box-shadow: 0 0 4px rgba(30,215,96,0.4); }
      }
      .melann-sidebar-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .melann-sidebar-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .melann-sidebar-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(167, 243, 208, 0.22);
        border-radius: 999px;
      }
      .melann-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(167, 243, 208, 0.42);
      }
    `}</style>
    <aside
      className={`fixed inset-y-0 left-0 text-white transition-all duration-300 z-50 flex flex-col border-r border-emerald-200/10 shadow-2xl shadow-emerald-950/30 ${isOpen ? 'w-64' : 'w-16'}`}
      style={{
        background: 'radial-gradient(circle at 18% 0%, rgba(52,211,153,0.24) 0%, transparent 28%), linear-gradient(180deg, #0C3B2F 0%, #06261F 58%, #041B17 100%)'
      }}
    >
      <div className="px-3.5 flex items-center gap-3" style={{ paddingTop: '12px', paddingBottom: '8px' }}>
        <div
          className="shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-black/25 ring-1 ring-white/20 overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.03] hover:ring-emerald-200/50"
          style={{ width: '52px', height: '52px' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img src={logo} alt="Melann Lending" className="w-full h-full object-contain" />
        </div>
        {isOpen && (
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-[14px] tracking-[0.3px] text-[#f1f5f9] leading-tight" style={{ whiteSpace: 'normal' }}>MELANN LENDING</h1>
            <p className="text-[10px] font-bold text-[#a7f3d0] uppercase tracking-[0.3px] leading-[1.15] mt-0.5" style={{ whiteSpace: 'normal', opacity: 0.85 }}>Past Due & Report<br />Monitoring System</p>
          </div>
        )}
      </div>
      {/* GLOWING HORIZONTAL DIVIDER */}
      <div className="px-3.5" style={{ marginTop: '4px', marginBottom: '8px' }}>
        <div
          style={{
            width: '100%',
            height: '2px',
            borderRadius: '2px',
            background: 'linear-gradient(to right, rgba(30,215,96,0.05), rgba(30,215,96,0.85), rgba(30,215,96,0.05))',
            boxShadow: '0 0 6px rgba(30,215,96,0.55), 0 0 12px rgba(30,215,96,0.35)',
            animation: 'glowPulse 2.5s infinite ease-in-out',
          }}
        />
      </div>

      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto custom-scrollbar melann-sidebar-scrollbar pb-2" style={{ marginTop: '0px' }}>
        {menuSections.flatMap(section => {
          const visibleItems = section.itemIds
            .map(itemId => menuItemById[itemId])
            .filter(item => item && item.roles.includes(role));

          return visibleItems.map((item, index) => ({
            sectionLabel: index === 0 ? section.label : null,
            item,
          }));
        }).map(({ sectionLabel, item }) => {
          const isActive = isItemActive(item);
          const isExpanded = expandedMenus[item.id];
          
          return (
            <div key={item.id} className="flex flex-col">
              {isOpen && sectionLabel && (
                <p className="px-2.5 pt-2.5 pb-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#6ee7b7]/70">
                  {sectionLabel}
                </p>
              )}
              <button
                onClick={() => handleMenuClick(item)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                  isActive
                    ? 'bg-white/15 text-white shadow-lg shadow-black/20 ring-1 ring-emerald-200/20'
                    : 'text-[#d1fae5] hover:bg-white/10 hover:text-white hover:translate-x-0.5 hover:shadow-md hover:shadow-black/10'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                )}
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/0 to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex items-center gap-2.5 w-full">
                  <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-[16px] transition-all duration-300 ${
                    isActive ? 'bg-emerald-300/20 shadow-inner shadow-white/5' : 'bg-white/5 group-hover:bg-emerald-300/15'
                  } ${!isOpen && 'mx-auto'}`}>
                    <item.icon />
                  </div>
                  {isOpen && (
                    <span className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-left flex-1 flex justify-between items-center pr-1">
                      <span className="truncate">{item.label}</span>
                      {item.id === 'client-update' && (newAdvance + newCritical + newMonitoring + newNoActivity + newLog) > 0 && (
                        <span className="shrink-0 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-rose-950/30 ml-2 ring-1 ring-white/20">
                          {(newAdvance + newCritical + newMonitoring + newNoActivity + newLog) > 99 ? '99+' : (newAdvance + newCritical + newMonitoring + newNoActivity + newLog)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isOpen && item.subItems && (
                  <span className={`relative shrink-0 text-xs text-emerald-100/70 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
                
                {/* Tooltip for collapsed mode */}
                {!isOpen && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900/95 text-white text-xs font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur">
                    {item.label}
                    {item.subItems && <span className="ml-2 opacity-50 text-[10px]">(Has Submenu)</span>}
                  </div>
                )}
              </button>

              {/* Submenu */}
              {isOpen && item.subItems && (
                <div 
                  className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100 mt-0.5' : 'max-h-0 opacity-0'}`}
                >
                  <div className="flex flex-col gap-0.5 ml-6 pl-3 border-l border-emerald-200/15 py-0.5 mb-0.5">
                    {item.subItems.map((subItem) => {
                      let badgeCount = 0;
                      if (subItem.id === 'client-update-advance') badgeCount = newAdvance;
                      else if (subItem.id === 'client-update-critical') badgeCount = newCritical;
                      else if (subItem.id === 'client-update-monitoring') badgeCount = newMonitoring;
                      else if (subItem.id === 'client-update-no-activity') badgeCount = newNoActivity;
                      else if (subItem.id === 'client-update-log') badgeCount = newLog;

                      return (
                        <div key={subItem.id} className="relative group/sub">
                           {/* Tree Connector Circle (node) */}
                           <div className={`absolute top-1/2 -left-[15px] -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                             activeTab === subItem.id
                               ? 'bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                               : 'bg-[#0d4f37] group-hover/sub:bg-[#34d399]'
                           }`}></div>
                           <button
                             onClick={(e) => handleSubItemClick(e, subItem.id)}
                             className={`w-full flex items-center justify-between text-left py-1 px-2.5 rounded-lg text-[12px] font-bold transition-all duration-200 ${
                               activeTab === subItem.id
                                 ? 'bg-emerald-300/20 text-white shadow-sm ring-1 ring-emerald-200/15'
                                  : 'text-[#a7f3d0] hover:text-white hover:bg-white/10 hover:translate-x-0.5'
                             }`}
                           >
                             <span className="truncate pr-2">{subItem.label}</span>
                             {badgeCount > 0 && (
                               <span className="shrink-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ring-1 ring-white/20">
                                 {badgeCount > 99 ? '99+' : badgeCount}
                               </span>
                             )}
                           </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-2.5 py-2 border-t border-emerald-200/10 bg-black/10 transition-colors duration-300">
        {isOpen && (
          <div className="mb-1.5 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
            <p className="text-[10px] text-[#6ee7b7] uppercase font-bold tracking-widest">Authenticated</p>
            <p className="text-[13px] font-bold text-slate-100 truncate">{username}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          title={!isOpen ? "Logout" : undefined}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[#d1fae5] hover:bg-red-500/12 hover:text-red-200 transition-all group"
        >
          <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-[16px] transition-colors group-hover:bg-red-500/15 ${!isOpen && 'mx-auto'}`}>
            <span>🚪</span>
          </div>
          {isOpen && <span className="font-bold text-[13px]">Logout</span>}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
