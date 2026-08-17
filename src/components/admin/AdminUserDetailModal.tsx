import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Wallet,
  Shield,
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
  KeyRound,
  Coins,
  RefreshCw,
  Edit2,
  FileCheck2,
  Activity,
  DollarSign,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  token: string | null;
  onOpenAdjustBalance: (user: any) => void;
  onUserUpdated: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  onClose,
  userId,
  token,
  onOpenAdjustBalance,
  onUserUpdated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'wallet' | 'investments' | 'ledger' | 'audit'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for in-place admin edits
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const [isEditingVip, setIsEditingVip] = useState(false);
  const [newVip, setNewVip] = useState('0');

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');

  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isPasswordResetLoading, setIsPasswordResetLoading] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    address: '',
  });

  const fetchDetail = async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setNewUsername(json.user?.username || '');
        setNewVip(String(json.user?.vipLevel || 0));
        setNewStatus(json.user?.accountStatus || 'active');
        setProfileForm({
          firstName: json.profile?.firstName || '',
          lastName: json.profile?.lastName || '',
          phone: json.profile?.phone || '',
          country: json.user?.country || json.profile?.country || 'United States',
          address: json.profile?.address || '',
        });
      }
    } catch (err: any) {
      console.error('Fetch user detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetail();
      setActionMsg(null);
      setIsEditingUsername(false);
      setIsEditingVip(false);
      setIsEditingStatus(false);
      setIsEditingProfile(false);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSaveUsername = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/change-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newUsername: newUsername.trim() }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update username');

      setActionMsg({ type: 'success', text: resData.message || 'Username updated!' });
      setIsEditingUsername(false);
      fetchDetail();
      onUserUpdated();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleSaveVip = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/change-vip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vipLevel: Number(newVip) }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to change VIP tier');

      setActionMsg({ type: 'success', text: resData.message || 'VIP tier updated!' });
      setIsEditingVip(false);
      fetchDetail();
      onUserUpdated();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleSaveStatus = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, reason: statusReason }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update account status');

      setActionMsg({ type: 'success', text: resData.message || 'Status updated!' });
      setIsEditingStatus(false);
      setStatusReason('');
      fetchDetail();
      onUserUpdated();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleFreezeWallet = async () => {
    const isFrozen = data?.wallet?.status === 'frozen';
    try {
      const res = await fetch(`/api/admin/users/${userId}/freeze-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ freeze: !isFrozen, reason: 'Admin toggle' }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to toggle wallet freeze');

      setActionMsg({ type: 'success', text: resData.message });
      fetchDetail();
      onUserUpdated();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleSendPasswordReset = async () => {
    setIsPasswordResetLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to trigger password reset');

      setActionMsg({
        type: 'success',
        text: resData.message || `Password reset dispatched for ${resData.email || 'user'}.`,
      });
      setIsPasswordResetOpen(false);
      fetchDetail();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setIsPasswordResetLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/users/${userId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update profile');

      setActionMsg({ type: 'success', text: 'User profile updated successfully!' });
      setIsEditingProfile(false);
      fetchDetail();
      onUserUpdated();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setActionMsg({ type: 'error', text: 'Please type "delete" to confirm removal.' });
      return;
    }

    setIsDeletingLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to delete user account');

      onUserUpdated();
      onClose();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
      setIsDeletingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl text-slate-100 flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-lg">
              {data?.user?.username?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">
                  @{data?.user?.username || data?.user?.email?.split('@')[0] || 'User'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  VIP {data?.user?.vipLevel || 0}
                </span>
                <StatusBadge status={data?.user?.accountStatus || 'active'} />
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                UID: {userId} • {data?.user?.email}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl font-bold p-2 cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Action Alert Banner */}
        {actionMsg && (
          <div
            className={`p-3 text-xs flex items-center gap-2 border-b ${
              actionMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Quick Admin Action Bar */}
        <div className="bg-slate-800/50 p-3 px-6 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mr-2">Admin Tools:</span>

          <button
            onClick={() => onOpenAdjustBalance({ ...data?.user, ...data?.wallet, full_name: `${data?.profile?.firstName || ''} ${data?.profile?.lastName || ''}`.trim() })}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Adjust Balance</span>
          </button>

          <button
            onClick={() => setIsEditingUsername(!isEditingUsername)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <UserIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>Change Username</span>
          </button>

          <button
            onClick={() => setIsEditingVip(!isEditingVip)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Set VIP Tier</span>
          </button>

          <button
            onClick={() => setIsEditingStatus(!isEditingStatus)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Set Account Status</span>
          </button>

          <button
            onClick={handleToggleFreezeWallet}
            className={`px-3 py-1.5 border rounded-lg flex items-center gap-1.5 cursor-pointer font-medium ${
              data?.wallet?.status === 'frozen'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>{data?.wallet?.status === 'frozen' ? 'Unfreeze Wallet' : 'Freeze Wallet'}</span>
          </button>

          <button
            onClick={() => {
              setIsPasswordResetOpen(!isPasswordResetOpen);
              setIsDeletingUser(false);
              setIsEditingUsername(false);
              setIsEditingVip(false);
              setIsEditingStatus(false);
            }}
            className={`px-3 py-1.5 border rounded-lg flex items-center gap-1.5 cursor-pointer font-medium transition-colors ${
              isPasswordResetOpen
                ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-md'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Secure Password Reset</span>
          </button>

          {data?.user?.role !== 'admin' && (
            <button
              onClick={() => {
                setIsDeletingUser(!isDeletingUser);
                setIsPasswordResetOpen(false);
                setDeleteConfirmText('');
              }}
              className={`px-3 py-1.5 border rounded-lg flex items-center gap-1.5 cursor-pointer font-medium transition-colors ${
                isDeletingUser
                  ? 'bg-rose-500 text-white border-rose-600'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>
          )}
        </div>

        {/* Secure Password Reset Panel (Privacy & Compliance Friendly) */}
        {isPasswordResetOpen && (
          <div className="p-4 bg-emerald-950/40 border-b border-emerald-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                <KeyRound className="w-4 h-4" />
                <span>Secure Password Reset Dispatch</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                User passwords are protected with irreversible cryptographic hashing (PBKDF2/bcrypt) and <span className="text-white font-medium">cannot be viewed in plaintext</span>. Clicking dispatch will issue a secure, time-limited password recovery link to the user's registered email: <span className="font-mono text-emerald-300 font-semibold underline">{data?.user?.email || 'user email'}</span>.
              </p>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Action will be logged in the immutable administrative audit trail.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={handleSendPasswordReset}
                disabled={isPasswordResetLoading}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl cursor-pointer flex items-center gap-2 shadow-lg transition-all"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isPasswordResetLoading ? 'Dispatching...' : 'Dispatch Reset Email'}</span>
              </button>
              <button
                onClick={() => setIsPasswordResetOpen(false)}
                className="px-3 py-2 text-slate-400 hover:text-white cursor-pointer rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Panel */}
        {isDeletingUser && (
          <div className="p-4 bg-rose-950/40 border-b border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Permanently Delete User Account</span>
              </div>
              <p className="text-[11px] text-slate-300">
                This will permanently erase the user account, profile, wallet balance, and release the username reservation. Type <span className="font-mono text-rose-400 font-bold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800">delete</span> to confirm.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'delete'..."
                className="bg-slate-900 border border-rose-800/80 rounded-lg py-1.5 px-3 text-white text-xs font-mono focus:outline-none focus:border-rose-500 w-32"
              />
              <button
                onClick={handleDeleteUser}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isDeletingLoading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingLoading ? 'Deleting...' : 'Confirm Deletion'}</span>
              </button>
              <button
                onClick={() => {
                  setIsDeletingUser(false);
                  setDeleteConfirmText('');
                }}
                className="px-2 py-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Inline Editor Panels */}
        {isEditingUsername && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold">New Unique Username:</span>
            <div className="relative">
              <span className="text-slate-500 font-mono absolute left-2.5 top-2">@</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-6 pr-3 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                placeholder="newusername"
              />
            </div>
            <button
              onClick={handleSaveUsername}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg cursor-pointer"
            >
              Save Username
            </button>
            <button
              onClick={() => setIsEditingUsername(false)}
              className="px-2 py-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {isEditingVip && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold">Select VIP Level (0-6):</span>
            <select
              value={newVip}
              onChange={(e) => setNewVip(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="0">VIP 0 (Standard Member)</option>
              <option value="1">VIP 1 ($50 Plan)</option>
              <option value="2">VIP 2 ($200 Plan)</option>
              <option value="3">VIP 3 ($500 Plan)</option>
              <option value="4">VIP 4 ($1,500 Plan)</option>
              <option value="5">VIP 5 ($5,000 Plan)</option>
              <option value="6">VIP 6 ($15,000 Executive)</option>
            </select>
            <button
              onClick={handleSaveVip}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg cursor-pointer"
            >
              Update VIP Tier
            </button>
            <button
              onClick={() => setIsEditingVip(false)}
              className="px-2 py-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {isEditingStatus && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold">Account Status:</span>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended (Blocked from logging in)</option>
              <option value="restricted">Restricted (Trading/Withdrawal limit)</option>
              <option value="pending">Pending Verification</option>
              <option value="closed">Closed Account</option>
            </select>
            <input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason for status change..."
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-white text-xs flex-1 min-w-[200px]"
            />
            <button
              onClick={handleSaveStatus}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg cursor-pointer"
            >
              Apply Status
            </button>
            <button
              onClick={() => setIsEditingStatus(false)}
              className="px-2 py-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-800 px-6 pt-3 bg-slate-950/20 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'overview', label: 'Profile Overview' },
            { id: 'wallet', label: 'Wallet & Balances' },
            { id: 'investments', label: `Investments (${data?.investments?.length || 0})` },
            { id: 'ledger', label: `Ledger Records (${data?.ledgerEntries?.length || 0})` },
            { id: 'audit', label: `Audit Trail (${data?.auditLogs?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-tab Contents (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Fetching user records...</span>
            </div>
          ) : (
            <>
              {/* TAB: OVERVIEW */}
              {activeSubTab === 'overview' && (
                <div className="space-y-6">
                  {/* Balances Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-1">
                      <div className="text-slate-400 text-[11px]">Available Balance</div>
                      <div className="text-lg font-bold text-white">
                        ${(data?.wallet?.availableBalance || 0).toFixed(2)} USD
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-1">
                      <div className="text-slate-400 text-[11px]">Invested in Plans</div>
                      <div className="text-lg font-bold text-amber-400">
                        ${(data?.wallet?.investedBalance || 0).toFixed(2)} USD
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-1">
                      <div className="text-slate-400 text-[11px]">Total Yield Earned</div>
                      <div className="text-lg font-bold text-emerald-400">
                        +${(data?.wallet?.totalEarnings || 0).toFixed(2)} USD
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-1">
                      <div className="text-slate-400 text-[11px]">Total Deposits</div>
                      <div className="text-lg font-bold text-sky-400">
                        ${(data?.wallet?.totalDeposits || 0).toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* Profile Details Form */}
                  <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">Personal Information</h4>
                      <button
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEditingProfile ? 'Close Editor' : 'Edit Info'}</span>
                      </button>
                    </div>

                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-slate-400">First Name</label>
                          <input
                            type="text"
                            value={profileForm.firstName}
                            onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400">Last Name</label>
                          <input
                            type="text"
                            value={profileForm.lastName}
                            onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400">Phone</label>
                          <input
                            type="text"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400">Country</label>
                          <input
                            type="text"
                            value={profileForm.country}
                            onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-slate-400">Address</label>
                          <input
                            type="text"
                            value={profileForm.address}
                            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-white"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                        >
                          Save Profile Changes
                        </button>
                      </form>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 text-slate-300">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Full Legal Name:</span>
                          <span className="font-semibold text-white">
                            {data?.profile?.firstName || data?.profile?.lastName
                              ? `${data.profile.firstName || ''} ${data.profile.lastName || ''}`.trim()
                              : 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Country:</span>
                          <span className="text-white">{data?.user?.country || data?.profile?.country || 'United States'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Phone:</span>
                          <span className="text-white">{data?.profile?.phone || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Registered Date:</span>
                          <span className="text-white">{new Date(data?.user?.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Last Login:</span>
                          <span className="text-white">{data?.user?.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: WALLET */}
              {activeSubTab === 'wallet' && (
                <div className="space-y-4">
                  <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span>Wallet Record Details</span>
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Wallet ID:</span>
                        <span className="font-mono text-white">{data?.wallet?.walletId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Internal Wallet Address:</span>
                        <span className="font-mono text-white">{data?.wallet?.walletAddress || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Currency:</span>
                        <span className="text-white font-bold">{data?.wallet?.currency || 'USD'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Wallet Status:</span>
                        <span className="font-bold uppercase text-emerald-400">{data?.wallet?.status || 'active'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: INVESTMENTS */}
              {activeSubTab === 'investments' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm">Active & Past Investment Portfolios</h4>
                  {data?.investments && data.investments.length > 0 ? (
                    <div className="space-y-2">
                      {data.investments.map((inv: any) => (
                        <div key={inv.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{inv.planName || 'VIP Plan'}</div>
                            <div className="text-[11px] text-slate-400">
                              Invested: ${Number(inv.investmentAmount || 0).toFixed(2)} • Daily: +${Number(inv.dailyEarning || 0).toFixed(2)}/day
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Credited {inv.daysCredited || 0} / {inv.durationDays || 120} days • Total Earned: ${Number(inv.totalEarned || 0).toFixed(2)}
                            </div>
                          </div>
                          <StatusBadge status={inv.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">No investment plans purchased yet.</div>
                  )}
                </div>
              )}

              {/* TAB: LEDGER */}
              {activeSubTab === 'ledger' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm">Double-Entry Financial Ledger Audit</h4>
                  {data?.ledgerEntries && data.ledgerEntries.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800 uppercase text-[10px] text-slate-400">
                          <tr>
                            <th className="p-3">Entry ID</th>
                            <th className="p-3">Source Account</th>
                            <th className="p-3">Destination</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {data.ledgerEntries.map((l: any) => (
                            <tr key={l.id} className="hover:bg-slate-800/30">
                              <td className="p-3 font-mono text-[11px] text-slate-400">{l.id.substring(0, 14)}</td>
                              <td className="p-3 font-mono text-[11px]">{l.sourceAccount}</td>
                              <td className="p-3 font-mono text-[11px]">{l.destinationAccount}</td>
                              <td className="p-3 font-bold text-white">${Number(l.amount || 0).toFixed(2)}</td>
                              <td className="p-3 font-bold text-emerald-400">{l.type}</td>
                              <td className="p-3 text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">No ledger entries for this user yet.</div>
                  )}
                </div>
              )}

              {/* TAB: AUDIT */}
              {activeSubTab === 'audit' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-sm">Administrative Audit Trail</h4>
                  {data?.auditLogs && data.auditLogs.length > 0 ? (
                    <div className="space-y-2">
                      {data.auditLogs.map((log: any) => (
                        <div key={log.id} className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-start">
                          <div>
                            <span className="font-bold text-amber-400">{log.action}</span>
                            <div className="text-slate-400 text-[11px]">Actor: {log.actorUid} ({log.actorRole})</div>
                            {log.metadata && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1">
                                {JSON.stringify(log.metadata)}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">No audit events recorded for this user.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
