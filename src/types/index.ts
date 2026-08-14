export type UserRole = 'user' | 'support' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'restricted' | 'pending' | 'closed';

export type TransactionType =
  | 'DEPOSIT'
  | 'INVESTMENT'
  | 'DAILY_EARNING'
  | 'INVESTMENT_MATURITY'
  | 'TRANSFER_SENT'
  | 'TRANSFER_RECEIVED'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_FEE'
  | 'DEPOSIT_FEE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'ADJUSTMENT_CREDIT'
  | 'ADJUSTMENT_DEBIT';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

export interface User {
  id: string;
  uid?: string;
  username?: string;
  usernameLowercase?: string;
  email: string;
  role: UserRole;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  accountStatus?: AccountStatus;
  vipLevel?: number;
  walletAddress: string;
  walletId?: string;
  profileImage?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  pinCooldownUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UserProfile {
  user_id: string;
  uid?: string;
  firstName?: string;
  lastName?: string;
  full_name: string;
  phone?: string;
  country: string;
  address?: string;
  date_of_birth?: string;
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Wallet {
  id: string;
  walletId?: string;
  user_id: string;
  uid?: string;
  wallet_address: string;
  walletAddress?: string;
  currency?: string;
  available_balance: number;
  availableBalance?: number;
  invested_balance: number;
  investedBalance?: number;
  total_earnings: number;
  totalEarnings?: number;
  total_deposits: number;
  totalDeposits?: number;
  total_withdrawals: number;
  totalWithdrawals?: number;
  total_transfers_sent?: number;
  total_transfers_received?: number;
  totalTransfers?: number;
  status?: 'active' | 'frozen' | 'restricted';
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VipPlan {
  id: string;
  planId?: string;
  level: number;
  vipLevel?: number;
  name: string;
  investment_amount: number;
  investmentAmount?: number;
  daily_earning: number;
  dailyEarning?: number;
  duration_days: number;
  durationDays?: number;
  is_active: number | boolean;
  status?: 'active' | 'disabled';
  display_order: number;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Investment {
  id: string;
  user_id: string;
  vip_plan_id: string;
  vip_level: number;
  plan_name: string;
  investment_amount: number;
  daily_earning: number;
  duration_days: number;
  total_earned: number;
  days_credited: number;
  status: 'active' | 'completed' | 'cancelled';
  start_date: string;
  maturity_date: string;
  next_earning_date: string;
  last_earning_date?: string;
}

export interface Transaction {
  id: string;
  transactionId?: string;
  user_id: string;
  userId?: string;
  username?: string;
  type: TransactionType;
  amount: number;
  fee: number;
  currency?: string;
  balance_before?: number;
  balanceBefore?: number;
  balance_after?: number;
  balanceAfter?: number;
  status: TransactionStatus;
  reference_id?: string;
  reference?: string;
  description: string;
  created_at: string;
  createdAt?: string;
}

export interface LedgerEntry {
  id: string;
  entryId?: string;
  transaction_id: string;
  transactionId?: string;
  user_id: string;
  userId?: string;
  username?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  account_type?: string;
  entry_type?: 'DEBIT' | 'CREDIT';
  type?: string;
  amount: number;
  currency?: string;
  balance_after?: number;
  reference?: string;
  reason?: string;
  status?: string;
  createdBy?: string;
  description?: string;
  metadata?: any;
  created_at: string;
  createdAt?: string;
}

export interface BalanceAdjustment {
  adjustmentId: string;
  userId: string;
  username?: string;
  email?: string;
  adminUid: string;
  adminEmail: string;
  type: 'adjustment_credit' | 'adjustment_debit';
  amount: number;
  currency: string;
  reason: string;
  reference: string;
  previousBalance?: number;
  newBalance?: number;
  status: 'completed' | 'failed';
  createdAt: string;
}

export interface Deposit {
  id: string;
  depositId?: string;
  user_id: string;
  userId?: string;
  username?: string;
  email?: string;
  wallet_address?: string;
  amount: number;
  currency?: string;
  payment_method: string;
  paymentProvider?: string;
  providerReference?: string;
  payment_details?: string;
  status: TransactionStatus;
  fee?: number;
  created_at: string;
  createdAt?: string;
}

export interface Withdrawal {
  id: string;
  withdrawalId?: string;
  user_id: string;
  userId?: string;
  username?: string;
  email?: string;
  wallet_address?: string;
  amount: number;
  fee: number;
  net_amount: number;
  netAmount?: number;
  currency?: string;
  payment_method: string;
  method?: string;
  payment_details: string;
  paymentDetails?: any;
  status: TransactionStatus;
  riskStatus?: 'low' | 'medium' | 'high';
  rejection_reason?: string;
  reviewReason?: string;
  created_at: string;
  createdAt?: string;
}

export interface InternalTransfer {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  recipient_wallet_address: string;
  sender_wallet?: string;
  recipient_wallet?: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  notificationId?: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  is_read?: number;
  read?: boolean;
  created_at: string;
  createdAt?: string;
}

export interface AuditLogItem {
  id: string;
  logId?: string;
  actorUid?: string;
  actorRole?: string;
  user_id?: string;
  adminUid?: string;
  adminEmail?: string;
  actor_email?: string;
  action?: string;
  event_type?: string;
  targetType?: string;
  targetId?: string;
  targetUserId?: string;
  amount?: number;
  currency?: string;
  reason?: string;
  reference?: string;
  previousState?: any;
  newState?: any;
  ip_address?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  metadata?: any;
  created_at: string;
  createdAt?: string;
}

