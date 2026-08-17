import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  DollarSign,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminWalletsTabProps {
  token: string | null;
  onInspectUser: (userId: string) => void;
  onOpenAdjustBalance: (user: any) => void;
}

export const AdminWalletsTab: React.FC<AdminWalletsTabProps> = ({
  token,
  onInspectUser,
  onOpenAdjustBalance,
}) => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchWallets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/wallets?q=${encodeURIComponent(search)}&status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWallets(data.wallets || []);
      }
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [token, statusFilter]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFreeze = async (wallet: any) => {
    if (!token || !wallet.userId) return;
    const isCurrentlyFrozen = wallet.status === 'frozen';
    const reason = prompt(
      `Enter reason for ${isCurrentlyFrozen ? 'unfreezing' : 'freezing'} wallet for @${wallet.username}:`,
      isCurrentlyFrozen ? 'Administrative unfreeze' : 'Security audit'
    );
    if (reason === null) return;

    try {
      const res = await fetch(`/api/admin/users/${wallet.userId}/freeze-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          freeze: !isCurrentlyFrozen,
          reason,
        }),
      });

      if (res.ok) {
        fetchWallets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update wallet freeze status.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = wallets.filter((w) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      w.walletId?.toLowerCase().includes(term) ||
      w.walletAddress?.toLowerCase().includes(term) ||
      w.username?.toLowerCase().includes(term) ||
      w.email?.toLowerCase().includes(term)
    );
  });

  const totalPlatformBalance = wallets.reduce((acc, w) => acc + (w.availableBalance || 0), 0);
  const totalPlatformInvested = wallets.reduce((acc, w) => acc + (w.investedBalance || 0), 0);
  const totalPlatformEarnings = wallets.reduce((acc, w) => acc + (w.totalEarnings || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Liquid Wallets</div>
          <div className="text-2xl font-black text-emerald-400">
            ${totalPlatformBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">{wallets.length} Active Ledger Accounts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Capital in VIP Plans</div>
          <div className="text-2xl font-black text-amber-400">
            ${totalPlatformInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">Actively Generating Yield</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Yield Disbursed</div>
          <div className="text-2xl font-black text-sky-400">
            +${totalPlatformEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">Historical Cumulative Returns</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wallet ID, address, username, email..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Wallets</option>
            <option value="frozen">Frozen Wallets</option>
          </select>
        </div>

        <button
          onClick={fetchWallets}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Wallets</span>
        </button>
      </div>

      {/* Wallets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Owner / Account</th>
                <th className="p-4">Wallet ID & Address</th>
                <th className="p-4">Available Balance</th>
                <th className="p-4">Invested Balance</th>
                <th className="p-4">Total Earnings</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Loading internal wallets directory...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    No wallets match the specified criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>@{w.username}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{w.email}</div>
                    </td>
                    <td className="p-4 font-mono text-[11px]">
                      <div className="text-slate-300 font-semibold">{w.walletId}</div>
                      <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{w.walletAddress || 'N/A'}</span>
                        {w.walletAddress && (
                          <button
                            onClick={() => handleCopy(w.walletAddress, w.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedId === w.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-white text-sm">
                      ${Number(w.availableBalance || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4 font-semibold text-amber-400">
                      ${Number(w.investedBalance || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4 font-semibold text-emerald-400">
                      +${Number(w.totalEarnings || 0).toFixed(2)} USD
                    </td>
                    <td className="p-4">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onOpenAdjustBalance(w)}
                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          title="Adjust Balance"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Adjust</span>
                        </button>
                        <button
                          onClick={() => handleToggleFreeze(w)}
                          className={`p-1.5 border rounded-lg cursor-pointer transition-colors ${
                            w.status === 'frozen'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title={w.status === 'frozen' ? 'Unfreeze Wallet' : 'Freeze Wallet'}
                        >
                          {w.status === 'frozen' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-rose-400" />}
                        </button>
                        <button
                          onClick={() => onInspectUser(w.userId)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-xs cursor-pointer transition-colors"
                        >
                          Inspect
                        </button>
                      </div>
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
