import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Users,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Coins,
  Database,
  LayoutDashboard,
  RefreshCw,
  Sliders,
  Wallet,
  Send,
  FileText,
} from 'lucide-react';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminWalletsTab } from '../components/admin/AdminWalletsTab';
import { AdminInvestmentsTab } from '../components/admin/AdminInvestmentsTab';
import { AdminTransfersTab } from '../components/admin/AdminTransfersTab';
import { AdminTransactionsTab } from '../components/admin/AdminTransactionsTab';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { AdminUserDetailModal } from '../components/admin/AdminUserDetailModal';
import { AdminAdjustBalanceModal } from '../components/admin/AdminAdjustBalanceModal';
import { AdminDepositsTab } from '../components/admin/AdminDepositsTab';
import { AdminWithdrawalsTab } from '../components/admin/AdminWithdrawalsTab';
import { AdminVipPlansTab } from '../components/admin/AdminVipPlansTab';
import { AdminLedgerTab } from '../components/admin/AdminLedgerTab';
import { AdminAuditLogsTab } from '../components/admin/AdminAuditLogsTab';
import { AdminGlobalSearchBar } from '../components/admin/AdminGlobalSearchBar';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'wallets'
  | 'plans'
  | 'investments'
  | 'deposits'
  | 'withdrawals'
  | 'transfers'
  | 'transactions'
  | 'ledger'
  | 'audit'
  | 'settings';

export const AdminPortalPage: React.FC = () => {
  const { token, refreshUserContext } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Shared Data States
  const [metrics, setMetrics] = useState<any | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Cron state
  const [isProcessingCron, setIsProcessingCron] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);

  // Modals state
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [adjustBalanceUser, setAdjustBalanceUser] = useState<any | null>(null);

  const fetchTabContent = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setRecentTransactions(data.recentTransactions || []);
        }
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } else if (activeTab === 'deposits') {
        const res = await fetch('/api/admin/deposits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDeposits(data.deposits || []);
        }
      } else if (activeTab === 'withdrawals') {
        const res = await fetch('/api/admin/withdrawals', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWithdrawals(data.withdrawals || []);
        }
      } else if (activeTab === 'plans') {
        const res = await fetch('/api/admin/plans', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin tab data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTabContent();
  }, [token, activeTab]);

  const handleRunDailyCron = async () => {
    setIsProcessingCron(true);
    setCronResult(null);
    try {
      const res = await fetch('/api/admin/process-daily-returns', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCronResult(
          `Cron Success: Processed ${data.processedCount} portfolio(s), credited $${Number(
            data.totalCredited || 0
          ).toFixed(2)} USD.`
        );
        fetchTabContent();
        await refreshUserContext();
      } else {
        setCronResult(`Cron failed: ${data.error}`);
      }
    } catch (err: any) {
      setCronResult(`Cron execution error: ${err.message}`);
    } finally {
      setIsProcessingCron(false);
    }
  };

  const handleToggleSuspend = async (userId: string, isCurrentlySuspended: boolean) => {
    try {
      const newStatus = isCurrentlySuspended ? 'active' : 'suspended';
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          reason: isCurrentlySuspended ? 'Admin unsuspended account' : 'Admin suspended account',
        }),
      });
      if (res.ok) {
        fetchTabContent();
      }
    } catch (err) {
      console.error('Suspend error:', err);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'wallets', label: 'Wallets', icon: Wallet },
    { id: 'plans', label: 'VIP Plans', icon: TrendingUp },
    { id: 'investments', label: 'Investments', icon: Coins },
    { id: 'deposits', label: 'Deposits', icon: ArrowDownLeft },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpRight },
    { id: 'transfers', label: 'Transfers', icon: Send },
    { id: 'transactions', label: 'Transactions', icon: FileText },
    { id: 'ledger', label: 'Ledger', icon: Database },
    { id: 'audit', label: 'Audit Logs', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Platform Management & Financial Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Enterprise administration console for managing investor accounts, unique usernames, VIP yield tiers, double-entry financial ledger records, and bank reconciliations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <AdminGlobalSearchBar
            token={token || ''}
            onSelectUser={(uid) => setInspectUserId(uid)}
            onNavigateTab={(tabId) => setActiveTab(tabId as AdminTab)}
          />
          <button
            onClick={fetchTabContent}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-semibold scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === 'overview' && (
          <AdminOverviewTab
            metrics={metrics}
            recentTransactions={recentTransactions}
            isProcessingCron={isProcessingCron}
            cronResult={cronResult}
            onRunDailyCron={handleRunDailyCron}
            onSwitchTab={(tabId) => setActiveTab(tabId as AdminTab)}
          />
        )}

        {activeTab === 'users' && (
          <AdminUsersTab
            users={users}
            isLoading={isLoading}
            token={token}
            onRefresh={fetchTabContent}
            onInspectUser={(u) => setInspectUserId(u.id || u.uid)}
            onOpenAdjustBalance={(u) => setAdjustBalanceUser(u)}
            onToggleSuspend={handleToggleSuspend}
          />
        )}

        {activeTab === 'wallets' && (
          <AdminWalletsTab
            token={token}
            onInspectUser={(uid) => setInspectUserId(uid)}
            onOpenAdjustBalance={(u) => setAdjustBalanceUser(u)}
          />
        )}

        {activeTab === 'plans' && (
          <AdminVipPlansTab
            plans={plans}
            isLoading={isLoading}
            onRefresh={fetchTabContent}
            token={token}
            onSuccess={fetchTabContent}
          />
        )}

        {activeTab === 'investments' && (
          <AdminInvestmentsTab
            token={token}
            onInspectUser={(uid) => setInspectUserId(uid)}
          />
        )}

        {activeTab === 'deposits' && (
          <AdminDepositsTab
            deposits={deposits}
            isLoading={isLoading}
            onRefresh={fetchTabContent}
            token={token}
            onSuccess={fetchTabContent}
          />
        )}

        {activeTab === 'withdrawals' && (
          <AdminWithdrawalsTab
            withdrawals={withdrawals}
            isLoading={isLoading}
            onRefresh={fetchTabContent}
            token={token}
            onSuccess={fetchTabContent}
          />
        )}

        {activeTab === 'transfers' && (
          <AdminTransfersTab
            token={token}
            onInspectUser={(uid) => setInspectUserId(uid)}
          />
        )}

        {activeTab === 'transactions' && (
          <AdminTransactionsTab
            token={token}
            onInspectUser={(uid) => setInspectUserId(uid)}
          />
        )}

        {activeTab === 'ledger' && (
          <AdminLedgerTab
            token={token}
            onOpenNewAdjustment={() => {
              setActiveTab('users');
            }}
          />
        )}

        {activeTab === 'audit' && <AdminAuditLogsTab token={token} />}

        {activeTab === 'settings' && <AdminSettingsTab token={token} />}
      </div>

      {/* Deep User Record Inspector Drawer / Modal */}
      {inspectUserId && (
        <AdminUserDetailModal
          isOpen={!!inspectUserId}
          onClose={() => setInspectUserId(null)}
          userId={inspectUserId}
          token={token}
          onOpenAdjustBalance={(u) => {
            setAdjustBalanceUser(u);
          }}
          onUserUpdated={fetchTabContent}
        />
      )}

      {/* Controlled Financial Balance Adjustment Modal */}
      {adjustBalanceUser && (
        <AdminAdjustBalanceModal
          isOpen={!!adjustBalanceUser}
          onClose={() => setAdjustBalanceUser(null)}
          user={adjustBalanceUser}
          token={token}
          onSuccess={() => {
            fetchTabContent();
            refreshUserContext();
          }}
        />
      )}
    </div>
  );
};
