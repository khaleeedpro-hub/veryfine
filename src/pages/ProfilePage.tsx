import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User as UserIcon,
  Mail,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Clock,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface ProfilePageProps {
  onNavigate?: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, wallet, token, refreshUserContext } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [passMessage, setPassMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const handleCopyWallet = () => {
    if (wallet?.wallet_address) {
      navigator.clipboard.writeText(wallet.wallet_address);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMessage({ text: 'PIN must be exactly 4 numeric digits.', error: true });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ text: 'New PIN and Confirmation PIN do not match.', error: true });
      return;
    }

    setIsSubmittingPin(true);
    try {
      const res = await fetch('/api/auth/update-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN update failed.');
      }

      setPinMessage({
        text: 'Security 4-digit PIN updated successfully! (24-hour withdrawal cooldown applied).',
      });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      await refreshUserContext();
    } catch (err: any) {
      setPinMessage({ text: err.message || 'PIN update failed.', error: true });
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (newPassword.length < 6) {
      setPassMessage({ text: 'New password must be at least 6 characters.', error: true });
      return;
    }

    setIsSubmittingPass(true);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password update failed.');
      }

      setPassMessage({ text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPassMessage({ text: err.message || 'Password update failed.', error: true });
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const isCooldownActive = Boolean(
    user?.pinCooldownUntil && new Date(user.pinCooldownUntil).getTime() > Date.now()
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Profile Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-bold text-2xl text-emerald-400">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{user?.fullName || 'Investor'}</h1>
              {user?.role === 'admin' && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                  ADMINISTRATOR
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {user?.email}
              </span>
              <span className="flex items-center gap-1 font-mono text-slate-300">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                ID: {user?.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Overview & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider">USD Financial Wallet</div>
            <div className="text-2xl font-black text-white mt-0.5 flex items-center gap-2">
              <span>${Number(wallet?.available_balance || 0).toFixed(2)}</span>
              <span className="text-xs text-slate-400 font-normal">Available</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWallet}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-colors"
            >
              {copiedWallet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="font-mono text-[11px]">{wallet?.wallet_address || 'WALLET-ADDRESS'}</span>
            </button>
          </div>
        </div>

        {onNavigate && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-center text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => onNavigate('deposit')}
              className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-center text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>Deposit</span>
            </button>
            <button
              onClick={() => onNavigate('withdraw')}
              className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-center text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
              <span>Withdraw</span>
            </button>
            <button
              onClick={() => onNavigate('transfer')}
              className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-center text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-purple-400" />
              <span>Transfer</span>
            </button>
          </div>
        )}
      </div>

      {isCooldownActive && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-200">24-Hour Withdrawal Security Cooldown Active</div>
            <p className="text-amber-300/80 leading-relaxed">
              Your 4-digit PIN was recently updated or set. Outgoing withdrawals are locked until:{' '}
              <span className="font-mono font-bold text-amber-200">{new Date(user!.pinCooldownUntil!).toLocaleString()}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Security Credentials Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 4-Digit Security PIN Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>4-Digit Security Withdrawal PIN</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your 4-digit numeric PIN authorizes all outgoing USD transfers and withdrawals.
          </p>

          {pinMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                pinMessage.error
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              {pinMessage.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{pinMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePin} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Current PIN (Optional if setting first time)</label>
              <input
                type="password"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-emerald-500"
                placeholder="••••"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">New 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-emerald-500"
                  placeholder="••••"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Confirm New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-emerald-500"
                  placeholder="••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingPin}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-xs"
            >
              {isSubmittingPin ? 'Updating PIN...' : 'Save Security PIN'}
            </button>
          </form>
        </div>

        {/* Password Management Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <Lock className="w-5 h-5 text-teal-400" />
            <span>Change Account Password</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Update your account password to secure your login credentials.
          </p>

          {passMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passMessage.error
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              {passMessage.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{passMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingPass}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all text-xs"
            >
              {isSubmittingPass ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
