import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, XCircle, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminWithdrawalsTabProps {
  withdrawals: any[];
  isLoading: boolean;
  onRefresh: () => void;
  token: string | null;
  onSuccess: () => void;
}

export const AdminWithdrawalsTab: React.FC<AdminWithdrawalsTabProps> = ({
  withdrawals,
  isLoading,
  onRefresh,
  token,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (w.id || w.withdrawalId || '').toLowerCase().includes(q) ||
      (w.user_id || w.userId || '').toLowerCase().includes(q) ||
      (w.username || '').toLowerCase().includes(q) ||
      (w.email || '').toLowerCase().includes(q) ||
      (w.destination_address || w.destinationAddress || '').toLowerCase().includes(q)
    );
  });

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal) return;

    setIsProcessing(true);
    setError('');

    try {
      const endpoint =
        actionType === 'approve'
          ? `/api/admin/withdrawals/${selectedWithdrawal.id || selectedWithdrawal.withdrawalId}/approve`
          : `/api/admin/withdrawals/${selectedWithdrawal.id || selectedWithdrawal.withdrawalId}/reject`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectReason.trim() || 'Administrative rejection' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionType} withdrawal.`);

      setSelectedWithdrawal(null);
      setRejectReason('');
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
            placeholder="Search by withdrawal ID, username, address..."
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

      {/* Withdrawals Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-sm text-white flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-amber-400" />
          <span>Outbound Withdrawal Requests ({filteredWithdrawals.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Withdrawal ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Gross Amount</th>
                <th className="p-4">Fee / Net</th>
                <th className="p-4">Destination Details</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredWithdrawals.length > 0 ? (
                filteredWithdrawals.map((w) => {
                  const gross = Number(w.amount || 0);
                  const fee = Number(w.fee || 0);
                  const net = Number(w.net_amount || w.netAmount || gross - fee);

                  return (
                    <tr key={w.id || w.withdrawalId} className="hover:bg-slate-800/40">
                      <td className="p-4 font-mono text-[11px] text-slate-400">
                        {(w.id || w.withdrawalId).substring(0, 14)}...
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">@{w.username || w.user_id}</div>
                        <div className="text-[11px] text-slate-400">{w.email}</div>
                      </td>
                      <td className="p-4 font-bold text-amber-400 text-sm">
                        ${gross.toFixed(2)} USD
                      </td>
                      <td className="p-4">
                        <div className="text-slate-300 font-bold">${net.toFixed(2)} Net</div>
                        <div className="text-[10px] text-slate-500">Fee: ${fee.toFixed(2)}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-white font-medium capitalize">{w.method || w.withdrawalMethod || 'Bank Wire'}</div>
                        <div className="text-[10px] text-slate-400 font-mono max-w-xs truncate">
                          {w.destination_address || w.destinationAddress || w.bankDetails || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{new Date(w.created_at || w.createdAt).toLocaleString()}</td>
                      <td className="p-4">
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="p-4 text-right">
                        {w.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setActionType('approve');
                              }}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setActionType('reject');
                              }}
                              className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject & Refund</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    No withdrawal requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-slate-100 space-y-6 relative">
            <button
              onClick={() => setSelectedWithdrawal(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl font-bold p-1 cursor-pointer"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                  actionType === 'approve'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {actionType === 'approve' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {actionType === 'approve' ? 'Approve Payout' : 'Reject & Refund Withdrawal'}
                </h3>
                <p className="text-xs text-slate-400">
                  {actionType === 'approve'
                    ? 'Confirm payout dispatch for user'
                    : 'Rejection automatically credits funds back to the user balance via double-entry ledger'}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">User:</span>
                  <span className="font-bold text-white">@{selectedWithdrawal.username || selectedWithdrawal.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payout Net:</span>
                  <span className="font-extrabold text-amber-400 text-sm">
                    ${Number(selectedWithdrawal.net_amount || selectedWithdrawal.amount).toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[200px]">
                    {selectedWithdrawal.destination_address || selectedWithdrawal.destinationAddress || 'Bank Wire'}
                  </span>
                </div>
              </div>

              {actionType === 'reject' && (
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Reason for Rejection *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Invalid bank routing number, compliance check failed, suspicious destination"
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedWithdrawal(null)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`w-2/3 py-2.5 font-bold rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                    actionType === 'approve'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                  }`}
                >
                  <span>
                    {isProcessing
                      ? 'Processing...'
                      : actionType === 'approve'
                      ? 'Confirm Payout Sent'
                      : 'Reject & Refund Balance'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
