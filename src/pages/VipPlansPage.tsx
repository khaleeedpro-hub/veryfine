import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { VipPlan } from '../types';
import { TrendingUp, ShieldCheck, Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { RiskDisclaimerBanner } from '../components/common/RiskDisclaimerBanner';

export const VipPlansPage: React.FC = () => {
  const { wallet, token, refreshUserContext } = useAuth();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<VipPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/vip/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch VIP plans:', err);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !token) return;

    if (Number(wallet?.available_balance || 0) < selectedPlan.investment_amount) {
      setError(`Insufficient available balance ($${Number(wallet?.available_balance || 0).toFixed(2)} available vs $${selectedPlan.investment_amount} required). Please deposit funds first.`);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/vip/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete investment.');
      }

      setSuccess(`Success! Activated ${selectedPlan.name}. Daily return: +$${selectedPlan.daily_earning.toFixed(2)}/day.`);
      setSelectedPlan(null);
      await refreshUserContext();
    } catch (err: any) {
      setError(err.message || 'Investment purchase failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <span>Configurable VIP Investment Plans</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Choose a 120-day plan. Daily returns are credited automatically every 24 hours to your available balance.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 px-4 py-2.5 rounded-xl text-xs flex items-center gap-3 shrink-0">
          <div>
            <div className="text-slate-400 font-semibold text-[10px] uppercase">Available Wallet</div>
            <div className="font-bold text-emerald-400 text-sm">${Number(wallet?.available_balance || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <RiskDisclaimerBanner />

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid of VIP Plans */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isDisabled = !plan.is_active;
          const totalReward = plan.daily_earning * plan.duration_days;
          const netProfitPct = Math.round((totalReward / plan.investment_amount) * 100);

          return (
            <div
              key={plan.id}
              className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between gap-6 relative transition-all ${
                isDisabled
                  ? 'border-slate-800/60 opacity-60'
                  : 'border-slate-800 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5'
              }`}
            >
              {/* Top Row Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">{plan.name}</span>
                  {isDisabled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Coming Soon
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {plan.duration_days} Days
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black text-white">${plan.investment_amount.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Required Capital Deposit</div>
                </div>
              </div>

              {/* Plan Benefits */}
              <div className="space-y-2 py-4 border-y border-slate-800/80 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Daily Return:</span>
                  <span className="font-bold text-emerald-400">+${plan.daily_earning.toFixed(2)} / day</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Plan Period:</span>
                  <span className="font-semibold text-slate-200">{plan.duration_days} Days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Reward Output:</span>
                  <span className="font-bold text-white">${totalReward.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Principal Return:</span>
                  <span className="font-semibold text-teal-300">Included at Maturity</span>
                </div>
              </div>

              {/* Action Button */}
              {isDisabled ? (
                <button
                  disabled
                  className="w-full py-3 bg-slate-800 text-slate-500 font-semibold rounded-xl text-xs cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Coming Soon</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedPlan(plan);
                    setError('');
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <span>Invest Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Purchase Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-lg text-white">Confirm Plan Investment</h3>

            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Plan:</span>
                <span className="font-bold text-emerald-400">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Capital Required:</span>
                <span className="font-bold text-white">${selectedPlan.investment_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Daily Return:</span>
                <span className="font-bold text-emerald-400">+${selectedPlan.daily_earning.toFixed(2)}/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Your Available Balance:</span>
                <span className="font-semibold text-slate-200">${Number(wallet?.available_balance || 0).toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedPlan(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handlePurchase}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Processing...' : 'Confirm & Invest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
