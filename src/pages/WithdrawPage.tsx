import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Withdrawal } from '../types';
import { ArrowUpRight, Lock, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { PinPadModal } from '../components/common/PinPadModal';

export const WithdrawPage: React.FC = () => {
  const { wallet, user, token, refreshUserContext } = useAuth();
  const [amount, setAmount] = useState('50');
  const [paymentMethod, setPaymentMethod] = useState('USDT_TRC20');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWithdrawals();
  }, [token]);

  const fetchWithdrawals = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/withdrawals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    }
  };

  const handleOpenPinModal = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const wAmount = Number(amount);
    const available = Number(wallet?.available_balance || 0);

    if (isNaN(wAmount) || wAmount < 10 || wAmount > 5000) {
      setError('Withdrawal amount must be between $10.00 and $5,000.00 USD.');
      return;
    }

    if (wAmount > available) {
      setError(`Insufficient available balance ($${available.toFixed(2)} available).`);
      return;
    }

    if (!paymentDetails.trim()) {
      setError('Please provide destination wallet address or payout account details.');
      return;
    }

    if (user?.pinCooldownUntil) {
      const cooldownEnd = new Date(user.pinCooldownUntil).getTime();
      if (Date.now() < cooldownEnd) {
        const remainingHours = Math.ceil((cooldownEnd - Date.now()) / (1000 * 60 * 60));
        setError(`Withdrawals are currently locked due to a recent PIN reset (${remainingHours} hours remaining).`);
        return;
      }
    }

    setShowPinModal(true);
  };

  const handleConfirmWithdrawalWithPin = async (pin: string) => {
    setIsSubmitting(true);
    try {
      const wAmount = Number(amount);
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: wAmount,
          withdrawalPin: pin,
          paymentMethod,
          paymentDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal request failed.');
      }

      setSuccess(`Withdrawal request of $${wAmount.toFixed(2)} submitted successfully! (Net Payout: $${data.netAmount?.toFixed(2)} after 1.5% fee).`);
      setAmount('50');
      setPaymentDetails('');
      await refreshUserContext();
      await fetchWithdrawals();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const grossAmount = Number(amount) || 0;
  const feeAmount = (grossAmount * 0.015);
  const netAmount = Math.max(0, grossAmount - feeAmount);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-6 h-6 text-rose-400" />
            <span>Withdraw USD Capital</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Protected by your 4-digit security PIN | Minimum: $10.00 USD | Standard Fee: 1.5%
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 px-4 py-2.5 rounded-xl text-xs flex items-center gap-3 shrink-0">
          <div>
            <div className="text-slate-400 font-semibold text-[10px] uppercase">Available Balance</div>
            <div className="font-bold text-emerald-400 text-sm">${Number(wallet?.available_balance || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Withdrawal Form */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="font-bold text-base text-white">Request Payout</h2>

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

          <form onSubmit={handleOpenPinModal} className="space-y-4 text-xs">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Gross Withdrawal Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-rose-500"
                  placeholder="50.00"
                  required
                />
              </div>
            </div>

            {/* Breakdown Box */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Requested Gross:</span>
                <span className="font-semibold text-white">${grossAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Processing Fee (1.5%):</span>
                <span className="font-semibold text-amber-400">-${feeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-200 font-bold pt-1 border-t border-slate-700/50">
                <span>Net Estimated Payout:</span>
                <span className="text-emerald-400">${netAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Method */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Payout Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="USDT_TRC20">USDT (TRC-20 Wallet)</option>
                <option value="BANK_WIRE">Bank Wire Transfer</option>
                <option value="PAYPAL">PayPal USD Account</option>
              </select>
            </div>

            {/* Destination Details */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Destination Address / Details</label>
              <input
                type="text"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 px-3 text-white font-mono focus:outline-none focus:border-rose-500"
                placeholder={paymentMethod === 'USDT_TRC20' ? 'e.g. T9yD14Nj9j7x...' : 'Account number or email'}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Lock className="w-4 h-4" />
              <span>Verify PIN & Request Payout</span>
            </button>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">Withdrawal History</h2>
            <span className="text-xs text-slate-400">{withdrawals.length} Record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Gross</th>
                  <th className="p-4">Fee (1.5%)</th>
                  <th className="p-4">Net Payout</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No withdrawal requests found.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{w.id}</td>
                      <td className="p-4 font-bold text-white">${Number(w.amount).toFixed(2)}</td>
                      <td className="p-4 text-amber-400">-${Number(w.fee).toFixed(2)}</td>
                      <td className="p-4 font-bold text-emerald-400">${Number(w.net_amount).toFixed(2)}</td>
                      <td className="p-4 text-slate-300">{w.payment_method}</td>
                      <td className="p-4 text-slate-400">{new Date(w.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PinPadModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onConfirm={handleConfirmWithdrawalWithPin}
        title="Confirm Withdrawal Authorization"
        description={`Enter your 4-digit PIN to process gross payout of $${grossAmount.toFixed(2)} (Net $${netAmount.toFixed(2)}).`}
      />
    </div>
  );
};
