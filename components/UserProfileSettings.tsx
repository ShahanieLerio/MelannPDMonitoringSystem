import React, { useMemo, useState } from 'react';
import { store } from '../services/dataStore.ts';
import { Branch, User, UserRole, UserStatus, canAccessPayments, canManageUsers, getUserRoleLabel, isAllBranchRole } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';

interface UserProfileSettingsProps {
  currentUser: User;
  selectedBranch: Branch;
  onUserUpdate: (user: User) => void;
  onNavigate: (tab: string) => void;
}

const formatDateTime = (value?: string) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusClass = (status: UserStatus) => {
  if (status === UserStatus.ACTIVE) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === UserStatus.PENDING) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

const DetailTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-800 break-words">{value}</p>
  </div>
);

const getAccessSummary = (user: User) => {
  const isAllBranch = isAllBranchRole(user.role);
  const canManage = canManageUsers(user.role);
  const loanMaintenanceRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.IT_ACCOUNTING_CLERK,
    UserRole.BRANCH_MANAGER,
    UserRole.OPERATIONS_MANAGER,
    UserRole.EXECUTIVE_VICE_PRESIDENT,
    UserRole.PRESIDENT,
    UserRole.NAVAL_USER,
    UserRole.ORMOC_USER
  ];
  const adminToolRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.PRESIDENT,
    UserRole.NAVAL_USER,
    UserRole.ORMOC_USER
  ];
  const dataMaintenanceRoles = [
    ...adminToolRoles,
    UserRole.IT_ACCOUNTING_CLERK
  ];
  const writeOffRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.EXECUTIVE_VICE_PRESIDENT,
    UserRole.PRESIDENT,
    UserRole.NAVAL_USER,
    UserRole.ORMOC_USER
  ];

  return [
    { module: 'Dashboard', access: true, capability: 'View portfolio KPIs, balances, collection trend, and account distribution.' },
    { module: 'Loan Grid', access: true, capability: loanMaintenanceRoles.includes(user.role) ? 'View, add/import, edit, and manage client records.' : 'View assigned/client records and open client profiles.' },
    { module: 'Client Update', access: true, capability: 'View update logs, commitments, reminders, priority cases, and monitoring queues.' },
    { module: 'PTP Escalation', access: true, capability: 'Review clients with repeated missed promises or follow-up issues.' },
    { module: 'Action Tracker', access: true, capability: 'Track collection actions, follow-up status, and write-off prospects.' },
    { module: 'Demand Letters', access: true, capability: 'View legal follow-up pipeline and demand letter status.' },
    { module: 'Payments', access: canAccessPayments(user.role), capability: 'Post and reverse payments for Super Admin, IT/Accounting Clerk, and Branch Manager only.' },
    { module: 'DCR / Collection Sheet', access: true, capability: 'Review daily collection summaries and collection sheet records.' },
    { module: 'Reports', access: true, capability: 'View performance, aging, reconstructed, and deceased-client reports.' },
    { module: 'Collectors', access: dataMaintenanceRoles.includes(user.role), capability: 'Manage collector directory and collector assignment metadata.' },
    { module: 'Write-Off', access: writeOffRoles.includes(user.role), capability: 'Review or approve write-off related workflows where authorized.' },
    { module: 'User Management', access: canManage, capability: 'Approve, deactivate, and reactivate user accounts.' },
    { module: 'JCash Migration / Recycle Bin', access: dataMaintenanceRoles.includes(user.role), capability: 'Run protected migration and recycle-bin data maintenance utilities.' },
    { module: 'Backup & Restore', access: adminToolRoles.includes(user.role), capability: 'Run protected backup and restore utilities.' },
    { module: 'Branch Scope', access: true, capability: isAllBranch ? 'Can switch between all branch views.' : `Scoped to ${user.branch}.` },
  ];
};

const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({ currentUser, selectedBranch, onUserUpdate, onNavigate }) => {
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const initials = useMemo(() => {
    const source = (currentUser.fullName || currentUser.username).trim();
    const parts = source.split(/\s+/).filter(Boolean);
    return (parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
  }, [currentUser.fullName, currentUser.username]);

  const latestStatusHistory = [...(currentUser.statusHistory || [])].reverse().slice(0, 4);
  const hasChanges = fullName.trim() !== (currentUser.fullName || '').trim();
  const accessSummary = useMemo(() => getAccessSummary(currentUser), [currentUser]);
  const hasPassword = Boolean(currentUser.passwordHash);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!fullName.trim()) {
      setFeedback({ type: 'error', message: 'Full name is required.' });
      return;
    }

    try {
      setIsSaving(true);
      const updatedUser = await store.updateUserProfile(currentUser.id, { fullName: fullName.trim() });
      onUserUpdate(updatedUser);
      setFeedback({ type: 'success', message: 'Profile settings saved.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save profile settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSecurityFeedback(null);

    if (hasPassword && !currentPassword) {
      setSecurityFeedback({ type: 'error', message: 'Current password is required.' });
      return;
    }

    if (newPassword.length < 6) {
      setSecurityFeedback({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityFeedback({ type: 'error', message: 'Password confirmation does not match.' });
      return;
    }

    try {
      setIsPasswordSaving(true);
      const updatedUser = await store.updateUserPassword(currentUser.id, currentPassword, newPassword);
      onUserUpdate(updatedUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityFeedback({ type: 'success', message: hasPassword ? 'Password changed successfully.' : 'Password has been set for this account.' });
    } catch (error) {
      setSecurityFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update password.' });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center text-2xl font-black tracking-widest">
              {initials}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">User Profile Settings</p>
              <h3 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{currentUser.fullName || currentUser.username}</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">@{currentUser.username}</p>
            </div>
          </div>
          <span className={`w-fit rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${getStatusClass(currentUser.status)}`}>
            {currentUser.status}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-0">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 border-b xl:border-b-0 xl:border-r border-slate-100 space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
              <input
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="Enter full name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailTile label="Username" value={currentUser.username} />
              <DetailTile label="Role" value={getUserRoleLabel(currentUser.role)} />
              <DetailTile label="Assigned Branch" value={currentUser.branch} />
              <DetailTile label="Current View" value={selectedBranch} />
            </div>

            {feedback && (
              <div className={`rounded-2xl border px-4 py-3 text-xs font-black ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {feedback.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSaving || !hasChanges}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={() => setFullName(currentUser.fullName || '')}
                disabled={!hasChanges || isSaving}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Appearance</p>
                <p className="mt-1 text-sm font-bold text-slate-700">Switch light or dark mode</p>
              </div>
              <ThemeToggle />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Dashboard</p>
                <p className="mt-1 text-sm font-black text-slate-800">Back to overview</p>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('documentation')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Help</p>
                <p className="mt-1 text-sm font-black text-slate-800">Open documentation</p>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Timeline</p>
              <div className="mt-4 space-y-4">
                {latestStatusHistory.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400">No status history recorded.</p>
                ) : latestStatusHistory.map((entry, index) => (
                  <div key={`${entry.updatedAt}-${index}`} className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 rounded-full ${
                      entry.status === UserStatus.ACTIVE ? 'bg-emerald-500' : entry.status === UserStatus.PENDING ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">{entry.status}</p>
                      <p className="text-[11px] font-semibold text-slate-400">By {entry.updatedBy} on {formatDateTime(entry.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">Account Security</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Change Password</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {hasPassword ? 'Update your login password.' : 'No password is stored yet for this legacy account. Set one now.'}
            </p>
          </div>

          {hasPassword && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="Enter current password"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                placeholder="Retype new password"
              />
            </div>
          </div>

          {securityFeedback && (
            <div className={`rounded-2xl border px-4 py-3 text-xs font-black ${
              securityFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              {securityFeedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPasswordSaving}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {isPasswordSaving ? 'Updating...' : hasPassword ? 'Change Password' : 'Set Password'}
          </button>
        </form>

        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">Access & Permission</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">{getUserRoleLabel(currentUser.role)} Capability Summary</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">Modules visible to this account and the main actions allowed by role.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {accessSummary.map(item => (
              <div key={item.module} className="p-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{item.module}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 leading-5">{item.capability}</p>
                </div>
                <span className={`w-fit rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                  item.access
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {item.access ? 'Allowed' : 'Restricted'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
};

export default UserProfileSettings;
