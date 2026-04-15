
import React from 'react';
import { UserRole } from '../types.ts';
import logo from '../assets/logo.jpg';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  onLogout: () => void;
  username: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, activeTab, setActiveTab, role, onLogout, username }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: () => <span className="text-xl">📊</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'loans', label: 'Loan Grid', icon: () => <span className="text-xl">📋</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'client-update', label: 'Client Update', icon: () => <span className="text-xl">✍️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'receive-payment', label: 'Payments', icon: () => <span className="text-xl">💰</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'collection-sheet', label: 'Collection Sheet', icon: () => <span className="text-xl">📄</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'dcr', label: 'DCR', icon: () => <span className="text-xl">📅</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'reports', label: 'Reports', icon: () => <span className="text-xl">📉</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'demand-letters', label: 'Demand Letters', icon: () => <span className="text-xl">✉️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'collectors', label: 'Collectors', icon: () => <span className="text-xl">👥</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
    { id: 'users', label: 'Manage Users', icon: () => <span className="text-xl">⚙️</span>, roles: [UserRole.SUPER_ADMIN] },
    { id: 'database', label: 'Backup & Restore', icon: () => <span className="text-xl">🗄️</span>, roles: [UserRole.SUPER_ADMIN, UserRole.NAVAL_USER, UserRole.ORMOC_USER] },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 bg-[#064e3b] dark:bg-[#022c22] text-white transition-all duration-300 z-50 flex flex-col ${isOpen ? 'w-72' : 'w-20'}`}>
      <div className="p-6 flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg shadow-black/20 overflow-hidden transition-colors duration-300">
          <img src={logo} alt="Melann Lending" className="w-full h-full object-contain" />
        </div>
        {isOpen && (
          <div className="flex flex-col leading-tight overflow-hidden text-nowrap">
            <h1 className="font-black text-lg tracking-tight text-[#f1f5f9]">MELANN LENDING</h1>
            <p className="text-[10px] font-bold text-[#a7f3d0] uppercase tracking-[0.15em]">Past Due & Report Monitoring</p>
          </div>
        )}
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-2">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${activeTab === item.id
              ? 'bg-[#059669] dark:bg-emerald-600 text-white shadow-lg shadow-[#064e3b]/40 dark:shadow-emerald-900/40'
              : 'text-[#d1fae5] dark:text-emerald-100 hover:bg-[#065f46] dark:hover:bg-[#042f2e] hover:text-white hover:pl-5'
              }`}
          >
            <item.icon />
            {isOpen && <span className="font-semibold text-sm whitespace-nowrap overflow-hidden">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#065f46] dark:border-[#042f2e] transition-colors duration-300">
        {isOpen && (
          <div className="mb-4 px-2">
            <p className="text-xs text-[#6ee7b7] uppercase font-bold tracking-widest mb-1">Authenticated</p>
            <p className="text-sm font-bold text-slate-100 truncate">{username}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-4 p-3 rounded-xl text-[#d1fae5] hover:bg-red-900/40 hover:text-red-300 transition-all`}
        >
          <span className="text-xl">🚪</span>
          {isOpen && <span className="font-bold text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
