import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  X,
  ChevronRight,
  Shield,
  Clock,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface AdminGlobalSearchBarProps {
  token: string;
  onSelectUser: (userId: string) => void;
  onNavigateTab: (tabId: string) => void;
}

export const AdminGlobalSearchBar: React.FC<AdminGlobalSearchBarProps> = ({
  token,
  onSelectUser,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    users: any[];
    transactions: any[];
    deposits: any[];
    withdrawals: any[];
  }>({
    users: [],
    transactions: [],
    deposits: [],
    withdrawals: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], transactions: [], deposits: [], withdrawals: [] });
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults({
            users: data.users || [],
            transactions: data.transactions || [],
            deposits: data.deposits || [],
            withdrawals: data.withdrawals || [],
          });
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search request error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, token]);

  const totalResultsCount =
    results.users.length +
    results.transactions.length +
    results.deposits.length +
    results.withdrawals.length;

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search usernames, emails, transaction or withdrawal IDs... (⌘K)"
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-20 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all shadow-inner"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
          {query && !isLoading && (
            <button
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="p-1 text-slate-400 hover:text-white cursor-pointer rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            ⌘K
          </span>
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto divide-y divide-slate-800 text-xs">
          {totalResultsCount === 0 && !isLoading ? (
            <div className="p-6 text-center text-slate-400">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-slate-300">No records found matching "{query}"</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try searching by username, email address, transaction reference, or wallet ID.
              </p>
            </div>
          ) : (
            <>
              {/* Users Section */}
              {results.users.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 uppercase tracking-wider px-2 mb-2">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>Users ({results.users.length})</span>
                    </span>
                    <button
                      onClick={() => {
                        onNavigateTab('users');
                        setIsOpen(false);
                      }}
                      className="text-slate-400 hover:text-amber-300 text-[10px] cursor-pointer"
                    >
                      View in Users Tab &rarr;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {results.users.map((u) => (
                      <button
                        key={u.uid || u.id}
                        onClick={() => {
                          onSelectUser(u.uid || u.id);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/20">
                            {(u.username || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                              <span>{u.username || 'Investor'}</span>
                              {u.vipLevel > 0 && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                                  VIP {u.vipLevel}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={u.accountStatus || 'active'} />
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Section */}
              {results.transactions.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-400 uppercase tracking-wider px-2 mb-2">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Transactions ({results.transactions.length})</span>
                    </span>
                    <button
                      onClick={() => {
                        onNavigateTab('ledger');
                        setIsOpen(false);
                      }}
                      className="text-slate-400 hover:text-indigo-300 text-[10px] cursor-pointer"
                    >
                      View in Ledger &rarr;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {results.transactions.map((t) => (
                      <button
                        key={t.id || t.transactionId}
                        onClick={() => {
                          if (t.userId) {
                            onSelectUser(t.userId);
                          } else {
                            onNavigateTab('ledger');
                          }
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-indigo-300 flex items-center gap-2">
                            <span className="font-mono text-indigo-400 text-[11px] font-bold">
                              #{t.transactionId || t.id}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              {t.type || 'Transaction'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-sm">
                            {t.description || `User: ${t.userId}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white font-mono">
                            ${Number(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deposits Section */}
              {results.deposits.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-2 mb-2">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Deposits ({results.deposits.length})</span>
                    </span>
                    <button
                      onClick={() => {
                        onNavigateTab('deposits');
                        setIsOpen(false);
                      }}
                      className="text-slate-400 hover:text-emerald-300 text-[10px] cursor-pointer"
                    >
                      View Deposits Queue &rarr;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {results.deposits.map((d) => (
                      <button
                        key={d.id || d.depositId}
                        onClick={() => {
                          if (d.userId) {
                            onSelectUser(d.userId);
                          } else {
                            onNavigateTab('deposits');
                          }
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-emerald-300 font-mono text-[11px]">
                            {d.depositId || d.id}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                            TxHash: {d.transactionHash || 'Direct Ledger'}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="font-bold text-emerald-400 font-mono">
                              +${Number(d.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400">{d.asset}</div>
                          </div>
                          <StatusBadge status={d.status || 'completed'} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Withdrawals Section */}
              {results.withdrawals.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-400 uppercase tracking-wider px-2 mb-2">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Withdrawals ({results.withdrawals.length})</span>
                    </span>
                    <button
                      onClick={() => {
                        onNavigateTab('withdrawals');
                        setIsOpen(false);
                      }}
                      className="text-slate-400 hover:text-rose-300 text-[10px] cursor-pointer"
                    >
                      View Withdrawals Queue &rarr;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {results.withdrawals.map((w) => (
                      <button
                        key={w.id || w.withdrawalId}
                        onClick={() => {
                          if (w.userId) {
                            onSelectUser(w.userId);
                          } else {
                            onNavigateTab('withdrawals');
                          }
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-rose-300 font-mono text-[11px]">
                            {w.withdrawalId || w.id}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                            Dest: {w.destination || 'Bank/Crypto'}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="font-bold text-rose-400 font-mono">
                              -${Number(w.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400">{w.asset}</div>
                          </div>
                          <StatusBadge status={w.status || 'pending'} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
