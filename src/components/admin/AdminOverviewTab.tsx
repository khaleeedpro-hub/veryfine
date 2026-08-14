import React from 'react';
import {
  Users,
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Play,
  RefreshCw,
  Clock,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminOverviewTabProps {
  metrics: any;
  recentTransactions: any[];
  isProcessingCron: boolean;
  cronResult: string | null;
  onRunDailyCron: () => void;
  onSwitchTab: (tabId: string) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  metrics,
  recentTransactions,
  isProcessingCron,
  cronResult,
  onRunDailyCron,
  onSwitchTab,
}) => {
  if (!metrics) {
    return (
      <div className="p-8 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
        Loading system metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Coins className="w-4 h-4" />
            <span>Automated Yield Engine</span>
          </div>
          <h2 className="text-lg font-bold text-white">Daily VIP Returns Distribution</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Trigger the daily cron engine to credit all active investor VIP plans through double-entry ledger transactions.
          </p>
        </div>

        <button
          onClick={onRunDailyCron}
          disabled={isProcessingCron}
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 shrink-0 transition-all cursor-pointer"
        >
          {isProcessingCron ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-slate-950" />
          )}
          <span>{isProcessingCron ? 'Executing Ledger Engine...' : 'Run Daily Cron Now'}</span>
        </button>
      </div>

      {cronResult && (
        <div className="p-4 bg-slate-900 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{cronResult}</span>
        </div>
      )}

      {/* Main Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onSwitchTab('users')}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Investors</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.totalUsers || 0}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{metrics.activeUsers || 0} Active</span>
            <span>•</span>
            <span className="text-red-400 font-semibold">{metrics.suspendedUsers || 0} Suspended</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Available Capital</span>
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ${(metrics.totalAvailableBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400">
            Across all user balances
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Active Investments</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ${(metrics.totalInvestedBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400">
            {metrics.activeInvestmentsCount || 0} active VIP portfolios
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Earnings Paid</span>
            <Coins className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ${(metrics.totalEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400">
            Total ledger rewards distributed
          </div>
        </div>
      </div>

      {/* Pending Action Highlights */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div
          onClick={() => onSwitchTab('deposits')}
          className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Pending Deposits</div>
              <div className="text-[11px] text-slate-400">
                {metrics.pendingDepositsCount || 0} requests (${(metrics.pendingDepositsAmount || 0).toFixed(2)})
              </div>
            </div>
          </div>
          {metrics.pendingDepositsCount > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
              Needs Review
            </span>
          )}
        </div>

        <div
          onClick={() => onSwitchTab('withdrawals')}
          className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Pending Withdrawals</div>
              <div className="text-[11px] text-slate-400">
                {metrics.pendingWithdrawalsCount || 0} requests (${(metrics.pendingWithdrawalsAmount || 0).toFixed(2)})
              </div>
            </div>
          </div>
          {metrics.pendingWithdrawalsCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30">
              Action Required
            </span>
          )}
        </div>
      </div>

      {/* Recent Ledger Activity Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="font-bold text-sm text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Recent Platform Transactions</span>
          </div>
          <button
            onClick={() => onSwitchTab('ledger')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            View Double-Entry Ledger →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Txn ID</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount (USD)</th>
                <th className="p-4">Description</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-[11px] text-slate-400">{tx.id.substring(0, 16)}...</td>
                    <td className="p-4 font-semibold text-white">{tx.type}</td>
                    <td className="p-4 font-bold text-white">
                      ${Number(tx.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-400 max-w-xs truncate">{tx.description}</td>
                    <td className="p-4 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="p-4">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
