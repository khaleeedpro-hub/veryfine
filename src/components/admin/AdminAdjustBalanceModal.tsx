import React, { useState } from 'react';
import { Shield, AlertCircle, CheckCircle2, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';

interface AdminAdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  token: string | null;
  onSuccess: () => void;
}

export const AdminAdjustBalanceModal: React.FC<AdminAdjustBalanceModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  onSuccess,
}) => {
  const [type, setType] = useState<'adjustment_credit' | 'adjustment_debit'>('adjustment_credit');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  if (!isOpen || !user) return null;

  const currentBalance = Number(user.availableBalance ?? user.available_balance ?? 0);
  const parsedAmount = parseFloat(amount) || 0;
  const isCredit = type === 'adjustment_credit';
  const newCalculatedBalance = isCredit
    ? currentBalance + parsedAmount
    : currentBalance - parsedAmount;

  const isDebitOverdraft = !isCredit && newCalculatedBalance < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (parsedAmount <= 0) {
      setError('Please enter a valid positive adjustment amount.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory reason (at least 5 characters) is required for financial audit compliance.');
      return;
    }

    if (isDebitOverdraft) {
      setError(`Cannot debit $${parsedAmount.toFixed(2)}: user only has $${currentBalance.toFixed(2)} available.`);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id || user.uid,
          type,
          amount: parsedAmount,
          currency: 'USD',
          reason: reason.trim(),
          reference: reference.trim() || `ADJ-REF-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust balance.');
      }

      setSuccessMsg(data.message || 'Balance adjusted successfully.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Balance adjustment failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl text-slate-100 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl font-bold p-1 cursor-pointer"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Controlled Financial Balance Adjustment</h3>
            <p className="text-xs text-slate-400">
              Double-entry ledger adjustment for <span className="text-white font-semibold">@{user.username || user.email}</span> ({user.full_name || user.displayName})
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Current vs Projected Balance Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-slate-500 text-[11px]">Current Available</div>
            <div className="text-base font-extrabold text-white">
              ${currentBalance.toFixed(2)} USD
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Wallet: {user.walletAddress || user.wallet_address || 'Active'}</div>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <div className="text-slate-500 text-[11px]">Projected Balance</div>
            <div
              className={`text-base font-extrabold ${
                isDebitOverdraft
                  ? 'text-red-400'
                  : isCredit
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              ${newCalculatedBalance.toFixed(2)} USD
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {parsedAmount > 0 ? (isCredit ? `+$${parsedAmount.toFixed(2)} Credit` : `-$${parsedAmount.toFixed(2)} Debit`) : 'No change'}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Action Type Tabs */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold">Adjustment Action</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('adjustment_credit')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  isCredit
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Credit Balance (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('adjustment_debit')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  !isCredit
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Debit Balance (-)</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold">Adjustment Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-8 pr-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Reason (Compulsory) */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span>Mandatory Compliance Reason *</span>
              <span className="text-[10px] text-slate-500">Recorded in immutable audit log</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Deposit Wire Reconciliation, VIP Bounty Bonus, Correction of erroneous deduction ticket #8841"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          {/* Reference / Ticket */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold">Reference / Ticket ID (Optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TICKET-9921 / WIRE-CHASE-01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isDebitOverdraft || parsedAmount <= 0}
              className={`w-2/3 py-2.5 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isCredit
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Shield className="w-4 h-4" />
              <span>{isLoading ? 'Executing Ledger...' : isCredit ? `Authorize +$${parsedAmount.toFixed(2)} Credit` : `Authorize -$${parsedAmount.toFixed(2)} Debit`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
