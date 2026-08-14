import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deposit } from '../types';
import { ArrowDownLeft, CreditCard, Landmark, Coins, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const DepositPage: React.FC = () => {
  const { token, refreshUserContext } = useAuth();
  const [amount, setAmount] = useState('100');
  const [paymentMethod, setPaymentMethod] = useState('USDT_TRC20');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDeposits();
  }, [token]);

  const fetchDeposits = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/deposits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const depAmount = Number(amount);
    if (isNaN(depAmount) || depAmount < 20 || depAmount > 10000) {
      setError('Deposit amount must be between $20.00 and $10,000.00 USD.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: depAmount,
          paymentMethod,
          paymentDetails: `Payment simulation via ${paymentMethod}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Deposit processing failed.');
      }

      setSuccess(`Deposit of $${depAmount.toFixed(2)} completed successfully! Funds added to your available balance.`);
      setAmount('100');
      await refreshUserContext();
      await fetchDeposits();
    } catch (err: any) {
      setError(err.message || 'Deposit failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
            <span>Deposit USD Capital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Minimum deposit: $20.00 USD | Maximum deposit: $10,000.00 USD
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Deposit Form */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="font-bold text-base text-white">Deposit Request</h2>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleDeposit} className="space-y-4 text-xs">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Deposit Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="20"
                  max="10000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                  placeholder="20.00"
                  required
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold">Supported Payment Channel</label>
              <div className="space-y-2">
                {[
                  { id: 'USDT_TRC20', label: 'USDT (TRC-20 Crypto)', icon: Coins },
                  { id: 'CREDIT_CARD', label: 'Credit Card (Instant Gateway)', icon: CreditCard },
                  { id: 'BANK_WIRE', label: 'Bank Wire / ACH Settlement', icon: Landmark },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-white font-semibold'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span>{m.label}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Confirm Deposit</span>
              )}
            </button>
          </form>
        </div>

        {/* Deposit History */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">Deposit History</h2>
            <span className="text-xs text-slate-400">{deposits.length} Record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">Deposit ID</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      No deposit records found.
                    </td>
                  </tr>
                ) : (
                  deposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{dep.id}</td>
                      <td className="p-4 font-bold text-emerald-400">+${Number(dep.amount).toFixed(2)}</td>
                      <td className="p-4 text-slate-300 font-medium">{dep.payment_method}</td>
                      <td className="p-4 text-slate-400">{new Date(dep.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        <StatusBadge status={dep.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
