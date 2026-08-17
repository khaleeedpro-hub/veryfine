import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  DollarSign,
  Send,
  Coins,
  AlertTriangle,
} from 'lucide-react';

interface AdminSettingsTabProps {
  token: string | null;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ token }) => {
  const [settings, setSettings] = useState({
    minDepositUsd: 10,
    minWithdrawalUsd: 15,
    withdrawalFeePercent: 2.5,
    transferDailyLimitUsd: 50,
    transferFeePercent: 0.5,
    maintenanceMode: false,
    dailyYieldHourUtc: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchSettings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings({
            minDepositUsd: data.settings.minDepositUsd ?? 10,
            minWithdrawalUsd: data.settings.minWithdrawalUsd ?? 15,
            withdrawalFeePercent: data.settings.withdrawalFeePercent ?? 2.5,
            transferDailyLimitUsd: data.settings.transferDailyLimitUsd ?? 50,
            transferFeePercent: data.settings.transferFeePercent ?? 0.5,
            maintenanceMode: Boolean(data.settings.maintenanceMode),
            dailyYieldHourUtc: data.settings.dailyYieldHourUtc ?? 0,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', msg: 'System settings updated successfully.' });
      } else {
        setFeedback({ type: 'error', msg: data.error || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Platform Financial & Security Parameters</h2>
            <p className="text-xs text-slate-400">
              Configure global deposit thresholds, withdrawal fees, P2P transfer constraints, and maintenance toggles.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-4 rounded-xl text-xs flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Loading system configurations...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Deposit Settings */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Deposits & Inbound Gateway</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Minimum Deposit Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={settings.minDepositUsd}
                      onChange={(e) => setSettings({ ...settings, minDepositUsd: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Withdrawal Settings */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <DollarSign className="w-4 h-4 text-rose-400" />
                  <span>Withdrawals & Payout Controls</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Minimum Withdrawal Threshold (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      step="1"
                      min="5"
                      value={settings.minWithdrawalUsd}
                      onChange={(e) => setSettings({ ...settings, minWithdrawalUsd: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Withdrawal Fee Percentage (%)</label>
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">%</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={settings.withdrawalFeePercent}
                      onChange={(e) => setSettings({ ...settings, withdrawalFeePercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* P2P Internal Transfers */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span>Internal Transfers (P2P)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Daily Transfer Limit per User (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      step="5"
                      min="10"
                      value={settings.transferDailyLimitUsd}
                      onChange={(e) => setSettings({ ...settings, transferDailyLimitUsd: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Internal Transfer Fee (%)</label>
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 text-slate-500 text-xs font-mono">%</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={settings.transferFeePercent}
                      onChange={(e) => setSettings({ ...settings, transferFeePercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Yield Engine Scheduling & Maintenance */}
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Engine Scheduling & Safety</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Daily Yield Payout Hour (UTC: 0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={settings.dailyYieldHourUtc}
                    onChange={(e) => setSettings({ ...settings, dailyYieldHourUtc: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">System Maintenance Mode</div>
                    <div className="text-[11px] text-slate-400">Lock non-admin transactions & actions</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
