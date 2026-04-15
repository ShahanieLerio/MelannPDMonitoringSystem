
import React, { useState } from 'react';
import { store } from '../services/dataStore';
import { User, UserStatus } from '../types';
import ConfirmationModal from './ConfirmationModal.tsx';

interface UserManagementProps {
  currentUser: User;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'warning') => {
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

  const handleStatusChange = (id: string, name: string, newStatus: UserStatus) => {
    let title = "";
    let message = "";
    let type: 'danger' | 'warning' | 'info' = 'warning';

    if (newStatus === UserStatus.ACTIVE) {
      title = "Activate Account?";
      message = `Are you sure you want to activate/approve access for ${name}?`;
      type = 'info';
    } else if (newStatus === UserStatus.DEACTIVATED) {
      title = "Deactivate Account?";
      message = `Are you sure you want to deactivate ${name}'s account? This will prevent them from logging in, but their records will be preserved.`;
      type = 'danger';
    }

    askConfirm(
      title,
      message,
      () => {
        store.updateUserStatus(id, newStatus, currentUser.username);
        setUsers([...store.getUsers()]);
      },
      type
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">System User Registrations</h3>
          <p className="text-sm text-slate-500 mt-1">Review and manage branch-level access requests and current users. <b>Accounts are permanent and cannot be deleted.</b></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-slate-400 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">System Identity</th>
                <th className="px-8 py-5">Full Name</th>
                <th className="px-8 py-5">Role & Branch</th>
                <th className="px-8 py-5">Current Status</th>
                <th className="px-8 py-5 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="group hover:bg-emerald-50 transition-all duration-300">
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-700 transition-all duration-300 group-hover:text-emerald-700 group-hover:font-black group-hover:underline decoration-emerald-500/30 underline-offset-4">{user.username}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {user.id}</div>
                    <div className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">Created: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-700">{user.fullName || 'N/A'}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                        {user.role.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                        📍 {user.branch}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.status === UserStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' :
                      user.status === UserStatus.PENDING ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                      {user.status === UserStatus.DEACTIVATED ? 'DEACTIVATED' : user.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === UserStatus.PENDING && (
                        <>
                          <button
                            onClick={() => handleStatusChange(user.id, user.username, UserStatus.ACTIVE)}
                            className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatusChange(user.id, user.username, UserStatus.DEACTIVATED)}
                            className="px-5 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-50 transition-all active:scale-95"
                          >
                            Reject & Deactivate
                          </button>
                        </>
                      )}
                      {user.status === UserStatus.ACTIVE && user.id !== '1' && (
                        <button
                          onClick={() => handleStatusChange(user.id, user.username, UserStatus.DEACTIVATED)}
                          className="px-4 py-2 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        >
                          Deactivate Account
                        </button>
                      )}
                      {user.status === UserStatus.DEACTIVATED && user.id !== '1' && (
                        <button
                          onClick={() => handleStatusChange(user.id, user.username, UserStatus.ACTIVE)}
                          className="px-4 py-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                        >
                          Reactivate Account
                        </button>
                      )}
                      {user.id === '1' && (
                        <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Permanent System Admin</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mini Audit View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {users.filter(u => u.statusHistory && u.statusHistory.length > 1).slice(0, 4).map(u => (
          <div key={u.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs">👤</div>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase">{u.fullName}</p>
                <p className="text-[9px] text-slate-400 font-bold">LATEST STATUS LOGS</p>
              </div>
            </div>
            <div className="space-y-3">
              {u.statusHistory.slice(-3).reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-[10px]">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full ${h.status === UserStatus.ACTIVE ? 'bg-emerald-500' : h.status === UserStatus.DEACTIVATED ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                  <div>
                    <p className="font-black text-slate-700 uppercase">{h.status}</p>
                    <p className="text-slate-400 font-medium">By {h.updatedBy} on {new Date(h.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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

export default UserManagement;
