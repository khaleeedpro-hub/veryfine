import React, { useState, useEffect } from 'react';
import {
  Send,
  Search,
  RefreshCw,
  ArrowRight,
  User,
  Clock,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminTransfersTabProps {
  token: string | null;
  onInspectUser: (userId: string) => void;
}

export const AdminTransfersTab: React.FC<AdminTransfersTabProps> = ({
  token,
  onInspectUser,
}) => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTransfers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/transfers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }
    } catch (err) {
      console.error('Failed to fetch transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [token]);

  const filtered = transfers.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.transferId?.toLowerCase().includes(term) ||
      t.senderUsername?.toLowerCase().includes(term) ||
      t.recipientUsername?.toLowerCase().includes(term) ||
      t.recipientAddress?.toLowerCase().includes(term) ||
      t.senderId?.toLowerCase().includes(term) ||
      t.recipientId?.toLowerCase().includes(term)
    );
  });

  const totalVolume = transfers.reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalFees = transfers.reduce((acc, t) => acc + (t.fee || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Internal Volume</div>
          <div className="text-2xl font-black text-sky-400">
            ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">{transfers.length} P2P Ledger Transfers</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Platform Transfer Fees</div>
          <div className="text-2xl font-black text-emerald-400">
            ${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">Collected from P2P Flow</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Daily Transfer Ceiling</div>
          <div className="text-2xl font-black text-white">$50.00 USD</div>
          <div className="text-[11px] text-slate-500">Per User / 24-Hour Cycle</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transfer ID, sender, recipient, address..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <button
          onClick={fetchTransfers}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Transfers</span>
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Transfer ID</th>
                <th className="p-4">Sender</th>
                <th className="p-4">Recipient</th>
                <th className="p-4">Gross Amount</th>
                <th className="p-4">Fee</th>
                <th className="p-4">Net Received</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                    <span>Loading internal transfer records...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    No internal transfers recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      {t.transferId || t.id}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => t.senderId && onInspectUser(t.senderId)}
                        className="font-bold text-white hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>@{t.senderUsername || 'Sender'}</span>
                      </button>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => t.recipientId && onInspectUser(t.recipientId)}
                        className="font-bold text-white hover:text-sky-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>@{t.recipientUsername || 'Recipient'}</span>
                      </button>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {t.recipientAddress || 'Internal Wallet'}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-white text-sm">
                      ${Number(t.amount || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4 text-slate-400">
                      ${Number(t.fee || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4 font-bold text-emerald-400 text-sm">
                      ${Number(t.netAmount || t.amount || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4">
                      <StatusBadge status={t.status || 'completed'} />
                    </td>
                    <td className="p-4 text-slate-400 text-[11px]">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
