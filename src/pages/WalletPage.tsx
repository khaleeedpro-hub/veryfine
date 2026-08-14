import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, Copy, Check, ArrowDownLeft, ArrowUpRight, Send, ShieldCheck, QrCode } from 'lucide-react';

interface WalletPageProps {
  onNavigate: (tab: string) => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({ onNavigate }) => {
  const { wallet } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (wallet?.wallet_address) {
      navigator.clipboard.writeText(wallet.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <span>USD Internal Wallet & Ledger Address</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Your unique internal ledger wallet address for platform transfers and deposits.
          </p>
        </div>
      </div>

      {/* Main Wallet Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Internal Ledger Identifier</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white flex items-center gap-3">
              <span>{wallet?.wallet_address || 'WALLET-LOADING'}</span>
              <button
                onClick={handleCopy}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
                title="Copy Wallet Address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <QrCode className="w-10 h-10 text-emerald-400" />
            <div className="text-[11px] text-slate-400">
              <div className="font-bold text-slate-200">Internal Transfers</div>
              <div>Supports instant $50/day user-to-user transfers</div>
            </div>
          </div>
        </div>

        {/* Balance Breakdown Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold">Available USD</div>
            <div className="text-xl font-bold text-emerald-400">${Number(wallet?.available_balance || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold">Invested USD</div>
            <div className="text-xl font-bold text-teal-300">${Number(wallet?.invested_balance || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold">Total Deposits</div>
            <div className="text-xl font-bold text-white">${Number(wallet?.total_deposits || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold">Total Withdrawals</div>
            <div className="text-xl font-bold text-rose-300">${Number(wallet?.total_withdrawals || 0).toFixed(2)}</div>
          </div>
        </div>

        {/* Quick Operations Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={() => onNavigate('deposit')}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Funds</span>
          </button>
          <button
            onClick={() => onNavigate('withdraw')}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
            <span>Withdraw USD</span>
          </button>
          <button
            onClick={() => onNavigate('transfer')}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Send className="w-4 h-4 text-purple-400" />
            <span>Internal Transfer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
