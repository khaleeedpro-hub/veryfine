import React, { useState } from 'react';
import { TrendingUp, Plus, Edit3, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminVipPlansTabProps {
  plans: any[];
  isLoading: boolean;
  onRefresh: () => void;
  token: string | null;
  onSuccess: () => void;
}

export const AdminVipPlansTab: React.FC<AdminVipPlansTabProps> = ({
  plans,
  isLoading,
  onRefresh,
  token,
  onSuccess,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: 'VIP 1 Starter',
    investmentAmount: '50',
    dailyEarning: '2.50',
    durationDays: '120',
    isActive: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      name: `VIP ${plans.length + 1}`,
      investmentAmount: '50',
      dailyEarning: '2.50',
      durationDays: '120',
      isActive: true,
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingPlan(p);
    setForm({
      name: p.name,
      investmentAmount: String(p.investment_amount ?? p.investmentAmount ?? 0),
      dailyEarning: String(p.daily_earning ?? p.dailyEarning ?? 0),
      durationDays: String(p.duration_days ?? p.durationDays ?? 120),
      isActive: p.is_active ?? p.isActive ?? true,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');

    try {
      const payload = {
        name: form.name,
        investmentAmount: Number(form.investmentAmount),
        dailyEarning: Number(form.dailyEarning),
        durationDays: Number(form.durationDays),
        isActive: form.isActive,
      };

      const endpoint = editingPlan
        ? `/api/admin/plans/${editingPlan.id}`
        : '/api/admin/plans';

      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save VIP plan');

      setShowModal(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-white text-sm">VIP Investment Packages & Yield Ratios</h2>
          <p className="text-xs text-slate-400">Configure daily return percentages, pricing tiers, and duration days</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create VIP Plan</span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => {
          const invAmt = Number(p.investment_amount ?? p.investmentAmount ?? 0);
          const dailyEarn = Number(p.daily_earning ?? p.dailyEarning ?? 0);
          const dur = Number(p.duration_days ?? p.durationDays ?? 120);
          const totalReturn = dailyEarn * dur;
          const roiPercent = invAmt > 0 ? ((totalReturn - invAmt) / invAmt) * 100 : 0;

          return (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 relative group">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-extrabold text-emerald-400 text-base">{p.name}</span>
                  <div className="text-[10px] text-slate-500 font-mono">Plan ID: {p.id}</div>
                </div>
                <StatusBadge status={p.is_active ?? p.isActive ? 'active' : 'inactive'} />
              </div>

              <div>
                <div className="text-2xl font-black text-white">${invAmt.toFixed(2)} USD</div>
                <div className="text-xs text-slate-400">Required Deposit Capital</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl space-y-1.5 text-xs text-slate-300 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily Return:</span>
                  <span className="font-bold text-emerald-400">+${dailyEarn.toFixed(2)}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-white font-medium">{dur} Days</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">Total Payout:</span>
                  <span className="font-bold text-amber-400">${totalReturn.toFixed(2)} ({roiPercent.toFixed(0)}% ROI)</span>
                </div>
              </div>

              <button
                onClick={() => openEditModal(p)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Configure Plan Parameters</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-slate-100 space-y-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl font-bold p-1 cursor-pointer"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{editingPlan ? 'Edit VIP Plan' : 'Create New VIP Tier'}</h3>
                <p className="text-xs text-slate-400">Set investment threshold & daily payout rate</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Plan Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VIP 1 Starter"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Investment (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={form.investmentAmount}
                    onChange={(e) => setForm({ ...form, investmentAmount: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Daily Yield (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.dailyEarning}
                    onChange={(e) => setForm({ ...form, dailyEarning: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono text-emerald-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.durationDays}
                    onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Status</label>
                  <select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                  >
                    <option value="active">Active & Visible</option>
                    <option value="inactive">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-2/3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {isProcessing ? 'Saving...' : editingPlan ? 'Save Plan Updates' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
