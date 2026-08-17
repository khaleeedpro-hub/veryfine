import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deposit, DepositAsset, DepositConfig } from '../types';
import {
  ArrowDownLeft,
  Copy,
  Check,
  QrCode as QrIcon,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Info,
  ShieldAlert,
  Search,
  Sparkles,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { QrCodeModal } from '../components/common/QrCodeDisplay';

export const DepositPage: React.FC = () => {
  const { token, refreshUserContext, user } = useAuth();

  // Server-side loaded config
  const [config, setConfig] = useState<DepositConfig>({
    network: 'BNB Smart Chain (BEP-20)',
    chainId: 56,
    receivingAddress: '0x311136bd4daac7083a552407703b6892f2aa0c48',
    assets: [],
  });

  const [selectedAsset, setSelectedAsset] = useState<DepositAsset | null>(null);
  const [txHash, setTxHash] = useState('');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verificationStage, setVerificationStage] = useState<'idle' | 'detecting' | 'verifying' | 'confirming' | 'completed' | 'failed'>('idle');
  const [activeVerificationInfo, setActiveVerificationInfo] = useState<any>(null);

  const pollingRef = useRef<any>(null);

  // Fetch deposit configuration and history on mount
  useEffect(() => {
    fetchConfig();
    fetchDeposits();
  }, [token]);

  // Periodic polling if there are any confirming / detecting deposits
  useEffect(() => {
    const hasActiveDeposits = deposits.some(
      (d) => d.status === 'pending' || d.status === 'detecting' || d.status === 'confirming'
    );

    if (hasActiveDeposits) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          fetchDeposits(false);
        }, 8000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [deposits]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/deposits/config');
      if (res.ok) {
        const data: DepositConfig = await res.json();
        setConfig(data);
        if (data.assets && data.assets.length > 0) {
          setSelectedAsset(data.assets[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch deposit config:', err);
    }
  };

  const fetchDeposits = async (showLoading = true) => {
    if (!token) return;
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await fetch('/api/deposits/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(config.receivingAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleVerifyDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActiveVerificationInfo(null);

    const cleanHash = txHash.trim().toLowerCase();
    if (!cleanHash) {
      setError('Please paste your BNB Smart Chain transaction hash.');
      return;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(cleanHash)) {
      setError('Invalid transaction hash format. Must be a 66-character hex string starting with 0x (e.g., 0x9a8b...7c6d).');
      return;
    }

    setIsVerifying(true);
    setVerificationStage('detecting');

    try {
      // Step 1 simulation visual feedback
      await new Promise((r) => setTimeout(r, 600));
      setVerificationStage('verifying');

      const res = await fetch('/api/deposits/submit-tx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionHash: cleanHash,
          assetSymbol: selectedAsset?.symbol || 'USDT',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerificationStage('failed');
        throw new Error(data.error || 'Transaction verification failed on BNB Smart Chain.');
      }

      setActiveVerificationInfo(data.deposit);

      if (data.status === 'completed') {
        setVerificationStage('completed');
        setSuccess(
          data.message ||
            `Transaction verified! +$${Number(data.deposit?.amountUsd || data.deposit?.amount || 0).toFixed(2)} USD credited to your balance.`
        );
        setTxHash('');
        await refreshUserContext();
      } else if (data.status === 'confirming') {
        setVerificationStage('confirming');
        setSuccess(
          data.message ||
            `Transaction detected on BSC! Currently confirmed ${data.deposit?.confirmations || 1}/${data.deposit?.requiredConfirmations || 3} blocks. Your balance will be automatically credited upon 3 confirmations.`
        );
        setTxHash('');
      } else {
        setVerificationStage('detecting');
        setSuccess(data.message || 'Transaction submitted. Our node is detecting it on BNB Smart Chain.');
        setTxHash('');
      }

      await fetchDeposits(false);
    } catch (err: any) {
      setError(err.message || 'Deposit verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecheck = async (depositId: string) => {
    try {
      const res = await fetch(`/api/deposits/${depositId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Verification check failed.');
      } else {
        if (data.status === 'completed') {
          await refreshUserContext();
        }
        await fetchDeposits(false);
      }
    } catch (err) {
      console.error('Failed to recheck deposit:', err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>On-Chain Direct Settlement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ArrowDownLeft className="w-8 h-8 text-emerald-400" />
            <span>Deposit Cryptocurrency</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Deposit native BNB or BEP-20 tokens directly to the platform receiving wallet on{' '}
            <strong className="text-slate-200">BNB Smart Chain</strong>. Verified instantly on-chain.
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 text-xs">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-slate-400 text-[11px] font-medium">Supported Network</div>
            <div className="text-white font-bold text-sm">BNB Smart Chain (BEP-20)</div>
            <div className="text-emerald-400 text-[11px] font-mono">Chain ID: 56 (Mainnet)</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Asset Selection & Receiving Address (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Deposit Asset */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-black">
                  1
                </span>
                <span>Select Deposit Token</span>
              </h2>
              <span className="text-xs text-slate-400 font-medium">BEP-20 Standards</span>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {config.assets.map((asset) => {
                const isSelected = selectedAsset?.assetId === asset.assetId;
                return (
                  <div
                    key={asset.assetId}
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/5'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-white tracking-wide">
                        {asset.symbol}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {asset.contractAddress === 'NATIVE' ? 'Native' : 'BEP-20'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-slate-300 font-semibold truncate">{asset.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Min: <strong className="text-white">{asset.minimumDeposit} {asset.symbol}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Token Details Info Box */}
            {selectedAsset && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Selected Asset:</span>
                  <span className="text-white font-bold">{selectedAsset.name} ({selectedAsset.symbol})</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Token Standard:</span>
                  <span className="text-emerald-400 font-semibold">{selectedAsset.contractAddress === 'NATIVE' ? 'Native BSC Coin' : 'BEP-20 Token'}</span>
                </div>
                {selectedAsset.contractAddress !== 'NATIVE' && (
                  <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-700/40">
                    <span>Contract Address:</span>
                    <a
                      href={`https://bscscan.com/token/${selectedAsset.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline font-mono text-[11px] flex items-center gap-1 max-w-[220px] truncate"
                    >
                      <span>{selectedAsset.contractAddress.slice(0, 10)}...{selectedAsset.contractAddress.slice(-8)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-700/40">
                  <span>Required Confirmations:</span>
                  <span className="text-slate-200 font-bold">{selectedAsset.confirmationRequirement} Blocks (~9 seconds)</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Receiving Address Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-black">
                  2
                </span>
                <span>Send to Platform Receiving Address</span>
              </h2>
              <span className="text-xs text-emerald-400 font-mono font-bold">BEP-20 Network</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-semibold block">
                Platform Receiving Wallet Address:
              </label>

              {/* Address Box */}
              <div className="bg-slate-950 border border-emerald-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                <div className="font-mono text-xs sm:text-sm text-emerald-300 font-bold break-all select-all">
                  {config.receivingAddress}
                </div>
              </div>
            </div>

            {/* Action Buttons: Copy Address & Show QR Code */}
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyAddress}
                className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-98"
              >
                {copiedAddress ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Address Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Receiving Address</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <QrIcon className="w-4 h-4 text-emerald-400" />
                <span>Show QR Code</span>
              </button>
            </div>

            {/* Advisory / Warning Notice */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-xs text-amber-200/90 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Important Deposit Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                • Send funds only via <strong>BNB Smart Chain (BEP-20)</strong>. Do NOT send via Ethereum (ERC-20), Tron (TRC-20), or Polygon.
                <br />
                • Minimum deposit is{' '}
                <strong className="text-white">
                  {selectedAsset?.minimumDeposit || 10} {selectedAsset?.symbol || 'USDT'}
                </strong>
                . Deposits below this threshold cannot be processed.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Transaction Hash Verification Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-black">
                  3
                </span>
                <span>Verify Deposit On-Chain</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">Live RPC</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              After broadcasting the transaction from your wallet or exchange, paste the Transaction Hash below to verify and credit your balance.
            </p>

            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{success}</span>
              </div>
            )}

            <form onSubmit={handleVerifyDeposit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center justify-between">
                  <span>Transaction Hash (TxID)</span>
                  <span className="text-[11px] text-slate-500 font-mono">0x...</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x9a8b7c6d5e4f3a2b1c0d..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-3 px-3.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                    disabled={isVerifying}
                    required
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Example: 0x followed by 64 hex characters</span>
                  {txHash && (
                    <span
                      className={`font-mono text-[10px] ${
                        /^0x[0-9a-fA-F]{64}$/.test(txHash.trim())
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {txHash.trim().length}/66 chars
                    </span>
                  )}
                </div>
              </div>

              {/* Verification Progress Stepper (when verifying or confirmed) */}
              {isVerifying && (
                <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span>Verifying on BNB Smart Chain...</span>
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      {verificationStage === 'detecting' && 'Step 1/3'}
                      {verificationStage === 'verifying' && 'Step 2/3'}
                      {verificationStage === 'confirming' && 'Step 3/3'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div
                      className={`flex items-center gap-2 ${
                        verificationStage === 'detecting'
                          ? 'text-amber-300 font-bold'
                          : 'text-emerald-400'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>1. Connecting to BNB Smart Chain RPC node</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        verificationStage === 'verifying'
                          ? 'text-amber-300 font-bold'
                          : verificationStage === 'confirming' || verificationStage === 'completed'
                          ? 'text-emerald-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>2. Verifying recipient address & contract logs</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        verificationStage === 'confirming'
                          ? 'text-amber-300 font-bold'
                          : verificationStage === 'completed'
                          ? 'text-emerald-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>3. Calculating block confirmations & ledger credit</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !txHash.trim()}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isVerifying || !txHash.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 active:scale-98'
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verifying On-Chain...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Deposit</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px] space-y-1">
              <div className="font-semibold text-slate-300">How verification works:</div>
              <div>1. Our node queries BNB Smart Chain directly via JSON-RPC.</div>
              <div>2. Verifies receiver is <code>0x3111...0c48</code> and token matches official contract.</div>
              <div>3. Automatically credits your USD balance upon 3 block confirmations.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Transaction History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Deposit History & On-Chain Status</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live records of all cryptocurrency deposits submitted to your account
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchDeposits(true)}
            disabled={isRefreshing}
            className="self-start sm:self-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Asset</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Transaction Hash</th>
                <th className="py-3.5 px-4">Confirmations</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No cryptocurrency deposits recorded yet.
                  </td>
                </tr>
              ) : (
                deposits.map((dep) => {
                  const tx = dep.transactionHash || '';
                  const shortTx = tx ? `${tx.substring(0, 8)}...${tx.substring(tx.length - 6)}` : 'N/A';
                  const isPendingOrConfirming =
                    dep.status === 'pending' ||
                    dep.status === 'detecting' ||
                    dep.status === 'confirming';

                  return (
                    <tr key={dep.id || dep.depositId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {new Date(dep.createdAt || dep.created_at || Date.now()).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded-md font-bold text-white">
                          <span>{dep.asset || 'USDT'}</span>
                          <span className="text-[10px] text-emerald-400 font-normal">BSC</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-white">
                        <div className="text-emerald-400">
                          +${Number(dep.amountUsd || dep.amount || 0).toFixed(2)} USD
                        </div>
                        {dep.asset === 'BNB' && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {Number(dep.amount || 0).toFixed(4)} BNB
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
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
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span
                            className={`font-bold ${
                              dep.status === 'completed'
                                ? 'text-emerald-400'
                                : isPendingOrConfirming
                                ? 'text-amber-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {dep.confirmations || (dep.status === 'completed' ? dep.requiredConfirmations || 3 : 0)}/
                            {dep.requiredConfirmations || 3}
                          </span>
                          <span className="text-[10px] text-slate-500">blocks</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={dep.status as any} />
                        {dep.failureReason && (
                          <div className="text-[10px] text-red-400 max-w-[160px] truncate mt-0.5" title={dep.failureReason}>
                            {dep.failureReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {isPendingOrConfirming ? (
                          <button
                            type="button"
                            onClick={() => handleRecheck(dep.id || dep.depositId!)}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Re-verify
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        address={config.receivingAddress}
        network={config.network}
        assetName={selectedAsset ? `${selectedAsset.name} (${selectedAsset.symbol})` : 'BNB Smart Chain BEP-20'}
      />
    </div>
  );
};
export default DepositPage;
