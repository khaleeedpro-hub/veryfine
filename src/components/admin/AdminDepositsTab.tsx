import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  ExternalLink,
  Coins,
  Settings,
  Plus,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { DepositAsset } from '../../types';

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
  const [activeTab, setActiveTab] = useState<'deposits' | 'assets'>('deposits');

  // Reconcile modal state
  const [activeModalDeposit, setActiveModalDeposit] = useState<any | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Recheck state
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  // Assets state
  const [assets, setAssets] = useState<DepositAsset[]>([]);
  const [receivingAddress, setReceivingAddress] = useState('0x311136bd4daac7083a552407703b6892f2aa0c48');
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [editingAsset, setEditingAsset] = useState<DepositAsset | null>(null);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    symbol: '',
    name: '',
    contractAddress: '',
    decimals: 18,
    minimumDeposit: 10,
    confirmationRequirement: 3,
    enabled: true,
  });

  useEffect(() => {
    fetchAssets();
  }, [token]);

  const fetchAssets = async () => {
    if (!token) return;
    setIsLoadingAssets(true);
    try {
      const res = await fetch('/api/admin/deposit-assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        if (data.receivingAddress) setReceivingAddress(data.receivingAddress);
      }
    } catch (err) {
      console.error('Failed to fetch deposit assets:', err);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (d.id || d.depositId || '').toLowerCase().includes(q) ||
      (d.user_id || d.userId || '').toLowerCase().includes(q) ||
      (d.username || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q) ||
      (d.asset || '').toLowerCase().includes(q) ||
      (d.transactionHash || '').toLowerCase().includes(q) ||
      (d.payment_method || d.paymentProvider || '').toLowerCase().includes(q)
    );
  });

  const handleRecheckBlockchain = async (deposit: any) => {
    const id = deposit.id || deposit.depositId;
    setRecheckingId(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}/recheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Blockchain re-check failed.');
      } else {
        alert(data.message || 'Deposit status updated from blockchain.');
        onSuccess();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to re-check deposit.');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalDeposit) return;

    setIsProcessing(true);
    setError('');

    try {
      const res = await fetch(
        `/api/admin/deposits/${activeModalDeposit.id || activeModalDeposit.depositId}/reconcile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes: reconcileNotes.trim() }),
        }
      );

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

  const handleToggleAsset = async (asset: DepositAsset) => {
    try {
      const res = await fetch(`/api/admin/deposit-assets/${asset.assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !asset.enabled }),
      });
      if (res.ok) {
        fetchAssets();
      }
    } catch (err) {
      console.error('Failed to toggle asset:', err);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    try {
      const res = await fetch(`/api/admin/deposit-assets/${editingAsset.assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          minimumDeposit: editingAsset.minimumDeposit,
          confirmationRequirement: editingAsset.confirmationRequirement,
          contractAddress: editingAsset.contractAddress,
          name: editingAsset.name,
          symbol: editingAsset.symbol,
        }),
      });

      if (res.ok) {
        setEditingAsset(null);
        fetchAssets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update asset');
      }
    } catch (err) {
      console.error('Failed to update asset:', err);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/deposit-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAsset),
      });

      if (res.ok) {
        setShowAddAssetModal(false);
        setNewAsset({
          symbol: '',
          name: '',
          contractAddress: '',
          decimals: 18,
          minimumDeposit: 10,
          confirmationRequirement: 3,
          enabled: true,
        });
        fetchAssets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add asset');
      }
    } catch (err) {
      console.error('Failed to add asset:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'deposits'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Inbound Deposits ({filteredDeposits.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'assets'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Deposit Assets ({assets.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onRefresh();
              fetchAssets();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isLoadingAssets ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'deposits' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by deposit ID, hash, username, email..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Receiving Address: <span className="text-emerald-400 font-bold">{receivingAddress.slice(0, 10)}...{receivingAddress.slice(-8)}</span>
            </div>
          </div>

          {/* Deposits Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Deposit ID</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Asset</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Transaction Hash</th>
                    <th className="p-4">Confirmations</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDeposits.length > 0 ? (
                    filteredDeposits.map((d) => {
                      const isRechecking = recheckingId === (d.id || d.depositId);
                      const tx = d.transactionHash || '';
                      const shortTx = tx ? `${tx.substring(0, 8)}...${tx.substring(tx.length - 6)}` : 'N/A';

                      return (
                        <tr key={d.id || d.depositId} className="hover:bg-slate-800/40">
                          <td className="p-4 font-mono text-[11px] text-slate-400">
                            {(d.id || d.depositId).substring(0, 14)}...
                            <div className="text-[10px] text-slate-500">
                              {new Date(d.created_at || d.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-white">@{d.username || d.user_id}</div>
                            <div className="text-[11px] text-slate-400">{d.email}</div>
                          </td>

                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-slate-800 rounded font-bold text-white">
                              {d.asset || 'USDT'}
                            </span>
                          </td>

                          <td className="p-4 font-bold text-emerald-400 text-sm">
                            +${Number(d.amountUsd || d.amount || 0).toFixed(2)} USD
                            {d.asset === 'BNB' && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {Number(d.amount || 0).toFixed(4)} BNB
                              </div>
                            )}
                          </td>

                          <td className="p-4 font-mono text-[11px]">
                            {tx ? (
                              <a
                                href={`https://bscscan.com/tx/${tx}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:underline flex items-center gap-1"
                              >
                                <span>{shortTx}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-slate-500">Manual / Legacy</span>
                            )}
                          </td>

                          <td className="p-4 font-mono text-[11px]">
                            <span className="font-bold text-white">{d.confirmations || 0}</span>
                            <span className="text-slate-500">/{d.requiredConfirmations || 3}</span>
                          </td>

                          <td className="p-4">
                            <StatusBadge status={d.status} />
                            {d.failureReason && (
                              <div className="text-[10px] text-red-400 max-w-[140px] truncate mt-0.5" title={d.failureReason}>
                                {d.failureReason}
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-right space-x-2 whitespace-nowrap">
                            {tx && d.status !== 'completed' && (
                              <button
                                onClick={() => handleRecheckBlockchain(d)}
                                disabled={isRechecking}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                              >
                                <RefreshCw className={`w-3 h-3 ${isRechecking ? 'animate-spin' : ''}`} />
                                <span>Re-check BSC</span>
                              </button>
                            )}

                            {d.status !== 'completed' && (
                              <button
                                onClick={() => setActiveModalDeposit(d)}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg cursor-pointer text-xs inline-flex items-center gap-1 shadow-sm"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Manual Credit</span>
                              </button>
                            )}

                            {d.status === 'completed' && (
                              <span className="text-[11px] text-emerald-400 font-semibold">Credited</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        No deposits found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white">Configured Deposit Assets</h3>
              <p className="text-xs text-slate-400">
                Manage supported BNB Smart Chain tokens, minimum deposit limits, and confirmation blocks
              </p>
            </div>

            <button
              onClick={() => setShowAddAssetModal(true)}
              className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Add BEP-20 Asset</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.assetId}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-xl ${
                  asset.enabled ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-white">{asset.symbol}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 font-bold text-slate-300">
                      {asset.contractAddress === 'NATIVE' ? 'Native' : 'BEP-20'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleAsset(asset)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                      asset.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {asset.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-slate-400">Name: <strong className="text-white">{asset.name}</strong></div>
                  <div className="text-slate-400">
                    Min Deposit: <strong className="text-emerald-400">{asset.minimumDeposit} {asset.symbol}</strong>
                  </div>
                  <div className="text-slate-400">
                    Confirmations: <strong className="text-white">{asset.confirmationRequirement} blocks</strong>
                  </div>
                  <div className="text-slate-400 pt-1 font-mono text-[11px] truncate">
                    Contract:{' '}
                    {asset.contractAddress === 'NATIVE' ? (
                      <span className="text-slate-300">NATIVE (BNB)</span>
                    ) : (
                      <a
                        href={`https://bscscan.com/token/${asset.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline"
                      >
                        {asset.contractAddress.slice(0, 10)}...{asset.contractAddress.slice(-8)}
                      </a>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setEditingAsset(asset)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Configure Settings</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {activeModalDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Manual Deposit Reconciliation</span>
              </h3>
              <button
                onClick={() => setActiveModalDeposit(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">User:</span>
                <span className="font-bold text-white">@{activeModalDeposit.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-emerald-400">
                  +${Number(activeModalDeposit.amountUsd || activeModalDeposit.amount).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">TX Hash:</span>
                <span className="text-slate-200 truncate max-w-[200px]">
                  {activeModalDeposit.transactionHash || 'N/A'}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleReconcileSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Reconciliation Notes & Approval Reason
                </label>
                <textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="e.g., Verified on BSCScan manually / Admin approved"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalDeposit(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Configure {editingAsset.symbol}</h3>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Asset Name</label>
                <input
                  type="text"
                  value={editingAsset.name}
                  onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Contract Address</label>
                <input
                  type="text"
                  value={editingAsset.contractAddress}
                  onChange={(e) => setEditingAsset({ ...editingAsset, contractAddress: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Minimum Deposit</label>
                  <input
                    type="number"
                    step="any"
                    value={editingAsset.minimumDeposit}
                    onChange={(e) => setEditingAsset({ ...editingAsset, minimumDeposit: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Confirmations (Blocks)</label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={editingAsset.confirmationRequirement}
                    onChange={(e) => setEditingAsset({ ...editingAsset, confirmationRequirement: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Add BEP-20 Deposit Asset</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Symbol (e.g. BUSD)</label>
                  <input
                    type="text"
                    value={newAsset.symbol}
                    onChange={(e) => setNewAsset({ ...newAsset, symbol: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white uppercase font-bold"
                    placeholder="BUSD"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Decimals</label>
                  <input
                    type="number"
                    value={newAsset.decimals}
                    onChange={(e) => setNewAsset({ ...newAsset, decimals: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Asset Name</label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  placeholder="Binance USD"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">BEP-20 Contract Address</label>
                <input
                  type="text"
                  value={newAsset.contractAddress}
                  onChange={(e) => setNewAsset({ ...newAsset, contractAddress: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  placeholder="0xe9e7cea3dedca5984780bafc599bd69add087d56"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Minimum Deposit</label>
                  <input
                    type="number"
                    step="any"
                    value={newAsset.minimumDeposit}
                    onChange={(e) => setNewAsset({ ...newAsset, minimumDeposit: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Required Confirmations</label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={newAsset.confirmationRequirement}
                    onChange={(e) => setNewAsset({ ...newAsset, confirmationRequirement: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Create Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
