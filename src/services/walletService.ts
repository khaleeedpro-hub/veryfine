import { useState, useEffect, useCallback } from 'react';
import { Wallet } from '../types';

export interface WalletState {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Normalizes raw wallet data into a typed Wallet interface.
 */
export function mapDocToWallet(id: string, data: any): Wallet {
  if (!data) {
    return {
      id,
      user_id: '',
      wallet_address: '',
      available_balance: 0,
      invested_balance: 0,
      total_earnings: 0,
      total_deposits: 0,
      total_withdrawals: 0,
      total_transfers_sent: 0,
      total_transfers_received: 0,
      updated_at: new Date().toISOString(),
    };
  }

  return {
    id: data.walletId || data.id || id,
    user_id: data.userId || data.user_id || '',
    wallet_address: data.walletAddress || data.wallet_address || '',
    available_balance:
      typeof data.availableBalance === 'number'
        ? data.availableBalance
        : typeof data.available_balance === 'number'
        ? data.available_balance
        : 0,
    invested_balance:
      typeof data.investedBalance === 'number'
        ? data.investedBalance
        : typeof data.invested_balance === 'number'
        ? data.invested_balance
        : 0,
    total_earnings:
      typeof data.totalEarnings === 'number'
        ? data.totalEarnings
        : typeof data.total_earnings === 'number'
        ? data.total_earnings
        : 0,
    total_deposits:
      typeof data.totalDeposits === 'number'
        ? data.totalDeposits
        : typeof data.total_deposits === 'number'
        ? data.total_deposits
        : 0,
    total_withdrawals:
      typeof data.totalWithdrawals === 'number'
        ? data.totalWithdrawals
        : typeof data.total_withdrawals === 'number'
        ? data.total_withdrawals
        : 0,
    total_transfers_sent:
      typeof data.totalTransfersSent === 'number'
        ? data.totalTransfersSent
        : typeof data.total_transfers_sent === 'number'
        ? data.total_transfers_sent
        : 0,
    total_transfers_received:
      typeof data.totalTransfersReceived === 'number'
        ? data.totalTransfersReceived
        : typeof data.total_transfers_received === 'number'
        ? data.total_transfers_received
        : 0,
    updated_at: data.updatedAt || data.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetches user wallet balance from server API.
 */
export async function fetchWalletByUserId(userId: string): Promise<Wallet | null> {
  if (!userId) {
    return null;
  }

  try {
    const token = localStorage.getItem('aurainvest_token') || localStorage.getItem('auth_token');
    if (token) {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.wallet) {
          return mapDocToWallet(data.wallet.id || `wlt-${userId}`, data.wallet);
        }
      }
    }
  } catch (apiErr) {
    console.warn('API fetch in fetchWalletByUserId notice:', apiErr);
  }

  return null;
}

/**
 * Fetches wallet by wallet address.
 */
export async function fetchWalletByAddress(walletAddress: string): Promise<Wallet | null> {
  if (!walletAddress) {
    return null;
  }

  try {
    const token = localStorage.getItem('aurainvest_token') || localStorage.getItem('auth_token');
    if (token) {
      const res = await fetch(`/api/transfers/vip-check?address=${encodeURIComponent(walletAddress)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.wallet) {
          return mapDocToWallet(data.wallet.id || walletAddress, data.wallet);
        }
      }
    }
  } catch (err) {
    console.warn('Notice fetching wallet by address:', err);
  }

  return null;
}

/**
 * Subscribes to periodic wallet balance updates for a user.
 */
export function subscribeToWallet(
  userId: string,
  onUpdate: (wallet: Wallet | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate(null);
    return () => {};
  }

  // Initial fetch
  fetchWalletByUserId(userId)
    .then((w) => onUpdate(w))
    .catch((err) => {
      if (onError) onError(err);
    });

  // Periodic polling every 12 seconds
  const intervalId = setInterval(() => {
    fetchWalletByUserId(userId)
      .then((w) => {
        if (w) onUpdate(w);
      })
      .catch((err) => {
        if (onError) onError(err);
      });
  }, 12000);

  return () => {
    clearInterval(intervalId);
  };
}

/**
 * React hook to fetch and monitor user wallet balances with loading and error states.
 */
export function useWalletBalance(userId: string | null | undefined): WalletState {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    if (!userId) {
      setWallet(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchWalletByUserId(userId);
      setWallet(data);
    } catch (err: any) {
      console.warn('Wallet balance fetch notice:', err?.message || err);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return {
    wallet,
    loading,
    error,
    refetch: loadWallet,
  };
}


