import React, { useState } from 'react';
import { ArrowDownLeft, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminDepositsTabProps {
  deposits: any[];
  isLoading: boolean;
  onRefresh: () => void;
  token: string | null;
  onSuccess: () => void;
}

export const AdminDepositsTab: React.FC<AdminDepositsTabProps> = ({
  deposits,
  isLoading,
  onRefresh,
  token,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [activeModalDeposit, setActiveModalDeposit] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const filteredDeposits = deposits.filter((d) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (d.id || d.depositId || '').toLowerCase().includes(q) ||
      (d.user_id || d.userId || '').toLowerCase().includes(q) ||
      (d.username || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q) ||
      (d.payment_method || d.paymentProvider || '').toLowerCase().includes(q)
    );
  });

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalDeposit) return;

    setIsProcessing(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/deposits/${activeModalDeposit.id || activeModalDeposit.depositId}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: reconcileNotes.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reconcile deposit.');

      setActiveModalDeposit(null);
      setReconcileNotes('');
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by deposit ID, username, email..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={onRefresh}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer self-end md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Deposits Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-sm text-white flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          <span>Inbound Deposits & Bank Wire Reconciliation ({filteredDeposits.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Deposit ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Amount (USD)</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDeposits.length > 0 ? (
                filteredDeposits.map((d) => (
                  <tr key={d.id || d.depositId} className="hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      {(d.id || d.depositId).substring(0, 14)}...
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">@{d.username || d.user_id}</div>
                      <div className="text-[11px] text-slate-400">{d.email}</div>
                    </td>
                    <td className="p-4 font-bold text-emerald-400 text-sm">
                      +${Number(d.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-300">
                      <div>{d.payment_method || d.paymentProvider}</div>
                      {d.providerReference && (
                        <div className="text-[10px] text-slate-500 font-mono">Ref: {d.providerReference}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">{new Date(d.created_at || d.createdAt).toLocaleString()}</td>
                    <td className="p-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="p-4 text-right">
                      {d.status === 'pending' ? (
                        <button
                          onClick={() => setActiveModalDeposit(d)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer text-xs flex items-center gap-1.5 ml-auto shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Reconcile & Credit</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Reconciled</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    No deposits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reconciliation Modal */}
      {activeModalDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-slate-100 space-y-6 relative">
            <button
              onClick={() => setActiveModalDeposit(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl font-bold p-1 cursor-pointer"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reconcile & Credit Deposit</h3>
                <p className="text-xs text-slate-400">
                  Credit <span className="text-emerald-400 font-bold">${Number(activeModalDeposit.amount).toFixed(2)} USD</span> to user wallet
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleReconcileSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target User:</span>
                  <span className="font-bold text-white">@{activeModalDeposit.username || activeModalDeposit.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="text-slate-200">{activeModalDeposit.payment_method || activeModalDeposit.paymentProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deposit Amount:</span>
                  <span className="font-extrabold text-emerald-400 text-sm">+${Number(activeModalDeposit.amount).toFixed(2)} USD</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Reconciliation Notes (Bank Wire / Reference)</label>
                <textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="e.g. Confirmed in Chase corporate account, wire reference #994827"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModalDeposit(null)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-2/3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Crediting Ledger...' : 'Approve & Credit Balance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
