import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, Filter, ArrowRight, ShieldCheck, Plus } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminLedgerTabProps {
  token: string | null;
  onOpenNewAdjustment: () => void;
}

export const AdminLedgerTab: React.FC<AdminLedgerTabProps> = ({
  token,
  onOpenNewAdjustment,
}) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchLedger = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/ledger', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Fetch ledger failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [token]);

  const filteredEntries = entries.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (e.id || '').toLowerCase().includes(q) ||
      (e.sourceAccount || '').toLowerCase().includes(q) ||
      (e.destinationAccount || '').toLowerCase().includes(q) ||
      (e.type || '').toLowerCase().includes(q) ||
      (e.reference || '').toLowerCase().includes(q) ||
      (e.reason || '').toLowerCase().includes(q) ||
      (e.createdBy || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search account, reference, entry ID..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-800">All Transaction Types</option>
              <option value="DEPOSIT" className="bg-slate-800">DEPOSIT</option>
              <option value="WITHDRAWAL" className="bg-slate-800">WITHDRAWAL</option>
              <option value="INVESTMENT" className="bg-slate-800">INVESTMENT</option>
              <option value="DAILY_EARNING" className="bg-slate-800">DAILY_EARNING</option>
              <option value="ADJUSTMENT_CREDIT" className="bg-slate-800">ADJUSTMENT_CREDIT</option>
              <option value="ADJUSTMENT_DEBIT" className="bg-slate-800">ADJUSTMENT_DEBIT</option>
              <option value="INTERNAL_TRANSFER" className="bg-slate-800">INTERNAL_TRANSFER</option>
            </select>
          </div>

          <button
            onClick={fetchLedger}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenNewAdjustment}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Balance Adjustment</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-sm text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Double-Entry Immutable Financial Ledger ({filteredEntries.length})</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            Append-only double-entry records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Entry ID</th>
                <th className="p-4">Flow (Source → Destination)</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount (USD)</th>
                <th className="p-4">Reason / Reference</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      {e.id.substring(0, 14)}...
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                          {e.sourceAccount}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-emerald-400 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                          {e.destinationAccount}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white border border-slate-700">
                        {e.type}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-white text-sm">
                      ${Number(e.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-slate-400 max-w-xs">
                      <div className="truncate text-white font-medium">{e.reason || e.description || 'System transaction'}</div>
                      {e.reference && (
                        <div className="text-[10px] text-slate-500 font-mono">Ref: {e.reference}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-[11px]">
                      {new Date(e.createdAt || e.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-[11px] text-slate-400 font-mono">
                      {e.createdBy || 'system'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    No ledger records found.
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
