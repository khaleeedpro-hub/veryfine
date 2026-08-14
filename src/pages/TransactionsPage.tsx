import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { History, Filter, Search, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const TransactionsPage: React.FC = () => {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/transactions?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTxns = transactions.filter((tx) => {
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    const matchesSearch =
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Auditable Financial Ledger & Transaction History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete double-entry accounting trail of deposits, withdrawals, transfers, and VIP daily earnings.
          </p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Type selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-semibold">
          {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'INVESTMENT', 'EARNING', 'TRANSFER_OUT', 'TRANSFER_IN'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                filterType === type
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            placeholder="Search description or ID..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs">
          <span className="font-bold text-white">Ledger Records</span>
          <span className="text-slate-400">{filteredTxns.length} showing</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Tx ID</th>
                <th className="p-4">Type</th>
                <th className="p-4">Description</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Balance After</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No matching ledger records found.
                  </td>
                </tr>
              ) : (
                filteredTxns.map((tx) => {
                  const isPositive = ['DEPOSIT', 'EARNING', 'TRANSFER_IN'].includes(tx.type);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{tx.id}</td>
                      <td className="p-4 font-semibold text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[10px]">
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 max-w-xs truncate">{tx.description}</td>
                      <td className={`p-4 font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                      </td>
                      <td className="p-4 font-semibold text-slate-300">${Number(tx.balance_after).toFixed(2)}</td>
                      <td className="p-4 text-slate-400">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        <StatusBadge status={tx.status} />
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
