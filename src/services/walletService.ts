import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase/client';
import { Wallet } from '../types';

export interface WalletState {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Normalizes raw Firestore document data into a typed Wallet interface.
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
 * Fetches user wallet balance directly from Firestore.
 * Strictly reads from the 'wallets' collection in Firestore.
 */
export async function fetchWalletByUserId(userId: string): Promise<Wallet | null> {
  if (!userId) {
    return null;
  }

  try {
    // 1. Try default wallet ID pattern: wlt-{userId}
    const primaryRef = doc(db, 'wallets', `wlt-${userId}`);
    const primarySnap = await getDoc(primaryRef);

    if (primarySnap.exists()) {
      return mapDocToWallet(primarySnap.id, primarySnap.data());
    }

    // 2. Try direct userId doc
    const directRef = doc(db, 'wallets', userId);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      return mapDocToWallet(directSnap.id, directSnap.data());
    }

    // 3. Query 'wallets' collection by userId field
    const q = query(collection(db, 'wallets'), where('userId', '==', userId));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      return mapDocToWallet(docSnap.id, docSnap.data());
    }

    // 4. Check 'users' collection to resolve walletId reference if custom
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData?.walletId) {
        const customRef = doc(db, 'wallets', userData.walletId);
        const customSnap = await getDoc(customRef);
        if (customSnap.exists()) {
          return mapDocToWallet(customSnap.id, customSnap.data());
        }
      }
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching wallet from Firestore:', err);
    throw new Error(err?.message || 'Failed to fetch wallet from Firestore database.');
  }
}

/**
 * Fetches wallet by wallet address from Firestore.
 */
export async function fetchWalletByAddress(walletAddress: string): Promise<Wallet | null> {
  if (!walletAddress) {
    return null;
  }

  try {
    const q = query(collection(db, 'wallets'), where('walletAddress', '==', walletAddress));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      return mapDocToWallet(docSnap.id, docSnap.data());
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching wallet by address from Firestore:', err);
    throw new Error(err?.message || 'Failed to fetch wallet by address from Firestore.');
  }
}

/**
 * Subscribes to real-time wallet balance changes in Firestore for a user.
 */
export function subscribeToWallet(
  userId: string,
  onUpdate: (wallet: Wallet | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate(null);
    return () => {};
  }

  const primaryRef = doc(db, 'wallets', `wlt-${userId}`);

  return onSnapshot(
    primaryRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(mapDocToWallet(docSnap.id, docSnap.data()));
      } else {
        // Fallback to querying by userId
        const q = query(collection(db, 'wallets'), where('userId', '==', userId));
        getDocs(q)
          .then((snap) => {
            if (!snap.empty) {
              onUpdate(mapDocToWallet(snap.docs[0].id, snap.docs[0].data()));
            } else {
              onUpdate(null);
            }
          })
          .catch((err) => {
            if (onError) onError(err);
          });
      }
    },
    (err) => {
      console.error('Real-time wallet subscription error:', err);
      if (onError) onError(new Error(err.message));
    }
  );
}

/**
 * React hook to fetch and monitor user wallet balances from Firestore with loading and error states.
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
      setError(err?.message || 'Failed to load wallet balances from database.');
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
