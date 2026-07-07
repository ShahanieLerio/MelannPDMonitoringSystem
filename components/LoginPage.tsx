
import React, { useState } from 'react';
import { ACCOUNT_ROLE_OPTIONS, User, UserRole, Branch } from '../types.ts';
import { store } from '../services/dataStore.ts';
import loginVisual from '../assets/no bg.png';
import ConfirmationModal from './ConfirmationModal.tsx';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.COLLECTOR);
  const [branch, setBranch] = useState<Branch>(Branch.NAVAL);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegistrationConfirm, setShowRegistrationConfirm] = useState(false);

  const submitRegistration = () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    setShowRegistrationConfirm(false);

    setTimeout(async () => {
      try {
        await store.registerUser({
          username,
          fullName,
          password,
          role,
          branch: role === UserRole.SUPER_ADMIN ? Branch.ALL : branch
        });
        setSuccess('Registration request sent! Please wait for Administration approval.');
        setIsRegistering(false);
        setUsername('');
        setPassword('');
        setFullName('');
        setRole(UserRole.COLLECTOR);
        setBranch(Branch.NAVAL);
      } catch (err) {
        console.error('Registration failed:', err);
        setError(err instanceof Error ? err.message : 'Registration was not saved. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 800);
  };

  const submitLogin = () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    setTimeout(() => {
        const result = store.authenticate(username, password);
        if (result.user) {
          onLogin(result.user);
        } else {
          setError(result.error || 'Invalid credentials or account pending approval.');
          setIsLoading(false);
        }
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      setError('');
      setSuccess('');
      setShowRegistrationConfirm(true);
      return;
    }

    submitLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#064e3b] p-4 relative overflow-hidden">
      <div className="absolute inset-0 melann-shell-grid opacity-35"></div>
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-emerald-300/20 to-transparent"></div>
      <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-teal-200/10 blur-3xl"></div>
      <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-emerald-200/15 blur-3xl"></div>
      <ConfirmationModal
        isOpen={showRegistrationConfirm}
        title="Confirm Registration"
        message="Are you sure the provided information is correct and you want to submit?"
        onConfirm={submitRegistration}
        onCancel={() => setShowRegistrationConfirm(false)}
        type="warning"
        confirmLabel="Yes, Submit Registration"
        cancelLabel="Review Information"
      />
      <div className="inline-flex flex-col md:flex-row bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-emerald-950/30 overflow-hidden border border-white/70 max-w-7xl w-auto transition-all duration-500 relative">
        {/* Left Section: Visual Container */}
        <div className="hidden md:block flex-none order-1 bg-emerald-950 relative">
          <img
            src={loginVisual}
            alt="Melann Lending Brand Identity"
            className="block h-full w-auto object-contain max-h-[700px] relative z-10"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none"></div>
        </div>

        {/* Right Section: Authentication Container */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-14 bg-white/95 border-l border-slate-100 order-2 min-w-[320px] md:min-w-[480px] lg:min-w-[550px]">
          <div className={`max-w-md w-full mx-auto ${isRegistering ? 'space-y-4' : 'space-y-8'}`}>

            <div className="text-center md:text-left">
              <div className={`${isRegistering ? 'mb-3' : 'mb-6'} flex justify-center md:justify-start`}>
                <div className="text-5xl drop-shadow-sm">📊</div>
              </div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight">
                Melann Lending <br />
                <span className="text-emerald-600 block mt-1">{isRegistering ? 'Account Registration' : 'Past Due and Report Monitoring'}</span>
              </h1>
              <div className="mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-emerald-600 to-teal-300 mx-auto md:mx-0"></div>
            </div>

            <form onSubmit={handleSubmit} className={isRegistering ? 'space-y-3' : 'space-y-5'}>
              <div className={isRegistering ? 'space-y-2' : 'space-y-4'}>
                {isRegistering && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Juan Dela Cruz"
                      className={`w-full px-4 ${isRegistering ? 'py-2.5' : 'py-3.5'} bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800 text-sm shadow-sm`}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">User Identification</label>
                  <input
                    type="text"
                    required
                    placeholder="Username"
                    className={`w-full px-4 ${isRegistering ? 'py-2.5' : 'py-3.5'} bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800 text-sm shadow-sm`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Security Key</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      className={`w-full px-4 ${isRegistering ? 'py-2.5' : 'py-3.5'} bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800 text-sm pr-12 shadow-sm`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {isRegistering && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Account Role</label>
                    <select
                      className={`w-full px-4 ${isRegistering ? 'py-2.5' : 'py-3.5'} bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800 text-sm appearance-none shadow-sm`}
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      {ACCOUNT_ROLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {isRegistering && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assigned Branch</label>
                    <select
                      className={`w-full px-4 ${isRegistering ? 'py-2.5' : 'py-3.5'} bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800 text-sm appearance-none shadow-sm`}
                      value={branch}
                      onChange={(e) => setBranch(e.target.value as Branch)}
                    >
                      <option value={Branch.NAVAL}>Naval Branch</option>
                      <option value={Branch.ORMOC}>Ormoc Branch</option>
                    </select>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-wider">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-slate-950 to-emerald-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:from-black hover:to-emerald-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/20"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  isRegistering ? 'Submit Registration' : 'Authorize Access'
                )}
              </button>
            </form>

            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 ${isRegistering ? 'pt-2' : 'pt-4'} border-t border-slate-100`}>
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccess(''); }}
                className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hover:text-emerald-900 hover:underline"
              >
                {isRegistering ? 'Back to Login' : 'Request Registration'}
              </button>
              {!isRegistering && (
                <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                  Recover Account
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
