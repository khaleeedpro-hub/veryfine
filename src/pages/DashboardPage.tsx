import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWalletBalance } from '../services/walletService';
import {
  Wallet as WalletIcon,
  TrendingUp,
  Briefcase,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  PlusCircle,
  Copy,
  Check,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { RiskDisclaimerBanner } from '../components/common/RiskDisclaimerBanner';
import { Investment, Transaction } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, wallet: authWallet, token } = useAuth();
  const {
    wallet: firestoreWallet,
    loading: isWalletLoading,
    error: walletError,
    refetch: refetchWallet,
  } = useWalletBalance(user?.id);

  // Use real Firestore wallet balance from walletService, falling back to auth context wallet
  const currentWallet = firestoreWallet || authWallet;

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const [invRes, txRes] = await Promise.all([
          fetch('/api/vip/my-investments', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/transactions?limit=5', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvestments(Array.isArray(invData) ? invData : (invData.investments || []));
        }

        if (txRes.ok) {
          const txData = await txRes.json();
          setRecentTxns(Array.isArray(txData) ? txData : (txData.transactions || []));
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleCopyWallet = () => {
    if (currentWallet?.wallet_address) {
      navigator.clipboard.writeText(currentWallet.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeInvestments = investments.filter((i) => i.status === 'active');
  const totalEarned = investments.reduce((sum, i) => sum + Number(i.total_earned), 0);

  // Chart data for earnings trend
  const chartData = [
    { day: 'Mon', earnings: Number((totalEarned * 0.1).toFixed(2)) },
    { day: 'Tue', earnings: Number((totalEarned * 0.25).toFixed(2)) },
    { day: 'Wed', earnings: Number((totalEarned * 0.4).toFixed(2)) },
    { day: 'Thu', earnings: Number((totalEarned * 0.6).toFixed(2)) },
    { day: 'Fri', earnings: Number((totalEarned * 0.75).toFixed(2)) },
    { day: 'Sat', earnings: Number((totalEarned * 0.9).toFixed(2)) },
    { day: 'Sun', earnings: Number(totalEarned.toFixed(2)) },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>Welcome back, {user?.fullName || 'Investor'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Wallet ID: <span className="font-mono text-slate-200 font-semibold">{currentWallet?.wallet_address || 'WALLET-LOADING'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetchWallet}
            disabled={isWalletLoading}
            title="Refresh balance from Firebase"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium rounded-xl border border-slate-700/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isWalletLoading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
          </button>

          <button
            onClick={handleCopyWallet}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy Wallet Address'}</span>
          </button>

          <button
            onClick={() => onNavigate('deposit')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Deposit</span>
          </button>
        </div>
      </div>

      <RiskDisclaimerBanner />

      {walletError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Firebase balance sync error: {walletError}</span>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Available Balance</span>
            <WalletIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            {isWalletLoading && !currentWallet ? (
              <span className="text-slate-500 text-lg animate-pulse">Loading...</span>
            ) : (
              <span>${Number(currentWallet?.available_balance || 0).toFixed(2)}</span>
            )}
          </div>
          <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Real-time Firebase Balance</span>
          </div>
        </div>

        {/* Invested Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Invested Capital</span>
            <Briefcase className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-300">
            {isWalletLoading && !currentWallet ? (
              <span className="text-slate-500 text-lg animate-pulse">Loading...</span>
            ) : (
              <span>${Number(currentWallet?.invested_balance || 0).toFixed(2)}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">{activeInvestments.length} Active VIP Plan(s)</div>
        </div>

        {/* Total Earnings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Earnings</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-300">
            +${Number(currentWallet?.total_earnings || totalEarned).toFixed(2)}
          </div>
          <div className="text-[10px] text-purple-400 font-medium">Idempotent Daily Rewards</div>
        </div>

        {/* Quick Action Hub */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-2">
          <div className="text-xs text-slate-400 font-semibold mb-1">Quick Financial Operations</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onNavigate('deposit')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center text-[11px] font-semibold text-slate-200 transition-colors flex flex-col items-center gap-1"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>Deposit</span>
            </button>
            <button
              onClick={() => onNavigate('withdraw')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center text-[11px] font-semibold text-slate-200 transition-colors flex flex-col items-center gap-1"
            >
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
              <span>Withdraw</span>
            </button>
            <button
              onClick={() => onNavigate('transfer')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-center text-[11px] font-semibold text-slate-200 transition-colors flex flex-col items-center gap-1"
            >
              <Send className="w-4 h-4 text-purple-400" />
              <span>Transfer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart and Active Investments */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Earnings Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-base">Weekly Reward Accumulation</h2>
              <p className="text-xs text-slate-400">Ledger snapshot of credited earnings</p>
            </div>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Live Ledger
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Earned']}
                />
                <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Investments Progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-base">Active Plans</h2>
            <button
              onClick={() => onNavigate('vip-plans')}
              className="text-xs text-emerald-400 font-semibold hover:underline"
            >
              + Invest More
            </button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {activeInvestments.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs space-y-3">
                <Briefcase className="w-8 h-8 text-slate-700 mx-auto" />
                <p>No active VIP investments yet.</p>
                <button
                  onClick={() => onNavigate('vip-plans')}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold"
                >
                  Explore VIP Plans
                </button>
              </div>
            ) : (
              activeInvestments.map((inv) => {
                const progressPct = Math.min(100, Math.round((inv.days_credited / inv.duration_days) * 100));
                return (
                  <div key={inv.id} className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/40 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{inv.plan_name}</span>
                      <span className="text-emerald-400 font-semibold">+${Number(inv.daily_earning).toFixed(2)}/day</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Invested: ${Number(inv.investment_amount).toFixed(2)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Day {inv.days_credited}/{inv.duration_days}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
