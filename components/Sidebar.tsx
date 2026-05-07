import React, { useState } from 'react';
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
  const [seenLog, setSeenLog] = useState<string[]>(JSON.parse(localStorage.getItem('melann_seen_log') || '[]'));

  const { topPriorityList, reminderList, closeMonitoringList, filteredMainList } = useClientUpdates(selectedBranch);

  // Compute Badge Counts
  const advanceIds = reminderList.map((r: any) => r.loan.id);
  const criticalIds = topPriorityList.map((l: any) => l.id);
  const monitoringIds = closeMonitoringList.map((l: any) => l.id);
  const logIds = filteredMainList.map((l: any) => l.id);

  const newAdvance = advanceIds.filter(id => !seenAdvance.includes(id)).length;
  const newCritical = criticalIds.filter(id => !seenCritical.includes(id)).length;
  const newMonitoring = monitoringIds.filter(id => !seenMonitoring.includes(id)).length;
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
        { id: 'client-update-log', label: 'All Clients Update Log' }
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
    { id: 'collectors', label: 'Collectors', icon: () => <span className="text-xl">👥</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'users', label: 'Manage Users', icon: () => <span className="text-xl">⚙️</span>, roles: [UserRole.SUPER_ADMIN] },
    { id: 'database', label: 'Backup & Restore', icon: () => <span className="text-xl">🗄️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
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
    `}</style>
    <aside className={`fixed inset-y-0 left-0 text-white transition-all duration-300 z-50 flex flex-col ${isOpen ? 'w-64' : 'w-16'}`} style={{ background: 'linear-gradient(180deg, #0B3D2E 0%, #072A20 100%)' }}>
      <div className="px-4 flex items-center gap-3" style={{ paddingTop: '18px', paddingBottom: '12px' }}>
        <div
          className="shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-lg shadow-black/20 overflow-hidden transition-colors duration-300 cursor-pointer"
          style={{ width: '60px', height: '60px' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img src={logo} alt="Melann Lending" className="w-full h-full object-contain" />
        </div>
        {isOpen && (
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-[15px] tracking-[0.3px] text-[#f1f5f9] leading-tight" style={{ whiteSpace: 'normal' }}>MELANN LENDING</h1>
            <p className="text-[11px] font-bold text-[#a7f3d0] uppercase tracking-[0.3px] leading-[1.25] mt-0.5" style={{ whiteSpace: 'normal', opacity: 0.85 }}>Past Due & Report<br />Monitoring System</p>
          </div>
        )}
      </div>
      {/* GLOWING HORIZONTAL DIVIDER */}
      <div className="px-3" style={{ marginTop: '8px', marginBottom: '10px' }}>
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

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto custom-scrollbar pb-2" style={{ marginTop: '4px' }}>
        {menuItems.filter(item => item.roles.includes(role)).map((item) => {
          const isActive = isItemActive(item);
          const isExpanded = expandedMenus[item.id];
          
          return (
            <div key={item.id} className="flex flex-col">
              <button
                onClick={() => handleMenuClick(item)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all duration-300 relative group ${
                  isActive
                    ? 'bg-[#0f6b4a] text-white shadow-md shadow-black/20'
                    : 'text-[#d1fae5] hover:bg-[#0d4f37] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={`shrink-0 flex items-center justify-center text-[17px] transition-transform duration-300 ${!isOpen && 'mx-auto'}`}>
                    <item.icon />
                  </div>
                  {isOpen && (
                    <span className="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-left flex-1 flex justify-between items-center pr-1">
                      <span className="truncate">{item.label}</span>
                      {item.id === 'client-update' && (newAdvance + newCritical + newMonitoring + newLog) > 0 && (
                        <span className="shrink-0 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ml-2">
                          {(newAdvance + newCritical + newMonitoring + newLog) > 99 ? '99+' : (newAdvance + newCritical + newMonitoring + newLog)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isOpen && item.subItems && (
                  <span className={`shrink-0 text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
                
                {/* Tooltip for collapsed mode */}
                {!isOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap shadow-xl">
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
                  <div className="flex flex-col gap-0.5 ml-5 pl-3 border-l border-[#0d4f37] py-0.5 mb-1">
                    {item.subItems.map((subItem) => {
                      let badgeCount = 0;
                      if (subItem.id === 'client-update-advance') badgeCount = newAdvance;
                      else if (subItem.id === 'client-update-critical') badgeCount = newCritical;
                      else if (subItem.id === 'client-update-monitoring') badgeCount = newMonitoring;
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
                             className={`w-full flex items-center justify-between text-left py-1 px-2.5 rounded-md text-[12px] font-bold transition-all duration-200 ${
                               activeTab === subItem.id
                                 ? 'bg-[#0f6b4a] text-white shadow-sm'
                                 : 'text-[#a7f3d0] hover:text-white hover:bg-[#0d4f37]'
                             }`}
                           >
                             <span className="truncate pr-2">{subItem.label}</span>
                             {badgeCount > 0 && (
                               <span className="shrink-0 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
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

      <div className="px-2 py-2 border-t border-[#0d4f37] transition-colors duration-300">
        {isOpen && (
          <div className="mb-1 px-2">
            <p className="text-[10px] text-[#6ee7b7] uppercase font-bold tracking-widest">Authenticated</p>
            <p className="text-[13px] font-bold text-slate-100 truncate">{username}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          title={!isOpen ? "Logout" : undefined}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#d1fae5] hover:bg-red-900/40 hover:text-red-300 transition-all group"
        >
          <div className={`shrink-0 flex items-center justify-center text-[17px] ${!isOpen && 'mx-auto'}`}>
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

