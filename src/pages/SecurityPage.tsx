import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ShieldAlert, KeyRound, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  const { user, token, refreshUserContext } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [passMessage, setPassMessage] = useState<{ text: string; error?: boolean } | null>(null);

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
        text: 'Security 4-digit PIN updated successfully! (Note: 24-hour withdrawal cooldown applied for protection).',
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
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-emerald-400" />
            <span>Security, PIN & Cooldown Controls</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your 4-digit withdrawal authorization PIN and login password.
          </p>
        </div>
      </div>

      {isCooldownActive && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-200">24-Hour Withdrawal Security Cooldown Active</div>
            <p className="text-amber-300/80 leading-relaxed">
              Your 4-digit PIN was recently updated or reset. To protect your assets against unauthorized takeover, withdrawals are locked until:{' '}
              <span className="font-mono font-bold text-amber-200">{new Date(user!.pinCooldownUntil!).toLocaleString()}</span>.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* 4-Digit Withdrawal PIN Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>4-Digit Withdrawal PIN</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your 4-digit PIN is required to authorize all outgoing USD withdrawals. Changing or setting your PIN applies a 24-hour withdrawal cooldown.
          </p>

          {pinMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                pinMessage.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              {pinMessage.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{pinMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePin} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Current PIN (Leave blank if setting for first time)</label>
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
              {isSubmittingPin ? 'Updating PIN...' : 'Save 4-Digit Security PIN'}
            </button>
          </form>
        </div>

        {/* Change Password Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <Lock className="w-5 h-5 text-teal-400" />
            <span>Account Password</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Update your primary login password. Ensure your password contains at least 6 characters.
          </p>

          {passMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passMessage.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
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
              {isSubmittingPass ? 'Updating Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
