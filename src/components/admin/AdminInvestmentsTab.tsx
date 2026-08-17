import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  Coins,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  DollarSign,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminInvestmentsTabProps {
  token: string | null;
  onInspectUser: (userId: string) => void;
}

export const AdminInvestmentsTab: React.FC<AdminInvestmentsTabProps> = ({
  token,
  onInspectUser,
}) => {
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchInvestments = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/investments?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvestments(data.investments || []);
      }
    } catch (err) {
      console.error('Failed to fetch investments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
  }, [token, statusFilter]);

  const filtered = investments.filter((inv) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      inv.investmentId?.toLowerCase().includes(term) ||
      inv.planName?.toLowerCase().includes(term) ||
      inv.username?.toLowerCase().includes(term) ||
      inv.email?.toLowerCase().includes(term)
    );
  });

  const totalActiveCapital = investments
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + (i.investmentAmount || 0), 0);

  const totalDistributedEarnings = investments.reduce(
    (acc, i) => acc + (i.totalEarned || 0),
    0
  );

  const activePlansCount = investments.filter((i) => i.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Active Investment Capital</div>
          <div className="text-2xl font-black text-amber-400">
            ${totalActiveCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">{activePlansCount} Active Portfolios</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Yield Paid to Date</div>
          <div className="text-2xl font-black text-emerald-400">
            +${totalDistributedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <div className="text-[11px] text-slate-500">Distributed Across All Plans</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
          <div className="text-xs font-semibold text-slate-400">Total Portfolios Created</div>
          <div className="text-2xl font-black text-white">{investments.length}</div>
          <div className="text-[11px] text-slate-500">Lifetime Subscriptions</div>
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
              placeholder="Search plan, ID, investor username..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Portfolios</option>
            <option value="active">Active Only</option>
            <option value="completed">Completed / Matured</option>
          </select>
        </div>

        <button
          onClick={fetchInvestments}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Portfolios</span>
        </button>
      </div>

      {/* Investments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Investor</th>
                <th className="p-4">Plan Name</th>
                <th className="p-4">Principal Amount</th>
                <th className="p-4">Daily Yield</th>
                <th className="p-4">Progress / Days</th>
                <th className="p-4">Total Earned</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    <span>Loading platform investment portfolios...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    No investments match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const progressPct = Math.min(
                    100,
                    Math.round(((inv.daysCredited || 0) / (inv.durationDays || 120)) * 100)
                  );
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          <span>@{inv.username}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{inv.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-200">{inv.planName}</div>
                        <div className="text-[11px] text-amber-400 font-semibold">Tier VIP {inv.vipLevel}</div>
                      </td>
                      <td className="p-4 font-bold text-white text-sm">
                        ${Number(inv.investmentAmount || 0).toFixed(2)} USD
                      </td>
                      <td className="p-4 font-semibold text-emerald-400">
                        +${Number(inv.dailyEarning || 0).toFixed(2)}/day
                      </td>
                      <td className="p-4 min-w-[150px]">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>{inv.daysCredited || 0} / {inv.durationDays || 120} days</span>
                          <span className="font-bold text-white">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              inv.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-4 font-bold text-emerald-400 text-sm">
                        +${Number(inv.totalEarned || 0).toFixed(2)} USD
                      </td>
                      <td className="p-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => onInspectUser(inv.userId)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        >
                          Inspect
                        </button>
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
  );
};
