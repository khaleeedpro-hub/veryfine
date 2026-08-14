import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InternalTransfer } from '../types';
import { Send, Search, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface TransferPageProps {
  onNavigate?: (tab: string) => void;
}

export const TransferPage: React.FC<TransferPageProps> = ({ onNavigate }) => {
  const { wallet, token, refreshUserContext } = useAuth();
  const [recipientWallet, setRecipientWallet] = useState('');
  const [amount, setAmount] = useState('10');
  const [note, setNote] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vipCheck, setVipCheck] = useState<{ isEligible: boolean; vipLevel: number; planName: string | null } | null>(null);

  useEffect(() => {
    fetchTransfers();
    checkVipEligibility();
  }, [token]);

  const checkVipEligibility = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/transfers/vip-check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVipCheck(data);
      }
    } catch (err) {
      console.error('Failed to verify VIP eligibility:', err);
    }
  };

  const fetchTransfers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/transfers/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }
    } catch (err) {
      console.error('Failed to fetch transfers:', err);
    }
  };

  // Lookup target wallet address name
  const handleLookupWallet = async () => {
    if (!recipientWallet.trim() || !token) return;
    setIsSearching(true);
    setRecipientName(null);
    setError('');

    try {
      const res = await fetch(`/api/transfers/lookup?walletAddress=${encodeURIComponent(recipientWallet.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Recipient wallet address not found.');
      }
      setRecipientName(data.fullName);
    } catch (err: any) {
      setError(err.message || 'Lookup failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (vipCheck && !vipCheck.isEligible) {
      setError('Access Restricted: You must be registered to at least VIP 1 before you can send internal transfers. Please purchase a VIP Plan first.');
      return;
    }

    const tAmount = Number(amount);
    const available = Number(wallet?.available_balance || 0);

    if (isNaN(tAmount) || tAmount < 1 || tAmount > 50) {
      setError('Internal transfer amount must be between $1.00 and $50.00 USD per transaction.');
      return;
    }

    if (tAmount > available) {
      setError(`Insufficient available balance ($${available.toFixed(2)} available).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientWalletAddress: recipientWallet.trim(),
          amount: tAmount,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Internal transfer failed.');
      }

      setSuccess(`Internal transfer of $${tAmount.toFixed(2)} sent successfully to ${data.transfer.recipient_name || recipientWallet}!`);
      setRecipientWallet('');
      setRecipientName(null);
      setAmount('10');
      setNote('');
      await refreshUserContext();
      await fetchTransfers();
    } catch (err: any) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-purple-400" />
            <span>Instant Internal USD Transfer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Send USD instantly to any registered user. Rules: Max $50.00 USD per day | Max 2 transfers per day.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 px-4 py-2.5 rounded-xl text-xs flex items-center gap-3 shrink-0">
          <div>
            <div className="text-slate-400 font-semibold text-[10px] uppercase">Available Wallet</div>
            <div className="font-bold text-emerald-400 text-sm">${Number(wallet?.available_balance || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {vipCheck && !vipCheck.isEligible && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-amber-100 flex items-center gap-2">
                <span>VIP 1 Registration Required for Internal Transfers</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Restricted
                </span>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Internal USD transfers require an active registration of at least VIP 1 or higher. Upgrade your plan to start sending funds instantly.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('vip-plans')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <span>Register for VIP 1</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="font-bold text-base text-white">Send USD</h2>

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

          <form onSubmit={handleTransfer} className="space-y-4 text-xs">
            {/* Wallet Address Lookup */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Recipient Wallet Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recipientWallet}
                  onChange={(e) => {
                    setRecipientWallet(e.target.value);
                    setRecipientName(null);
                  }}
                  className="flex-1 bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 px-3 text-white font-mono focus:outline-none focus:border-purple-500 uppercase"
                  placeholder="WALLET-XXXXXXXX"
                  required
                />
                <button
                  type="button"
                  onClick={handleLookupWallet}
                  disabled={isSearching}
                  className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </button>
              </div>

              {recipientName && (
                <div className="text-[11px] text-emerald-400 font-semibold pt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Recipient: {recipientName}</span>
                </div>
              )}
            </div>

            {/* Transfer Amount */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Transfer Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 pl-8 pr-3 text-white font-bold focus:outline-none focus:border-purple-500"
                  placeholder="10.00"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">Strict limit: $50.00 max per day across all internal transfers.</p>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Optional Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-purple-500"
                placeholder="Payment description..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? 'Processing Transfer...' : 'Send Internal USD'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Transfer History */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">Transfer Logs</h2>
            <span className="text-xs text-slate-400">{transfers.length} Record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Direction</th>
                  <th className="p-4">Counterparty</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      No internal transfer logs found.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => {
                    const isOutgoing = t.sender_wallet_address === wallet?.wallet_address;
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono text-slate-400">{t.id}</td>
                        <td className="p-4 font-semibold">
                          {isOutgoing ? (
                            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">SENT</span>
                          ) : (
                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">RECEIVED</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-200 font-medium">
                          {isOutgoing ? (t.recipient_name || t.recipient_wallet_address) : (t.sender_name || t.sender_wallet_address)}
                        </td>
                        <td className={`p-4 font-bold ${isOutgoing ? 'text-rose-300' : 'text-emerald-400'}`}>
                          {isOutgoing ? '-' : '+'}${Number(t.amount).toFixed(2)}
                        </td>
                        <td className="p-4 text-slate-400">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="p-4">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
