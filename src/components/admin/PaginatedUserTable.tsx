import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth } from '../../lib/firebase/client';
import {
  Search,
  Users,
  DollarSign,
  Eye,
  TrendingUp,
  UserCheck,
  UserX,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Mail,
  User as UserIcon,
  Shield,
  SlidersHorizontal,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

export interface UserRecord {
  id: string;
  uid?: string;
  username?: string;
  email?: string;
  displayName?: string;
  full_name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  role?: string;
  vipLevel?: number;
  accountStatus?: string;
  status?: string;
  is_suspended?: number;
  availableBalance?: number;
  available_balance?: number;
  investedBalance?: number;
  invested_balance?: number;
  totalEarnings?: number;
  total_earnings?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
  wallet_address?: string;
  walletAddress?: string;
  walletId?: string;
  walletStatus?: string;
  createdAt?: string;
  created_at?: string;
  lastLoginAt?: string | null;
  [key: string]: any;
}

export type SortField =
  | 'username'
  | 'email'
  | 'role'
  | 'vipLevel'
  | 'availableBalance'
  | 'investedBalance'
  | 'totalEarnings'
  | 'accountStatus'
  | 'createdAt';

export type SortOrder = 'asc' | 'desc';

export interface PaginatedUserTableProps {
  /** Optional initial users passed by parent */
  initialUsers?: UserRecord[];
  /** Optional auth token for server-side queries */
  token?: string | null;
  /** Whether the table is currently loading */
  isLoading?: boolean;
  /** Callback to trigger when a user is selected for deep inspection */
  onInspectUser?: (user: UserRecord) => void;
  /** Callback to trigger when an admin opens the balance adjustment modal */
  onOpenAdjustBalance?: (user: UserRecord) => void;
  /** Callback to toggle suspend/active status */
  onToggleSuspend?: (userId: string, isCurrentlySuspended: boolean) => void;
  /** Optional custom refresh handler */
  onRefresh?: () => void;
  /** Default rows per page */
  initialPageSize?: number;
  /** Enable real-time Firestore collection listener */
  enableRealtimeListener?: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error in PaginatedUserTable:', JSON.stringify(errInfo));
}

export const PaginatedUserTable: React.FC<PaginatedUserTableProps> = ({
  initialUsers = [],
  token,
  isLoading: externalLoading = false,
  onInspectUser,
  onOpenAdjustBalance,
  onToggleSuspend,
  onRefresh,
  initialPageSize = 10,
  enableRealtimeListener = false,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pageJumpInput, setPageJumpInput] = useState('');

  // Data & Real-time States
  const [usersList, setUsersList] = useState<UserRecord[]>(initialUsers);
  const [isInternalLoading, setIsInternalLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce timer ref for server-side queries
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external users if provided
  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsersList(initialUsers);
    }
  }, [initialUsers]);

  // Server-side fetch with filter/sort params
  const fetchUsersFromServer = useCallback(async () => {
    const authToken = token || localStorage.getItem('aurainvest_token') || localStorage.getItem('auth_token');
    if (!authToken) return;

    setIsInternalLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('q', searchTerm.trim());
      if (emailSearch.trim()) params.append('email', emailSearch.trim());
      if (usernameSearch.trim()) params.append('username', usernameSearch.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (vipFilter !== 'all') params.append('vipLevel', vipFilter);
      params.append('sortBy', sortField);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      }
    } catch (err) {
      console.error('Failed to fetch server-filtered users:', err);
    } finally {
      setIsInternalLoading(false);
    }
  }, [searchTerm, emailSearch, usernameSearch, statusFilter, roleFilter, vipFilter, sortField, sortOrder, token]);

  // Periodic update polling when real-time updates are enabled
  useEffect(() => {
    if (!enableRealtimeListener) return;

    const intervalId = setInterval(() => {
      fetchUsersFromServer();
      setIsRealtimeActive(true);
      setLastRealtimeUpdate(new Date());
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enableRealtimeListener, fetchUsersFromServer]);

  // Trigger server fetch with debounce when search criteria change
  const handleServerFetchDebounced = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchUsersFromServer();
    }, 300);
  }, [fetchUsersFromServer]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handleEmailSearchChange = (val: string) => {
    setEmailSearch(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handleUsernameSearchChange = (val: string) => {
    setUsernameSearch(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handleRoleFilterChange = (val: string) => {
    setRoleFilter(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handleVipFilterChange = (val: string) => {
    setVipFilter(val);
    setCurrentPage(1);
    handleServerFetchDebounced();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setEmailSearch('');
    setUsernameSearch('');
    setStatusFilter('all');
    setRoleFilter('all');
    setVipFilter('all');
    setCurrentPage(1);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    fetchUsersFromServer();
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (emailSearch.trim()) count++;
    if (usernameSearch.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (roleFilter !== 'all') count++;
    if (vipFilter !== 'all') count++;
    return count;
  }, [searchTerm, emailSearch, usernameSearch, statusFilter, roleFilter, vipFilter]);

  // Column Sort Handler
  const handleSort = (field: SortField) => {
    const nextOrder: SortOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(nextOrder);
    handleServerFetchDebounced();
  };

  // Client-side Filter Layer (ensures instant responsive UI across Firestore listener snapshots)
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const uAccountStatus = (
        u.accountStatus ||
        u.status ||
        (u.is_suspended === 1 ? 'suspended' : 'active')
      ).toLowerCase();
      const uRole = (u.role || 'user').toLowerCase();
      const uVip = Number(u.vipLevel || 0);
      const uEmail = (u.email || '').toLowerCase();
      const uUsername = (u.username || '').toLowerCase();
      const uName = (u.full_name || u.fullName || u.displayName || '').toLowerCase();
      const uUid = (u.id || u.uid || '').toLowerCase();
      const uWallet = (u.wallet_address || u.walletAddress || u.walletId || '').toLowerCase();

      // Account Status Filter
      if (statusFilter !== 'all' && uAccountStatus !== statusFilter.toLowerCase()) {
        return false;
      }

      // Role Filter
      if (roleFilter !== 'all' && uRole !== roleFilter.toLowerCase()) {
        return false;
      }

      // VIP Filter
      if (vipFilter !== 'all' && uVip !== Number(vipFilter)) {
        return false;
      }

      // Specific Email Filter
      if (emailSearch.trim()) {
        const emailQ = emailSearch.toLowerCase().trim();
        if (!uEmail.includes(emailQ)) return false;
      }

      // Specific Username Filter
      if (usernameSearch.trim()) {
        const usernameQ = usernameSearch.toLowerCase().trim().replace(/^@/, '');
        if (!uUsername.includes(usernameQ)) return false;
      }

      // Universal Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim().replace(/^@/, '');
        const matchesAny =
          uUid.includes(q) ||
          uUsername.includes(q) ||
          uEmail.includes(q) ||
          uName.includes(q) ||
          uWallet.includes(q);

        if (!matchesAny) return false;
      }

      return true;
    });
  }, [usersList, searchTerm, emailSearch, usernameSearch, statusFilter, roleFilter, vipFilter]);

  // Client-side Sort Layer
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'username':
          aVal = (a.username || a.email || '').toLowerCase();
          bVal = (b.username || b.email || '').toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'role':
          aVal = (a.role || 'user').toLowerCase();
          bVal = (b.role || 'user').toLowerCase();
          break;
        case 'vipLevel':
          aVal = Number(a.vipLevel || 0);
          bVal = Number(b.vipLevel || 0);
          break;
        case 'availableBalance':
          aVal = Number(a.availableBalance ?? a.available_balance ?? 0);
          bVal = Number(b.availableBalance ?? b.available_balance ?? 0);
          break;
        case 'investedBalance':
          aVal = Number(a.investedBalance ?? a.invested_balance ?? 0);
          bVal = Number(b.investedBalance ?? b.invested_balance ?? 0);
          break;
        case 'totalEarnings':
          aVal = Number(a.totalEarnings ?? a.total_earnings ?? 0);
          bVal = Number(b.totalEarnings ?? b.total_earnings ?? 0);
          break;
        case 'accountStatus':
          aVal = (a.accountStatus || a.status || 'active').toLowerCase();
          bVal = (b.accountStatus || b.status || 'active').toLowerCase();
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt || a.created_at || 0).getTime();
          bVal = new Date(b.createdAt || b.created_at || 0).getTime();
          break;
        default:
          aVal = a.id || '';
          bVal = b.id || '';
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortField, sortOrder]);

  // Pagination Logic
  const totalItems = sortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return sortedUsers.slice(startIndex, startIndex + pageSize);
  }, [sortedUsers, safeCurrentPage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

  // Pagination page numbers generator
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (safeCurrentPage > 3) {
        pages.push('dots-1');
      }

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safeCurrentPage < totalPages - 2) {
        pages.push('dots-2');
      }

      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageJumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setPageJumpInput('');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-400 font-bold" />
    );
  };

  const isLoading = externalLoading || isInternalLoading;

  return (
    <div className="space-y-4" id="paginated-user-table-wrapper">
      {/* Top Filter & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Universal Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="paginated-user-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, UID, email, wallet..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto text-xs">
            {/* Account Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-300">
              <span className="text-[11px] text-slate-400 font-medium">Status:</span>
              <select
                id="paginated-user-status-select"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-slate-800">All Statuses</option>
                <option value="active" className="bg-slate-800">Active</option>
                <option value="suspended" className="bg-slate-800">Suspended</option>
                <option value="restricted" className="bg-slate-800">Restricted</option>
                <option value="pending" className="bg-slate-800">Pending</option>
                <option value="closed" className="bg-slate-800">Closed</option>
              </select>
            </div>

            {/* VIP Tier Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-300">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <select
                id="paginated-user-vip-select"
                value={vipFilter}
                onChange={(e) => handleVipFilterChange(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-slate-800">All VIPs</option>
                <option value="0" className="bg-slate-800">VIP 0</option>
                <option value="1" className="bg-slate-800">VIP 1</option>
                <option value="2" className="bg-slate-800">VIP 2</option>
                <option value="3" className="bg-slate-800">VIP 3</option>
                <option value="4" className="bg-slate-800">VIP 4</option>
                <option value="5" className="bg-slate-800">VIP 5</option>
                <option value="6" className="bg-slate-800">VIP 6</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <select
                id="paginated-user-role-select"
                value={roleFilter}
                onChange={(e) => handleRoleFilterChange(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-slate-800">All Roles</option>
                <option value="user" className="bg-slate-800">Users</option>
                <option value="admin" className="bg-slate-800">Admins</option>
                <option value="support" className="bg-slate-800">Support</option>
              </select>
            </div>

            {/* Targeted Search Drawer Toggle */}
            <button
              id="paginated-user-advanced-filters-btn"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                showAdvancedFilters || emailSearch || usernameSearch
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Targeted Search</span>
              {(emailSearch || usernameSearch) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              )}
            </button>

            {/* Refresh Action */}
            <button
              id="paginated-user-manual-refresh-btn"
              onClick={() => {
                if (onRefresh) onRefresh();
                fetchUsersFromServer();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl border border-slate-700 cursor-pointer transition-colors"
              title="Refresh User Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Clear All Filters button */}
            {activeFiltersCount > 0 && (
              <button
                id="paginated-user-reset-filters-btn"
                onClick={handleClearAllFilters}
                className="flex items-center gap-1 text-slate-400 hover:text-red-400 px-2 py-1 text-xs cursor-pointer transition-colors"
                title="Reset all search parameters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Targeted Email & Username Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                id="paginated-user-email-input"
                type="text"
                value={emailSearch}
                onChange={(e) => handleEmailSearchChange(e.target.value)}
                placeholder="Filter specifically by Email address..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {emailSearch && (
                <button
                  onClick={() => handleEmailSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                id="paginated-user-username-input"
                type="text"
                value={usernameSearch}
                onChange={(e) => handleUsernameSearchChange(e.target.value)}
                placeholder="Filter specifically by Username (@...)..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {usernameSearch && (
                <button
                  onClick={() => handleUsernameSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Table Presentation Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-bold text-sm text-white bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Investor Directory</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </span>

            {/* Live Firestore status indicator */}
            {isRealtimeActive && (
              <div
                className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 rounded-full font-normal"
                title={lastRealtimeUpdate ? `Live Firestore stream active. Last event: ${lastRealtimeUpdate.toLocaleTimeString()}` : 'Live Firestore stream active'}
              >
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                <span className="hidden sm:inline">Live Sync</span>
              </div>
            )}
          </div>

          {/* Rows per page selector */}
          <div className="flex items-center gap-2 text-xs font-normal text-slate-400">
            <span>Rows per page:</span>
            <select
              id="paginated-user-page-size-selector"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-800/70 uppercase text-[10px] text-slate-400 tracking-wider select-none">
              <tr>
                {/* User / Handle */}
                <th
                  onClick={() => handleSort('username')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>User / Handle</span>
                    {renderSortIndicator('username')}
                  </div>
                </th>

                {/* Role / VIP */}
                <th
                  onClick={() => handleSort('vipLevel')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Role / VIP</span>
                    {renderSortIndicator('vipLevel')}
                  </div>
                </th>

                {/* Available Balance */}
                <th
                  onClick={() => handleSort('availableBalance')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Available Balance</span>
                    {renderSortIndicator('availableBalance')}
                  </div>
                </th>

                {/* Invested Balance */}
                <th
                  onClick={() => handleSort('investedBalance')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invested Balance</span>
                    {renderSortIndicator('investedBalance')}
                  </div>
                </th>

                {/* Total Yield */}
                <th
                  onClick={() => handleSort('totalEarnings')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Total Yield</span>
                    {renderSortIndicator('totalEarnings')}
                  </div>
                </th>

                {/* Status */}
                <th
                  onClick={() => handleSort('accountStatus')}
                  className="p-4 cursor-pointer hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {renderSortIndicator('accountStatus')}
                  </div>
                </th>

                {/* Actions */}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {isLoading && paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                      <span className="text-xs">Synchronizing users with Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((u) => {
                  const uid = u.id || u.uid || '';
                  const isSuspended =
                    u.accountStatus === 'suspended' ||
                    u.status === 'suspended' ||
                    u.is_suspended === 1;
                  const availableBal = Number(u.availableBalance ?? u.available_balance ?? 0);
                  const investedBal = Number(u.investedBalance ?? u.invested_balance ?? 0);
                  const totalYield = Number(u.totalEarnings ?? u.total_earnings ?? 0);
                  const username = u.username || u.email?.split('@')[0] || 'investor';
                  const email = u.email || 'No email';
                  const walletAddr = u.wallet_address || u.walletAddress || '';

                  return (
                    <tr key={uid} className="hover:bg-slate-800/40 transition-colors">
                      {/* User Column */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 shadow-inner">
                            {username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>@{username}</span>
                              {u.role === 'admin' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded font-semibold border border-red-500/30">
                                  ADMIN
                                </span>
                              )}
                              {u.role === 'support' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded font-semibold border border-blue-500/30">
                                  SUPPORT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>{email}</span>
                              <button
                                onClick={() => handleCopy(email, `email-${uid}`)}
                                className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                                title="Copy Email"
                              >
                                {copiedId === `email-${uid}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <span>UID: {uid.substring(0, 10)}...</span>
                              <button
                                onClick={() => handleCopy(uid, `uid-${uid}`)}
                                className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                                title="Copy UID"
                              >
                                {copiedId === `uid-${uid}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* VIP & Role Column */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block">
                            VIP {u.vipLevel || 0}
                          </span>
                          <div className="text-[10px] text-slate-500 capitalize">{u.role || 'user'}</div>
                        </div>
                      </td>

                      {/* Available Balance Column */}
                      <td className="p-4">
                        <div className="font-extrabold text-white text-sm">
                          ${availableBal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <span>{walletAddr ? `${walletAddr.substring(0, 10)}...` : 'Active Wallet'}</span>
                        </div>
                      </td>

                      {/* Invested Balance Column */}
                      <td className="p-4">
                        <div className="font-bold text-amber-400">
                          ${investedBal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">In Active Portfolios</div>
                      </td>

                      {/* Total Yield Column */}
                      <td className="p-4">
                        <div className="font-bold text-emerald-400">
                          +${totalYield.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">Credited Yield</div>
                      </td>

                      {/* Account Status Column */}
                      <td className="p-4">
                        <StatusBadge status={u.accountStatus || (isSuspended ? 'suspended' : 'active')} />
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect User */}
                          {onInspectUser && (
                            <button
                              id={`inspect-user-btn-${uid}`}
                              onClick={() => onInspectUser(u)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer shadow-sm"
                              title="Inspect Deep User Record & Ledger"
                            >
                              <Eye className="w-4 h-4 text-sky-400" />
                            </button>
                          )}

                          {/* Balance Adjustment Modal Trigger */}
                          {onOpenAdjustBalance && (
                            <button
                              id={`adjust-balance-btn-${uid}`}
                              onClick={() => onOpenAdjustBalance(u)}
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all cursor-pointer shadow-sm"
                              title="Controlled Balance Adjustment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}

                          {/* Suspend / Restore Button */}
                          {onToggleSuspend && u.role !== 'admin' && (
                            <button
                              id={`toggle-suspend-btn-${uid}`}
                              onClick={() => onToggleSuspend(uid, isSuspended)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                isSuspended
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                              }`}
                              title={isSuspended ? 'Restore / Unsuspend Account' : 'Suspend Account'}
                            >
                              {isSuspended ? (
                                <UserCheck className="w-4 h-4" />
                              ) : (
                                <UserX className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <span className="text-sm font-medium text-slate-400">
                        No users found matching your search and filter criteria.
                      </span>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleClearAllFilters}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 text-xs cursor-pointer transition-colors"
                        >
                          Clear Filters & Show All
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          {/* Summary info */}
          <div>
            Showing <span className="font-semibold text-white">{startIndex}</span> to{' '}
            <span className="font-semibold text-white">{endIndex}</span> of{' '}
            <span className="font-semibold text-white">{totalItems}</span> users
            {activeFiltersCount > 0 && (
              <span className="text-slate-500 text-[11px] ml-1.5">
                (filtered from {usersList.length} total)
              </span>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              id="paginated-user-first-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              id="paginated-user-prev-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={`dots-${idx}`} className="px-1.5 text-slate-600">
                      ...
                    </span>
                  );
                }
                const isCurrent = p === safeCurrentPage;
                return (
                  <button
                    key={`page-${p}`}
                    id={`paginated-user-page-${p}`}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : 'bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              id="paginated-user-next-page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              id="paginated-user-last-page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Page Jump */}
          {totalPages > 1 && (
            <form onSubmit={handleJumpToPage} className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Go to:</span>
              <input
                id="paginated-user-jump-page-input"
                type="number"
                min={1}
                max={totalPages}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                placeholder={String(safeCurrentPage)}
                className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-center text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
              >
                Go
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Also export as PaginatedUsersTable alias for backwards compatibility
export const PaginatedUsersTable = PaginatedUserTable;
