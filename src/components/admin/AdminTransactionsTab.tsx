import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  User,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminTransactionsTabProps {
  token: string | null;
  onInspectUser: (userId: string) => void;
}

export const AdminTransactionsTab: React.FC<AdminTransactionsTabProps> = ({
  token,
  onInspectUser,
}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchTransactions = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/transactions?type=${typeFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token, typeFilter]);

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.transactionId?.toLowerCase().includes(term) ||
      t.userId?.toLowerCase().includes(term) ||
      t.username?.toLowerCase().includes(term) ||
      t.type?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.reference?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transaction ID, user, reference..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="DEPOSIT">Deposits</option>
            <option value="WITHDRAWAL">Withdrawals</option>
            <option value="INVESTMENT">VIP Investments</option>
            <option value="DAILY_EARNING">Daily Yields</option>
            <option value="TRANSFER_OUT">Transfers Out</option>
            <option value="TRANSFER_IN">Transfers In</option>
            <option value="ADJUSTMENT_CREDIT">Admin Credits</option>
            <option value="ADJUSTMENT_DEBIT">Admin Debits</option>
          </select>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Transactions</span>
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Transaction ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Balance Delta</th>
                <th className="p-4">Status</th>
                <th className="p-4">Description</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Loading platform transactions...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    No transactions recorded matching the search.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const isPositive = [
                    'DEPOSIT',
                    'DAILY_EARNING',
                    'TRANSFER_IN',
                    'ADJUSTMENT_CREDIT',
                    'INVESTMENT_MATURITY',
                  ].includes(t.type);

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono text-[11px] text-slate-400">
                        {t.transactionId || t.id}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => t.userId && onInspectUser(t.userId)}
                          className="font-bold text-white hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>@{t.username || t.userId?.substring(0, 8)}</span>
                        </button>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-200 px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                          {t.type}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-sm">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? '+' : '-'}${Number(t.amount || 0).toFixed(2)} USD
                        </span>
                      </td>
                      <td className="p-4 text-[11px] text-slate-400 font-mono">
                        {t.balanceBefore !== undefined && t.balanceAfter !== undefined ? (
                          <span>
                            ${Number(t.balanceBefore).toFixed(2)} → ${Number(t.balanceAfter).toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={t.status || 'completed'} />
                      </td>
                      <td className="p-4 text-[11px] text-slate-400 max-w-xs truncate">
                        {t.description || t.reference || '—'}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {new Date(t.createdAt).toLocaleString()}
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
