import { getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase/client';
import { AuditLogItem, UserRole } from '../types';

export interface AdminClaimsResult {
  isAdmin: boolean;
  role: UserRole | string;
  uid: string | null;
  email: string | null;
  claims: Record<string, any>;
}

export interface ManagedUser {
  id: string;
  email: string;
  role: string;
  is_suspended: number;
  status: 'active' | 'suspended' | 'pending' | 'restricted';
  created_at: string;
  full_name: string;
  country: string;
  wallet_address: string;
  available_balance: number;
  invested_balance: number;
  total_earnings: number;
  total_deposits: number;
  total_withdrawals: number;
}

/**
 * Validates whether the currently authenticated Firebase user possesses
 * custom admin claims or an administrative role in Firestore.
 */
export async function getAdminClaims(forceRefresh = true): Promise<AdminClaimsResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return {
      isAdmin: false,
      role: 'user',
      uid: null,
      email: null,
      claims: {},
    };
  }

  try {
    // 1. Inspect Firebase Auth Custom Token Claims
    const tokenResult = await getIdTokenResult(currentUser, forceRefresh);
    const claims = tokenResult.claims || {};

    const hasAdminClaim = Boolean(
      claims.admin === true ||
      claims.role === 'admin' ||
      claims.isAdmin === true
    );

    // 2. Fallback check on Firestore user document role
    let firestoreRole = (claims.role as string) || 'user';
    let isAdmin = hasAdminClaim;

    if (!isAdmin) {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        firestoreRole = userData?.role || 'user';
        if (userData?.role === 'admin' || userData?.isAdmin === true) {
          isAdmin = true;
        }
      }
    }

    return {
      isAdmin,
      role: firestoreRole,
      uid: currentUser.uid,
      email: currentUser.email,
      claims,
    };
  } catch (err: any) {
    console.error('Error verifying admin claims:', err);
    return {
      isAdmin: false,
      role: 'user',
      uid: currentUser.uid,
      email: currentUser.email,
      claims: {},
    };
  }
}

/**
 * Asserts that the active user possesses custom admin claims.
 * Throws an explicit error if custom admin claim check fails.
 */
export async function requireAdminClaims(): Promise<AdminClaimsResult> {
  const result = await getAdminClaims(true);
  if (!result.isAdmin) {
    throw new Error('Access denied: Action requires custom admin claims or administrator privileges.');
  }
  return result;
}

/**
 * Admin action: Toggles user account suspension state.
 * Strictly verifies custom admin claims before proceeding.
 */
export async function toggleUserSuspension(
  targetUserId: string,
  isSuspended: boolean,
  reason = 'Administrative action'
): Promise<{ success: boolean; message: string }> {
  // 1. Custom admin claim verification
  const adminInfo = await requireAdminClaims();

  // Prevent suspending self or administrative accounts
  if (targetUserId === adminInfo.uid) {
    throw new Error('Action rejected: Cannot suspend your own administrative account.');
  }

  const token = localStorage.getItem('aurainvest_token');

  // Try server API first
  if (token) {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isSuspended, reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user suspension state.');
      }

      return { success: true, message: data.message };
    } catch (apiError: any) {
      console.warn('API suspension update failed, executing directly on Firestore:', apiError?.message);
    }
  }

  // Fallback direct Firestore update with admin authorization check
  const newStatus = isSuspended ? 'suspended' : 'active';
  const targetUserRef = doc(db, 'users', targetUserId);
  const targetSnap = await getDoc(targetUserRef);

  if (!targetSnap.exists()) {
    throw new Error('Target user account not found in database.');
  }

  const targetData = targetSnap.data();
  if (targetData?.role === 'admin') {
    throw new Error('Cannot suspend an administrative account.');
  }

  const now = new Date().toISOString();
  await updateDoc(targetUserRef, {
    status: newStatus,
    updatedAt: now,
  });

  // Record audit log entry in Firestore
  await addDoc(collection(db, 'auditLogs'), {
    actorUid: adminInfo.uid,
    actorRole: 'admin',
    action: isSuspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
    targetUserId,
    metadata: { reason },
    createdAt: now,
  });

  return {
    success: true,
    message: `User account successfully ${isSuspended ? 'suspended' : 'restored'}.`,
  };
}

/**
 * Admin action: Updates user account status ('active' | 'suspended' | 'pending' | 'restricted').
 * Requires custom admin claims check.
 */
export async function updateUserAccountStatus(
  targetUserId: string,
  newStatus: 'active' | 'suspended' | 'pending' | 'restricted',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const adminInfo = await requireAdminClaims();

  if (targetUserId === adminInfo.uid && newStatus === 'suspended') {
    throw new Error('Cannot suspend your own account.');
  }

  const targetRef = doc(db, 'users', targetUserId);
  const targetSnap = await getDoc(targetRef);

  if (!targetSnap.exists()) {
    throw new Error('User not found in Firestore.');
  }

  const now = new Date().toISOString();
  await updateDoc(targetRef, {
    status: newStatus,
    updatedAt: now,
  });

  await addDoc(collection(db, 'auditLogs'), {
    actorUid: adminInfo.uid,
    actorRole: 'admin',
    action: `USER_STATUS_UPDATED_${newStatus.toUpperCase()}`,
    targetUserId,
    metadata: { newStatus, reason: reason || 'Admin updated account status' },
    createdAt: now,
  });

  return {
    success: true,
    message: `User account status updated to ${newStatus}.`,
  };
}

/**
 * Admin action: Resets a user's password.
 * Checks for custom admin claims before processing request.
 */
export async function adminResetPassword(
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  await requireAdminClaims();

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required for password reset.');
  }

  const res = await fetch(`/api/admin/users/${targetUserId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset user password.');
  }

  return { success: true, message: data.message };
}

/**
 * Admin action: Resets a user's 4-digit security withdrawal PIN.
 * Checks custom admin claims before processing.
 */
export async function adminResetWithdrawalPin(
  targetUserId: string,
  newPin: string
): Promise<{ success: boolean; message: string }> {
  await requireAdminClaims();

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    throw new Error('New withdrawal PIN must consist of exactly 4 numeric digits.');
  }

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required for PIN reset.');
  }

  const res = await fetch(`/api/admin/users/${targetUserId}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPin }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset withdrawal PIN.');
  }

  return { success: true, message: data.message };
}

/**
 * Fetches the user directory with balances and status for admin management.
 * Verifies custom admin claims prior to data delivery.
 */
export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  await requireAdminClaims();

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required.');
  }

  const res = await fetch('/api/admin/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch user list.');
  }

  const userList = data.users || [];
  return userList.map((u: any) => ({
    ...u,
    status: u.is_suspended === 1 ? 'suspended' : u.status || 'active',
  }));
}

/**
 * Fetches system audit log records for compliance review.
 * Strictly requires custom admin claims.
 */
export async function fetchAdminAuditLogs(): Promise<AuditLogItem[]> {
  await requireAdminClaims();

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required.');
  }

  const res = await fetch('/api/admin/audit-logs', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch audit logs.');
  }

  return data.logs || [];
}
